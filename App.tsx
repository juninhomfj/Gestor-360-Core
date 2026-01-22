import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';

import Layout from './components/Layout';
import Login from './components/Login';
import RequestReset from './components/RequestReset';
import LoadingScreen from './components/LoadingScreen';
import Dashboard from './components/Dashboard'; 
import ToastContainer, { ToastMessage } from './components/Toast';
import SnowOverlay from './components/SnowOverlay';
import { SYSTEM_MODULES } from './config/modulesCatalog';
import ReportBugModal from './components/ReportBugModal';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import InternalChatSystem from './components/InternalChatSystem';

const LAZY_RELOAD_KEY = 'sys_lazy_reload_once';
const MODULE_IMPORT_ERROR_PATTERN = /Importing a module script failed|Failed to fetch dynamically imported module|ChunkLoadError|Loading chunk/i;

const lazyWithRetry = <T,>(loader: () => Promise<{ default: T }>) =>
    lazy(() =>
        loader()
            .then((module) => {
                sessionStorage.removeItem(LAZY_RELOAD_KEY);
                return module;
            })
            .catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                const hasRetried = sessionStorage.getItem(LAZY_RELOAD_KEY) === 'true';
                if (MODULE_IMPORT_ERROR_PATTERN.test(message) && !hasRetried) {
                    sessionStorage.setItem(LAZY_RELOAD_KEY, 'true');
                    window.location.reload();
                }
                return Promise.reject(error);
            })
    );

// Importação Dinâmica
const HomeDashboard = lazyWithRetry(() => import('./components/HomeDashboard'));
const SalesForm = lazyWithRetry(() => import('./components/SalesForm'));
const SalesList = lazyWithRetry(() => import('./components/SalesList'));
const BoletoControl = lazyWithRetry(() => import('./components/BoletoControl'));
const FinanceDashboard = lazyWithRetry(() => import('./components/FinanceDashboard'));
const FinanceTransactionsList = lazyWithRetry(() => import('./components/FinanceTransactionsList'));
const FinanceTransactionForm = lazyWithRetry(() => import('./components/FinanceTransactionForm'));
const FinanceReceivables = lazyWithRetry(() => import('./components/FinanceReceivables'));
const FinanceDistribution = lazyWithRetry(() => import('./components/FinanceDistribution'));
const FinanceManager = lazyWithRetry(() => import('./components/FinanceManager'));
const FinanceCategories = lazyWithRetry(() => import('./components/FinanceCategories'));
const FinanceGoals = lazyWithRetry(() => import('./components/FinanceGoals'));
const FinanceChallenges = lazyWithRetry(() => import('./components/FinanceChallenges'));
const SettingsHub = lazyWithRetry(() => import('./components/SettingsHub'));
const DevRoadmap = lazyWithRetry(() => import('./components/DevRoadmap'));
const BackupModal = lazyWithRetry(() => import('./components/BackupModal'));
const BulkDateModal = lazyWithRetry(() => import('./components/BulkDateModal'));
const ClientManagementHub = lazyWithRetry(() => import('./components/ClientManagementHub'));
const TicketsManager = lazyWithRetry(() => import('./components/TicketsManager'));
const Campaigns = lazyWithRetry(() => import('./components/Campaigns'));

import {
    User, Sale, AppMode, AppTheme, FinanceAccount, Transaction, CreditCard,
    TransactionCategory, FinanceGoal, Challenge, ChallengeCell, Receivable,
    CommissionRule, ReportConfig, SalesTargets, ProductType, SystemConfig,
    DashboardWidgetConfig, Client, AppNotification, LogLevel, SalesTask, SalesTaskType
} from './types';

import {
    getStoredSales, getFinanceData, getSystemConfig, getReportConfig,
    getStoredTable, saveSingleSale, getClients,
    saveCommissionRules, bootstrapProductionData, saveReportConfig,
    canAccess, handleSoftDelete, clearNotifications, bulkBillSales, DEFAULT_SYSTEM_CONFIG, saveSales, deleteReceivablesBySaleIds, getSalesTasks, getSalesQueryDiagnostics,
    clearAllSales, computeCommissionValues, saveSalesTask, ensureNumber
} from './services/logic';
import { applyAvistaLowMarginRule, applyCampaignOverlay } from './services/commissionCampaignOverlay';
import {
    getCampaignsByCompany,
    getMonthlyBasicBasketProgress,
    getSaleMonthKey,
    resolveCompanyId,
    resolveMonthlyBasicBasketTarget
} from './services/campaignService';

import { logout, getSession, updateUser, watchAuthChanges } from './services/auth';
import { AudioService } from './services/audioService';
import { Logger } from './services/logger';
import { startSyncWorker } from './services/syncWorker';
import { sendMessage, getMessages, subscribeToMessages } from './services/internalChat';
import { requestAndSaveToken } from './services/pushService';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { SALES_TASK_LABELS } from './utils/salesTasks';
import { dbBulkPut } from './storage/db';
import { safeSetDoc } from './services/safeWrites';
import { db } from './services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getTickets } from './services/tickets';

type AuthView = 'LOGIN' | 'REQUEST_RESET' | 'APP' | 'ERROR' | 'LOADING' | 'BLOCKED';

const ModuleLoader = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] animate-in fade-in duration-500">
        <Loader2 className="text-indigo-500 animate-spin mb-4" size={40} />
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Preparando Ambiente...</p>
    </div>
);

const isHiddenModule = (user: User | null, mod: string): boolean =>
    !!(user as any)?.hiddenModules?.[mod];

const App: React.FC = () => {
    const initRun = useRef(false);
    const activeTabRef = useRef<string>('home');
    const syncWorkerStopRef = useRef<(() => void) | null>(null);
    const emptySalesToastRef = useRef(false);
    const missingSalesIndexToastRef = useRef(false);
    const notifiedTicketIdsRef = useRef<Set<string>>(new Set());
    const bootstrapLogRef = useRef(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authView, setAuthView] = useState<AuthView>('LOADING');
    const [authError, setAuthError] = useState<string | null>(null);
    
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
    const [isClearLocalModalOpen, setIsClearLocalModalOpen] = useState(false);
    const [isBulkDateModalOpen, setIsBulkDateModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState<Sale | null>(null);
    const [showSalesForm, setShowSalesForm] = useState(false);
    const [showTxForm, setShowTxForm] = useState(false);
    const [txFormType, setTxFormType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('EXPENSE');
    const [hideValues, setHideValues] = useState(() => localStorage.getItem('sys_hide_values') === 'true');
    const [showSnow, setShowSnow] = useState(() => localStorage.getItem('sys_snow_enabled') === 'true');
    
    const [toasts, setSortedToasts] = useState<ToastMessage[]>([]);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [bugModalOpen, setBugModalOpen] = useState(false);
    const [bugPrompt, setBugPrompt] = useState<{ message: string; level: LogLevel } | null>(null);
    const bugPromptCooldownRef = useRef(0);

    const { isDev, isAdmin } = useMemo(() => {
        if (!currentUser) return { isDev: false, isAdmin: false };
        
        const isSpecialUser = ['mint', 'soldev'].includes(currentUser.username?.toLowerCase() || '') ||
                             ['mint@gestor360.com', 'soldev@gestor360.com'].includes(currentUser.email?.toLowerCase() || '');
        
        const baseDev = currentUser.role === 'DEV' || isSpecialUser;
        const baseAdmin = currentUser.role === 'ADMIN' || baseDev;
        
        return {
            isDev: baseDev,
            isAdmin: baseAdmin
        };
    }, [currentUser]);

    const [appMode, setAppMode] = useState<AppMode>(
        () => (localStorage.getItem('sys_last_mode') as AppMode) || 'SALES'
    );
    const [activeTab, setActiveTab] = useState(() => {
        const storedTab = localStorage.getItem('sys_last_tab') || 'home';
        return storedTab === 'boletos' ? 'pendencias' : storedTab;
    });
    const [theme, setTheme] = useState<AppTheme>('glass');
    const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);

    const addToast = (type: 'SUCCESS' | 'ERROR' | 'INFO', message: string) => {
        const id = crypto.randomUUID();
        setSortedToasts(prev => [...prev, { id, type, message }]);
    };
    const parseLastSeen = (value?: string) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    };
    const getLastSeen = (key: 'chat' | 'tickets') => {
        if (!currentUser) return 0;
        const prefs = currentUser.prefs || {};
        const prefValue = key === 'chat' ? prefs.lastSeenChat : prefs.lastSeenTickets;
        return parseLastSeen(prefValue);
    };
    const updateLastSeen = async (key: 'chat' | 'tickets', value: number) => {
        if (!currentUser) return;
        const prefs = currentUser.prefs || {};
        const nextPrefs = {
            ...prefs,
            ...(key === 'chat' ? { lastSeenChat: String(value) } : { lastSeenTickets: String(value) })
        };
        const nextUser = { ...currentUser, prefs: nextPrefs };
        handleUpdateUserInApp(nextUser);
        try {
            await updateUser(currentUser.id, { prefs: nextPrefs });
        } catch {}
    };
    const pushNotification = (notif: AppNotification) => {
        setNotifications(prev => {
            if (prev.find(n => n.id === notif.id)) return prev;
            return [notif, ...prev].slice(0, 40);
        });
    };
    const isDarkMode = ['glass', 'cyberpunk', 'dark'].includes(theme);
    const toggleHideValues = () => {
        const next = !hideValues;
        setHideValues(next);
        localStorage.setItem('sys_hide_values', String(next));
    };

    useEffect(() => {
        const handler = (event: Event) => {
            if (!currentUser) return;
            const detail = (event as CustomEvent).detail as { level?: LogLevel; message?: string };
            const level = detail?.level || 'ERROR';
            if (!['WARN', 'ERROR', 'CRASH'].includes(level)) return;
            const now = Date.now();
            if (now - bugPromptCooldownRef.current < 120000) return;
            bugPromptCooldownRef.current = now;
            const promptMessage = detail?.message || 'Detectamos um comportamento inesperado.';
            setBugPrompt({ message: promptMessage, level });
            addToast('ERROR', 'Detectamos uma instabilidade. Você pode reportar o bug agora.');
        };

        window.addEventListener('app:bug-detected', handler as EventListener);
        return () => window.removeEventListener('app:bug-detected', handler as EventListener);
    }, [currentUser]);

    useEffect(() => {
        activeTabRef.current = activeTab;
        if (!currentUser) return;
        if (activeTab === 'chat') {
            updateLastSeen('chat', Date.now());
            setNotifications(prev => prev.filter(n => !n.id.startsWith('chat:')));
        }
        if (activeTab === 'tickets') {
            updateLastSeen('tickets', Date.now());
            setNotifications(prev => prev.filter(n => !n.id.startsWith('ticket:')));
        }
    }, [activeTab, currentUser]);

    useEffect(() => {
        if (!currentUser) return;
        const localChat = parseLastSeen(localStorage.getItem('sys_last_seen_chat') || undefined);
        const localTickets = parseLastSeen(localStorage.getItem('sys_last_seen_tickets') || undefined);
        const prefChat = parseLastSeen(currentUser.prefs?.lastSeenChat);
        const prefTickets = parseLastSeen(currentUser.prefs?.lastSeenTickets);
        if (localChat > prefChat) updateLastSeen('chat', localChat);
        if (localTickets > prefTickets) updateLastSeen('tickets', localTickets);
    }, [currentUser?.id]);

    useEffect(() => {
        if (!currentUser) return;
        const ref = doc(db, 'profiles', currentUser.id);
        const unsubscribe = onSnapshot(ref, (snap) => {
            const data = snap.data() as any;
            if (!data?.prefs) return;
            const nextPrefs = { ...(currentUser.prefs || {}), ...(data.prefs || {}) };
            if (JSON.stringify(nextPrefs) === JSON.stringify(currentUser.prefs || {})) return;
            handleUpdateUserInApp({ ...currentUser, prefs: nextPrefs });
        });
        return () => unsubscribe();
    }, [currentUser?.id]);

    const removeToast = (id: string) => {
        setSortedToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleClearAllNotifications = async () => {
        if (!currentUser) return;
        const now = Date.now();
        setNotifications([]);
        await updateLastSeen('chat', now);
        await updateLastSeen('tickets', now);
        if (isAdmin) {
            await clearNotifications(currentUser.id, 'ALL');
            addToast('INFO', 'Hist?rico de notifica??es limpo para toda a rede.');
        }
    };

    const handleLogout = async () => {
        await logout();
        syncWorkerStopRef.current?.();
        syncWorkerStopRef.current = null;
        setCurrentUser(null);
        setAuthView('LOGIN');
        setActiveTab('home');
        setAppMode('SALES');
        setNotifications([]);
        setSortedToasts([]);
        setSalesTasks([]);
    };

    useEffect(() => {
        if (!currentUser) {
            syncWorkerStopRef.current?.();
            syncWorkerStopRef.current = null;
            return;
        }
        if (!syncWorkerStopRef.current) {
			// Give initial reads (post-login) a moment to settle before sync retries start.
			syncWorkerStopRef.current = startSyncWorker({ initialDelayMs: 8000 });
        }
        return () => {
            syncWorkerStopRef.current?.();
            syncWorkerStopRef.current = null;
        };
    }, [currentUser?.id]);

    const handleSaveCommissionRulesInApp = async (type: ProductType, rules: CommissionRule[]) => {
        try {
            await saveCommissionRules(type, rules);
            if (type === ProductType.BASICA) setRulesBasic(rules);
            else if (type === ProductType.NATAL) setRulesNatal(rules);
            addToast('SUCCESS', 'Tabela de comissões atualizada!');
        } catch (e: any) {
            addToast('ERROR', e.message);
        }
    };

    const handleSaveReportConfigInApp = async (cfg: ReportConfig) => {
        try {
            await saveReportConfig(cfg);
            setReportConfig(cfg);
            addToast('SUCCESS', 'Parâmetros de gráficos atualizados.');
        } catch (e: any) {
            addToast('ERROR', 'Falha ao salvar parâmetros de gráficos.');
        }
    };
    useEffect(() => {
        if (initRun.current) return;
        initRun.current = true;
        let isMounted = true;
        let unsubscribe: (() => void) | undefined;
        const lastUidRef: { current: string | null } = { current: null };

        const startAuthWatch = async () => {
            try {
                await AudioService.preload();
                const cached = getSession();
                if (cached && !lastUidRef.current) {
                    lastUidRef.current = cached.uid;
                    await handleLoginSuccess(cached);
                }
                unsubscribe = watchAuthChanges(async (sessionUser) => {
                    if (!isMounted) return;
                    if (!sessionUser) {
                        lastUidRef.current = null;
                        setAuthView('LOGIN');
                        setLoading(false);
                        return;
                    }
                    if (lastUidRef.current === sessionUser.uid) {
                        setLoading(false);
                        return;
                    }
                    lastUidRef.current = sessionUser.uid;
                    if (!sessionUser.isActive || sessionUser.userStatus === 'INACTIVE') {
                        setAuthView('BLOCKED');
                        setLoading(false);
                        return;
                    }
                    await handleLoginSuccess(sessionUser);
                });
            } catch (e: any) {
                setAuthError("Erro na conexao Cloud Firestore.");
                setAuthView('ERROR');
                setLoading(false);
            }
        };

        startAuthWatch();
        return () => {
            isMounted = false;
            unsubscribe?.();
        };
    }, []);

    useEffect(() => {
        if (!currentUser) return;
        let active = true;
        const bootNotifications = async () => {
            const lastSeenChat = getLastSeen('chat');
            const lastSeenTickets = getLastSeen('tickets');
            try {
                const [chatHistory, tickets] = await Promise.all([
                    getMessages(currentUser.id, isAdmin),
                    getTickets()
                ]);
                if (!active) return;
                const chatMsgs = (chatHistory?.messages || []).filter(msg =>
                    !msg.deleted &&
                    msg.senderId !== currentUser.id &&
                    new Date(msg.timestamp).getTime() > lastSeenChat
                );
                chatMsgs.forEach(msg => {
                    const preview = msg.content?.trim() || (msg.mediaType ? `Mídia: ${msg.mediaType}` : 'Nova mensagem');
                    pushNotification({
                        id: `chat:${msg.id}`,
                        title: `Nova mensagem de ${msg.senderName || 'Usuário'}`,
                        message: preview,
                        type: 'INFO',
                        source: 'SYSTEM',
                        date: msg.timestamp,
                        read: false
                    });
                });

                tickets
                    .filter(t => new Date(t.createdAt).getTime() > lastSeenTickets)
                    .forEach(t => {
                        pushNotification({
                            id: `ticket:${t.id}`,
                            title: `Novo ticket: ${t.title}`,
                            message: t.description || 'Ticket registrado.',
                            type: 'WARNING',
                            source: 'SYSTEM',
                            date: t.createdAt,
                            read: false
                        });
                    });
            } catch {}
        };

        bootNotifications();
        return () => {
            active = false;
        };
    }, [currentUser?.id, isAdmin]);

    useEffect(() => {
        if (!currentUser) return;
        // IMPORTANTE (React.StrictMode / efeitos assíncronos):
        // Se o componente desmontar antes do await resolver, precisamos cancelar e
        // garantir que qualquer listener criado depois seja imediatamente encerrado.
        let cancelled = false;
        let channel: { unsubscribe: () => void } | null = null;
        let ticketInterval: number | null = null;

        const pollTickets = async () => {
            if (cancelled) return;
            try {
                if (activeTabRef.current === 'tickets') return;
                const lastSeenTickets = getLastSeen('tickets');
                const tickets = await getTickets();
                if (cancelled) return;
                tickets
                    .filter(t => new Date(t.createdAt).getTime() > lastSeenTickets)
                    .forEach(t => {
                        if (notifiedTicketIdsRef.current.has(t.id)) return;
                        pushNotification({
                            id: `ticket:${t.id}`,
                            title: `Novo ticket: ${t.title}`,
                            message: t.description || 'Ticket registrado.',
                            type: 'WARNING',
                            source: 'SYSTEM',
                            date: t.createdAt,
                            read: false
                        });
                        addToast('INFO', `Novo ticket: ${t.title}`);
                        notifiedTicketIdsRef.current.add(t.id);
                    });
            } catch {}
        };

        const start = async () => {
            try {
                const created = await subscribeToMessages(currentUser.id, isAdmin, (msg) => {
                    if (msg.deleted) return;
                    if (msg.senderId === currentUser.id) return;
                    if (activeTabRef.current === 'chat') return;
                    const preview = msg.content?.trim() || (msg.mediaType ? `Mídia: ${msg.mediaType}` : 'Nova mensagem');
                    pushNotification({
                        id: `chat:${msg.id}`,
                        title: `Nova mensagem de ${msg.senderName || 'Usuário'}`,
                        message: preview,
                        type: 'INFO',
                        source: 'SYSTEM',
                        date: msg.timestamp,
                        read: false
                    });
                });

                // Se o efeito foi desmontado antes do subscribe resolver, fecha imediatamente.
                if (cancelled) {
                    created?.unsubscribe?.();
                    return;
                }
                channel = created || null;
            } catch {}

            await pollTickets();
            if (cancelled) return;
            ticketInterval = window.setInterval(() => void pollTickets(), 30000);
        };

        void start();
        return () => {
            cancelled = true;
            channel?.unsubscribe?.();
            if (ticketInterval) window.clearInterval(ticketInterval);
        };
    }, [currentUser?.id, isAdmin]);

    const handleLoginSuccess = async (user: User) => {
        setCurrentUser(user);
        try {
            console.warn("[Bootstrap] Iniciando carga inicial Firestore.", { uid: user.uid });
            await bootstrapProductionData();
            await loadDataForUser();
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => {});
            }
            await requestAndSaveToken(user.id);

            const onboarded = localStorage.getItem("sys_onboarded_v1") === "true";
            if (!onboarded) {
                setActiveTab("home");
                setAppMode("SALES");
                localStorage.setItem('sys_last_tab', 'home');
                localStorage.setItem('sys_last_mode', 'SALES');
            } else {
                const pref = user.prefs?.defaultModule || 'home';
                if (pref !== 'home') {
                    const modInfo = SYSTEM_MODULES.find(m => m.route === pref);
                    if (modInfo && canAccess(user, modInfo.key) && !isHiddenModule(user, modInfo.key)) {
                        setActiveTab(modInfo.route);
                        setAppMode(modInfo.appMode);
                        localStorage.setItem('sys_last_tab', modInfo.route);
                        localStorage.setItem('sys_last_mode', modInfo.appMode);
                    } else {
                        setActiveTab('home');
                        setAppMode('SALES');
                        localStorage.setItem('sys_last_tab', 'home');
                        localStorage.setItem('sys_last_mode', 'SALES');
                    }
                } else {
                    setActiveTab('home');
                    setAppMode('SALES');
                    localStorage.setItem('sys_last_tab', 'home');
                    localStorage.setItem('sys_last_mode', 'SALES');
                }
            }
            setAuthView('APP');
        } catch (e) {
            setAuthView('APP');
        } finally {
            console.warn("[Bootstrap] Finalizado.", { uid: user.uid });
            setLoading(false);
        }
    };

    const [sales, setSales] = useState<Sale[]>([]);
    const [salesTasks, setSalesTasks] = useState<SalesTask[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<TransactionCategory[]>([]);
    const [goals, setGoals] = useState<FinanceGoal[]>([]);
    const [receivables, setReceivables] = useState<Receivable[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [cells, setCells] = useState<ChallengeCell[]>([]);
    const [rulesBasic, setRulesBasic] = useState<CommissionRule[]>([]);
    const [rulesNatal, setRulesNatal] = useState<CommissionRule[]>([]);
    const [reportConfig, setReportConfig] = useState<ReportConfig>({
        daysForNewClient: 30, daysForInactive: 60, daysForLost: 180
    });
    const [salesTargets, setSalesTargets] = useState<SalesTargets>({ basic: 0, natal: 0 });
    const [salesLockEnabled, setSalesLockEnabled] = useState(false);
    const [dashboardConfig, setDashboardConfig] = useState<DashboardWidgetConfig>({
        showStats: true, showCharts: true, showRecents: true, showPacing: true, showBudgets: true
    });

    useEffect(() => {
        if (!currentUser?.salesTargets) return;
        setSalesTargets(currentUser.salesTargets);
    }, [currentUser?.salesTargets]);

    const filteredReceivables = useMemo(() => {
        const activeSaleIds = new Set(sales.filter(sale => !sale.deleted).map(sale => sale.id));
        return receivables.filter(r => !r.saleId || activeSaleIds.has(r.saleId));
    }, [receivables, sales]);

    const applyCampaignOverlaysToSales = async (rawSales: Sale[], cfg?: SystemConfig | null): Promise<Sale[]> => {
        const user = currentUser || getSession();
        if (!user || rawSales.length === 0) {
            Logger.info("Audit: Campanhas ignoradas por falta de usuário ou vendas.", {
                hasUser: !!user,
                salesCount: rawSales.length
            });
            return rawSales;
        }
        try {
            const config = cfg || systemConfig;
            const companyId = await resolveCompanyId(user);
            const campaigns = await getCampaignsByCompany(companyId);
            const avistaRuleEnabled = config?.avistaLowMarginRuleEnabled ?? DEFAULT_SYSTEM_CONFIG.avistaLowMarginRuleEnabled ?? true;
            const avistaRulePct = config?.avistaLowMarginCommissionPct ?? DEFAULT_SYSTEM_CONFIG.avistaLowMarginCommissionPct ?? 0.25;
            const avistaRulePayments = config?.avistaLowMarginPaymentMethods ?? DEFAULT_SYSTEM_CONFIG.avistaLowMarginPaymentMethods ?? [];
            const target = resolveMonthlyBasicBasketTarget(user);
            const months = Array.from(new Set(rawSales.map(sale => getSaleMonthKey(sale)).filter(Boolean)));
            const progressByMonth = new Map<string, Awaited<ReturnType<typeof getMonthlyBasicBasketProgress>>>();
            for (const month of months) {
                const progress = await getMonthlyBasicBasketProgress(user.uid, month, companyId, {
                    sales: rawSales,
                    targetOverride: target
                });
                progressByMonth.set(month, progress);
            }
            return rawSales.map((sale) => {
                const month = getSaleMonthKey(sale);
                if (!month) return sale;
                const baseCommission = {
                    commissionBaseTotal: sale.commissionBaseTotal,
                    commissionValueTotal: sale.commissionValueTotal,
                    commissionRateUsed: sale.commissionRateUsed
                };
                const avistaOverlay = applyAvistaLowMarginRule(sale, baseCommission, {
                    enabled: avistaRuleEnabled,
                    commissionPct: avistaRulePct,
                    paymentTypesAllowed: avistaRulePayments
                });
                if (avistaOverlay) {
                    return {
                        ...sale,
                        commissionValueTotal: avistaOverlay.commissionValueTotal,
                        commissionRateUsed: avistaOverlay.commissionRateUsed,
                        campaignTag: avistaOverlay.campaignTag,
                        campaignLabel: avistaOverlay.campaignLabel,
                        campaignMessage: avistaOverlay.campaignMessage,
                        campaignRateUsed: avistaOverlay.campaignRateUsed,
                        campaignColor: avistaOverlay.campaignColor,
                        campaignBaseCommissionValueTotal: sale.commissionValueTotal
                    };
                }

                const overlay = applyCampaignOverlay(sale, baseCommission, {
                    month,
                    campaigns,
                    goalProgress: progressByMonth.get(month)
                });
                if (!overlay) return sale;
                return {
                    ...sale,
                    commissionValueTotal: overlay.commissionValueTotal,
                    commissionRateUsed: overlay.commissionRateUsed,
                    campaignTag: overlay.campaignTag,
                    campaignLabel: overlay.campaignLabel,
                    campaignMessage: overlay.campaignMessage,
                    campaignRateUsed: overlay.campaignRateUsed,
                    campaignColor: overlay.campaignColor,
                    campaignBaseCommissionValueTotal: sale.commissionValueTotal
                };
            });
        } catch (error) {
            return rawSales;
        }
    };

    const loadDataForUser = async () => {
        try {
            const [rBasic, rNatal] = await Promise.all([
                getStoredTable(ProductType.BASICA),
                getStoredTable(ProductType.NATAL)
            ]);
            setRulesBasic(rBasic);
            setRulesNatal(rNatal);

            const [storedSales, storedTasks, storedClients, finData, sysCfg, rConfig] = await Promise.all([
                getStoredSales(),
                getSalesTasks(),
                getClients(), 
                getFinanceData(),
                getSystemConfig(),
                getReportConfig()
            ]);

            setSystemConfig(sysCfg || null);
            if (sysCfg?.theme) setTheme(sysCfg.theme);
            setSalesLockEnabled(sysCfg?.salesLockEnabled ?? DEFAULT_SYSTEM_CONFIG.salesLockEnabled ?? false);

            const salesDiagnostics = getSalesQueryDiagnostics();
            if (salesDiagnostics.indexRequired && !missingSalesIndexToastRef.current) {
                addToast('ERROR', 'Índice Firestore ausente: solicite criação do índice. Usando cache local se disponível.');
                Logger.error('Firestore: índice ausente para vendas.', {
                    collection: 'sales',
                    query: 'where userId == uid orderBy createdAt desc limit 500',
                    uid: salesDiagnostics.uid,
                    appMode
                });
                missingSalesIndexToastRef.current = true;
            }
            if (salesDiagnostics.uid && salesDiagnostics.cloudEmpty) {
                Logger.warn("Audit: Firestore retornou 0 vendas. Usando cache local.", salesDiagnostics);
                if (!emptySalesToastRef.current) {
                    addToast('ERROR', 'Nenhuma venda encontrada no Firestore. Usando dados locais (IndexedDB), se disponíveis.');
                    emptySalesToastRef.current = true;
                }
            } else {
                emptySalesToastRef.current = false;
            }
            
            const salesWithCampaigns = await applyCampaignOverlaysToSales(storedSales || [], sysCfg);
            setSales(salesWithCampaigns);
            setSalesTasks(storedTasks || []);
            setClients(storedClients || []);
            setAccounts(finData.accounts || []);
            setCards(finData.cards || []);
            setTransactions(finData.transactions || []);
            setCategories(finData.categories || []);
            setGoals(finData.goals || []);
            setReceivables(finData.receivables || []);
            setChallenges(finData.challenges || []);
            setCells(finData.cells || []);
            
            if (rConfig?.daysForLost) setReportConfig(rConfig as ReportConfig);
            if (!bootstrapLogRef.current) {
                console.warn("[Bootstrap] Dados carregados.", {
                    sales: storedSales?.length || 0,
                    clients: storedClients?.length || 0,
                    transactions: finData.transactions?.length || 0
                });
                bootstrapLogRef.current = true;
            }
        } catch (e: any) {
            console.error("[Bootstrap] Falha ao carregar dados.", { code: e?.code, message: e?.message });
        }
    };

    const persistCollection = async <T extends { id: string }>(
        table: string,
        nextItems: T[],
        prevItems: T[]
    ) => {
        const nowIso = new Date().toISOString();
        const normalized = nextItems.map(item => ({
            ...item,
            updatedAt: (item as any).updatedAt || nowIso
        }));
        await dbBulkPut(table as any, normalized as any);
        await Promise.all(
            normalized.map(item =>
                safeSetDoc(table as any, item.id, item as any, { merge: true }, item as any, 'UPDATE')
            )
        );
        const removed = prevItems.filter(prev => !normalized.some(next => next.id === prev.id));
        if (removed.length > 0) {
            await Promise.all(removed.map(item => handleSoftDelete(table, item.id)));
        }
    };

    const handleUpdateUserInApp = (user: User) => {
        setCurrentUser(user);
        localStorage.setItem('sys_session_v1', JSON.stringify(user));
    };

    const handleSetDefaultModule = async (route: string) => {
        if (!currentUser) return;
        const nextPrefs = { ...(currentUser.prefs || {}), defaultModule: route };
        const nextUser = { ...currentUser, prefs: nextPrefs };
        handleUpdateUserInApp(nextUser);
        try {
            await updateUser(currentUser.id, { prefs: nextPrefs });
            addToast('SUCCESS', 'Preferência de entrada atualizada.');
        } catch (e: any) {
            addToast('ERROR', 'Falha ao salvar preferência no servidor.');
        }
    };

    const handleBulkBill = async (ids: string[], date: string, options?: { createReceivables?: boolean }) => {
        try {
            if (salesLockEnabled) {
                addToast('INFO', 'Módulo de vendas bloqueado para alterações.');
                return;
            }
            await bulkBillSales(ids, date, options?.createReceivables ?? false);
            addToast('SUCCESS', `${ids.length} vendas faturadas${options?.createReceivables ? ' e enviadas ao financeiro' : ''}.`);
            await loadDataForUser();
        } catch (e: any) {
            addToast('ERROR', 'Falha no faturamento em lote.');
        }
    };

    const handleSaveSaleInApp = async (sale: Sale) => {
        try {
            await saveSingleSale(sale);
            await loadDataForUser();
        } catch (e: any) {
            addToast('ERROR', 'Falha ao salvar venda.');
        }
    };

    const handleDeleteSaleInApp = async (sale: Sale) => {
        try {
            await handleSoftDelete('sales', sale.id);
            await loadDataForUser();
            addToast('INFO', 'Venda movida para lixeira.');
        } catch (e: any) {
            addToast('ERROR', 'Falha ao remover venda.');
        }
    };

    const handleBulkAddSales = async (items: any[]) => {
        if (!currentUser) return;
        try {
            const nowIso = new Date().toISOString();
            const mapped = items.map((item) => {
                const type = item.type || ProductType.BASICA;
                const rules = type === ProductType.NATAL ? rulesNatal : rulesBasic;
                const margin = ensureNumber(item.marginPercent, 0);
                const { commissionBase, commissionValue, rateUsed } = computeCommissionValues(
                    ensureNumber(item.quantity, 1),
                    ensureNumber(item.valueProposed, 0),
                    margin,
                    rules
                );
                const billDate = item.date || '';
                return {
                    id: crypto.randomUUID(),
                    userId: currentUser.uid,
                    client: item.client || 'Cliente Importado',
                    quantity: ensureNumber(item.quantity, 1),
                    type,
                    status: billDate ? 'FATURADO' : 'ORÇÎAMENTO',
                    valueProposed: ensureNumber(item.valueProposed, 0),
                    valueSold: ensureNumber(item.valueSold, 0),
                    marginPercent: margin,
                    date: billDate || undefined,
                    completionDate: item.completionDate || nowIso.split('T')[0],
                    isBilled: !!billDate,
                    hasNF: false,
                    observations: item.observations || '',
                    trackingCode: item.trackingCode || '',
                    commissionBaseTotal: commissionBase,
                    commissionValueTotal: commissionValue,
                    commissionRateUsed: rateUsed,
                    createdAt: nowIso,
                    updatedAt: nowIso,
                    deleted: false,
                    paymentMethod: item.paymentMethod || ''
                } as Sale;
            });
            await saveSales(mapped);
            await loadDataForUser();
            addToast('SUCCESS', `ImportaÇõÇœo concluÇðda: ${mapped.length} vendas.`);
        } catch (e: any) {
            addToast('ERROR', 'Falha ao importar vendas.');
        }
    };

    const handleDeleteBulkSales = async (ids: string[], options?: { deleteReceivables?: boolean }) => {
        if (ids.length === 0) return;
        try {
            await Promise.all(ids.map(id => handleSoftDelete('sales', id)));
            if (options?.deleteReceivables) {
                await deleteReceivablesBySaleIds(ids);
            }
            await loadDataForUser();
            addToast('SUCCESS', `${ids.length} vendas removidas.`);
        } catch (e: any) {
            addToast('ERROR', 'Falha ao excluir vendas.');
        }
    };

    const handleBulkDateUpdate = async (
        targetDate: string,
        filterType: ProductType | 'ALL',
        launchDateFrom: string,
        onlyEmpty: boolean
    ) => {
        const eligible = sales.filter((sale) => {
            if (sale.deleted) return false;
            if (filterType !== 'ALL' && sale.type !== filterType) return false;
            const compDate = sale.completionDate || sale.date || '';
            if (launchDateFrom && compDate < launchDateFrom) return false;
            if (onlyEmpty && sale.date) return false;
            return true;
        });
        if (!eligible.length) {
            addToast('INFO', 'Nenhuma venda encontrada para atualizar.');
            return;
        }
        await handleBulkBill(eligible.map((s) => s.id), targetDate, { createReceivables: false });
        setIsBulkDateModalOpen(false);
    };

    const handleRecalculateSales = async (
        includeBilled: boolean,
        filterType: ProductType | 'ALL',
        dateFrom: string,
        dateTo?: string
    ) => {
        if (salesLockEnabled) {
            addToast('INFO', 'MИdulo de vendas bloqueado para alteraВリes.');
            return;
        }
        const nowIso = new Date().toISOString();
        const updated = sales.map((sale) => {
            if (sale.deleted) return sale;
            if (!includeBilled && sale.date) return sale;
            if (filterType !== 'ALL' && sale.type !== filterType) return sale;
            const compDate = sale.date || sale.completionDate || '';
            if (dateFrom && compDate < dateFrom) return sale;
            if (dateTo && compDate > dateTo) return sale;
            const rules = sale.type === ProductType.NATAL ? rulesNatal : rulesBasic;
            const { commissionBase, commissionValue, rateUsed } = computeCommissionValues(
                ensureNumber(sale.quantity, 1),
                ensureNumber(sale.valueProposed, 0),
                ensureNumber(sale.marginPercent, 0),
                rules
            );
            return {
                ...sale,
                commissionBaseTotal: commissionBase,
                commissionValueTotal: commissionValue,
                commissionRateUsed: rateUsed,
                updatedAt: nowIso
            } as Sale;
        });
        await saveSales(updated);
        await loadDataForUser();
        addToast('SUCCESS', 'Recalculo aplicado.');
    };

    const handleCreateSalesTask = async (sale: Sale, type: SalesTaskType, dueDate: string) => {
        if (salesLockEnabled) {
            addToast('INFO', 'Módulo de vendas bloqueado para alterações.');
            return;
        }
        if (!currentUser) return;
        const task: SalesTask = {
            id: crypto.randomUUID(),
            userId: currentUser.uid,
            saleId: sale.id,
            saleClient: sale.client,
            type,
            dueDate,
            status: 'OPEN',
            createdAt: new Date().toISOString()
        };
        try {
            await saveSalesTask(task);
            await loadDataForUser();
            addToast('SUCCESS', 'Pendência criada com sucesso.');
            await sendMessage(
                currentUser,
                `📌 Nova pendência criada: ${sale.client} • ${SALES_TASK_LABELS[type]} • Prazo ${new Date(dueDate).toLocaleDateString('pt-BR')}`,
                'SYSTEM',
                'ADMIN',
                undefined,
                'sales'
            );
        } catch (e: any) {
            Logger.error('Auditoria: Falha ao criar pendência.', { error: e?.message });
            addToast('ERROR', 'Erro ao criar pendência.');
        }
    };

    const handleUpdateSalesTask = async (task: SalesTask) => {
        if (salesLockEnabled) {
            addToast('INFO', 'Módulo de vendas bloqueado para alterações.');
            return;
        }
        try {
            await saveSalesTask(task);
            await loadDataForUser();
            addToast('SUCCESS', 'Pendência atualizada.');
        } catch (e: any) {
            Logger.error('Auditoria: Falha ao atualizar pendência.', { error: e?.message });
            addToast('ERROR', 'Erro ao atualizar pendência.');
        }
    };

    const handleUpdateSalesTargets = async (targets: SalesTargets) => {
        if (!currentUser) return;
        const nextUser = { ...currentUser, salesTargets: targets };
        handleUpdateUserInApp(nextUser);
        try {
            await updateUser(currentUser.id, { salesTargets: targets });
            addToast('SUCCESS', 'Meta atualizada.');
        } catch (e: any) {
            addToast('ERROR', 'Falha ao salvar meta.');
        }
    };

    const handleUpdateSalesInApp = async (nextSales: Sale[]) => {
        await saveSales(nextSales);
        await loadDataForUser();
    };

    const handleUpdateFinanceCategories = async (nextCategories: TransactionCategory[]) => {
        await persistCollection('categories', nextCategories, categories);
        setCategories(nextCategories);
    };

    const handleUpdateFinanceGoals = async (nextGoals: FinanceGoal[]) => {
        await persistCollection('goals', nextGoals, goals);
        setGoals(nextGoals);
    };

    const handleUpdateFinanceChallenges = async (nextChallenges: Challenge[], nextCells: ChallengeCell[]) => {
        await persistCollection('challenges', nextChallenges, challenges);
        await persistCollection('challenge_cells', nextCells, cells);
        setChallenges(nextChallenges);
        setCells(nextCells);
    };

    const handleUpdateFinanceReceivables = async (nextReceivables: Receivable[]) => {
        await persistCollection('receivables', nextReceivables, receivables);
        setReceivables(nextReceivables);
    };

    const handleUpdateFinanceManager = async (
        nextAccounts: FinanceAccount[],
        nextTransactions: Transaction[],
        nextCards: CreditCard[]
    ) => {
        await persistCollection('accounts', nextAccounts, accounts);
        await persistCollection('transactions', nextTransactions, transactions);
        await persistCollection('cards', nextCards, cards);
        setAccounts(nextAccounts);
        setTransactions(nextTransactions);
        setCards(nextCards);
    };

    const handlePayInvoice = async (cardId: string, accountId: string, amount: number, date: string) => {
        const nowIso = new Date().toISOString();
        const paidCardTxs = transactions.map((tx) => {
            if (tx.cardId === cardId && !tx.isPaid && tx.type === 'EXPENSE') {
                return { ...tx, isPaid: true, realizedAt: date, updatedAt: nowIso } as Transaction;
            }
            return tx;
        });
        const paymentTx: Transaction = {
            id: crypto.randomUUID(),
            description: 'Pagamento de fatura',
            amount,
            type: 'EXPENSE',
            date,
            realizedAt: date,
            categoryId: 'CARD_PAYMENT',
            accountId,
            isPaid: true,
            provisioned: false,
            isRecurring: false,
            deleted: false,
            createdAt: nowIso,
            updatedAt: nowIso,
            userId: currentUser?.uid || '',
            paymentMethod: 'CARD_PAYMENT'
        };
        const nextTransactions = [...paidCardTxs, paymentTx];
        const nextAccounts = accounts.map((acc) =>
            acc.id === accountId ? { ...acc, balance: acc.balance - amount, updatedAt: nowIso } : acc
        );
        await persistCollection('transactions', nextTransactions, transactions);
        await persistCollection('accounts', nextAccounts, accounts);
        setTransactions(nextTransactions);
        setAccounts(nextAccounts);
        addToast('SUCCESS', 'Fatura registrada.');
    };

    const handleSetTransactionPaid = async (
        transaction: Transaction,
        details: { accountId: string; amount: number; date: string; attachments?: string[] }
    ) => {
        const nowIso = new Date().toISOString();
        const updatedTx = {
            ...transaction,
            accountId: details.accountId,
            realizedAt: details.date,
            isPaid: true,
            attachments: details.attachments || transaction.attachments,
            updatedAt: nowIso
        } as Transaction;
        const nextTransactions = transactions.map((tx) => (tx.id === transaction.id ? updatedTx : tx));
        const nextAccounts = accounts.map((acc) => {
            if (acc.id !== details.accountId) return acc;
            if (transaction.type === 'INCOME') return { ...acc, balance: acc.balance + details.amount, updatedAt: nowIso };
            if (transaction.type === 'EXPENSE') return { ...acc, balance: acc.balance - details.amount, updatedAt: nowIso };
            return acc;
        });
        await persistCollection('transactions', nextTransactions, transactions);
        await persistCollection('accounts', nextAccounts, accounts);
        setTransactions(nextTransactions);
        setAccounts(nextAccounts);
    };

    const handleDeleteTransaction = async (id: string) => {
        await handleSoftDelete('transactions', id);
        await loadDataForUser();
    };

    const handleDistributeReceivable = async (receivableId: string, distributions: { accountId: string; value: number }[]) => {
        const nowIso = new Date().toISOString();
        const nextReceivables = receivables.map((rec) =>
            rec.id === receivableId ? { ...rec, distributed: true, updatedAt: nowIso } : rec
        );
        const nextAccounts = accounts.map((acc) => {
            const dist = distributions.find((d) => d.accountId === acc.id);
            if (!dist) return acc;
            return { ...acc, balance: acc.balance + dist.value, updatedAt: nowIso };
        });
        await persistCollection('receivables', nextReceivables, receivables);
        await persistCollection('accounts', nextAccounts, accounts);
        setReceivables(nextReceivables);
        setAccounts(nextAccounts);
        addToast('SUCCESS', 'DistribuiÇõÇœo registrada.');
    };

    const handleSaveTransactionInApp = async (tx: Transaction) => {
        const nowIso = new Date().toISOString();
        const nextTransactions = [...transactions, { ...tx, updatedAt: nowIso }];
        let nextAccounts = accounts;
        if (tx.isPaid) {
            nextAccounts = accounts.map((acc) => {
                if (tx.type === 'TRANSFER') {
                    if (acc.id === tx.accountId) return { ...acc, balance: acc.balance - tx.amount, updatedAt: nowIso };
                    if (acc.id === tx.targetAccountId) return { ...acc, balance: acc.balance + tx.amount, updatedAt: nowIso };
                    return acc;
                }
                if (acc.id !== tx.accountId) return acc;
                if (tx.type === 'INCOME') return { ...acc, balance: acc.balance + tx.amount, updatedAt: nowIso };
                if (tx.type === 'EXPENSE') return { ...acc, balance: acc.balance - tx.amount, updatedAt: nowIso };
                return acc;
            });
        }
        await persistCollection('transactions', nextTransactions, transactions);
        if (nextAccounts !== accounts) {
            await persistCollection('accounts', nextAccounts, accounts);
        }
        setTransactions(nextTransactions);
        setAccounts(nextAccounts);
    };

    const navigateTo = (tab: string, mode?: AppMode) => {
        if (mode) {
            setAppMode(mode);
            localStorage.setItem('sys_last_mode', mode);
        }
        setActiveTab(tab);
        localStorage.setItem('sys_last_tab', tab);
    };

    const renderActiveTab = () => {
        if (!currentUser) return null;
        switch (activeTab) {
            case 'home':
                return (
                    <HomeDashboard
                        sales={sales}
                        salesTasks={salesTasks}
                        transactions={transactions}
                        receivables={filteredReceivables}
                        accounts={accounts}
                        hideValues={hideValues}
                        onToggleHide={toggleHideValues}
                        onNavigate={navigateTo}
                        currentUser={currentUser}
                        onSetDefaultModule={handleSetDefaultModule}
                        darkMode={isDarkMode}
                        onNotify={addToast}
                    />
                );
            case 'dashboard':
                return (
                    <Dashboard
                        sales={sales}
                        salesTasks={salesTasks}
                        onNewSale={() => setShowSalesForm(true)}
                        darkMode={isDarkMode}
                        hideValues={hideValues}
                        config={dashboardConfig}
                        onToggleHide={toggleHideValues}
                        onUpdateConfig={setDashboardConfig}
                        currentUser={currentUser}
                        salesTargets={salesTargets}
                        onUpdateTargets={handleUpdateSalesTargets}
                        isAdmin={isAdmin}
                        isDev={isDev}
                    />
                );
            case 'sales':
                return (
                    <SalesList
                        sales={sales}
                        onEdit={(sale) => {
                            setEditingSale(sale);
                            setShowSalesForm(true);
                        }}
                        onDelete={handleDeleteSaleInApp}
                        onNew={() => setShowSalesForm(true)}
                        onExportTemplate={() => {}}
                        onClearAll={async () => {
                            await clearAllSales();
                            setSales([]);
                            addToast('INFO', 'Cache local de vendas limpo.');
                        }}
                        onRestore={() => setIsBackupModalOpen(true)}
                        onOpenBulkAdvanced={() => setIsBulkDateModalOpen(true)}
                        onBillBulk={handleBulkBill}
                        onDeleteBulk={handleDeleteBulkSales}
                        onBulkAdd={handleBulkAddSales}
                        onCreateTask={handleCreateSalesTask}
                        onRecalculate={handleRecalculateSales}
                        onNotify={addToast}
                        darkMode={isDarkMode}
                        isLocked={salesLockEnabled}
                    />
                );
            case 'pendencias':
                return (
                    <BoletoControl
                        sales={sales}
                        tasks={salesTasks}
                        onUpdateTask={handleUpdateSalesTask}
                        isLocked={salesLockEnabled}
                    />
                );
            case 'commissions':
                return (
                    <SettingsHub
                        rulesBasic={rulesBasic}
                        rulesNatal={rulesNatal}
                        reportConfig={reportConfig}
                        onSaveRules={handleSaveCommissionRulesInApp}
                        onSaveReportConfig={handleSaveReportConfigInApp}
                        darkMode={isDarkMode}
                        onThemeChange={setTheme}
                        currentUser={currentUser}
                        onUpdateUser={handleUpdateUserInApp}
                        sales={sales}
                        onUpdateSales={handleUpdateSalesInApp}
                        onNotify={addToast}
                        isAdmin={isAdmin}
                        isDev={isDev}
                        onLogout={handleLogout}
                        initialTab="COMMISSIONS"
                        appMode={appMode}
                    />
                );
            case 'campaigns':
                return <Campaigns currentUser={currentUser} darkMode={isDarkMode} onNotify={addToast} />;
            case 'clients_hub':
                return <ClientManagementHub currentUser={currentUser} darkMode={isDarkMode} />;
            case 'tickets':
                return <TicketsManager currentUser={currentUser} darkMode={isDarkMode} isAdmin={isAdmin} />;
            case 'chat':
                return (
                    <InternalChatSystem
                        currentUser={currentUser}
                        isOpen={true}
                        onClose={() => navigateTo('home')}
                        darkMode={isDarkMode}
                        onNotify={addToast}
                    />
                );
            case 'settings':
                return (
                    <SettingsHub
                        rulesBasic={rulesBasic}
                        rulesNatal={rulesNatal}
                        reportConfig={reportConfig}
                        onSaveRules={handleSaveCommissionRulesInApp}
                        onSaveReportConfig={handleSaveReportConfigInApp}
                        darkMode={isDarkMode}
                        onThemeChange={setTheme}
                        currentUser={currentUser}
                        onUpdateUser={handleUpdateUserInApp}
                        sales={sales}
                        onUpdateSales={handleUpdateSalesInApp}
                        onNotify={addToast}
                        isAdmin={isAdmin}
                        isDev={isDev}
                        onLogout={handleLogout}
                        appMode={appMode}
                    />
                );
            case 'dev_roadmap':
                return <DevRoadmap />;
            case 'fin_dashboard':
                return (
                    <FinanceDashboard
                        accounts={accounts}
                        transactions={transactions}
                        cards={cards}
                        receivables={filteredReceivables}
                        sales={sales}
                        goals={goals}
                        darkMode={isDarkMode}
                        hideValues={hideValues}
                        config={dashboardConfig}
                        onToggleHide={toggleHideValues}
                        onUpdateConfig={setDashboardConfig}
                        onNavigate={(tab) => navigateTo(tab, 'FINANCE')}
                    />
                );
            case 'fin_transactions':
                return (
                    <FinanceTransactionsList
                        transactions={transactions}
                        accounts={accounts}
                        categories={categories}
                        onDelete={handleDeleteTransaction}
                        onPay={handleSetTransactionPaid}
                        darkMode={isDarkMode}
                    />
                );
            case 'fin_receivables':
                return (
                    <FinanceReceivables
                        receivables={filteredReceivables}
                        onUpdate={handleUpdateFinanceReceivables}
                        sales={sales}
                        accounts={accounts}
                        darkMode={isDarkMode}
                    />
                );
            case 'fin_distribution':
                return (
                    <FinanceDistribution
                        receivables={filteredReceivables}
                        accounts={accounts}
                        onDistribute={handleDistributeReceivable}
                        darkMode={isDarkMode}
                    />
                );
            case 'fin_manager':
                return (
                    <FinanceManager
                        accounts={accounts}
                        cards={cards}
                        transactions={transactions}
                        onUpdate={handleUpdateFinanceManager}
                        onPayInvoice={handlePayInvoice}
                        darkMode={isDarkMode}
                        onNotify={addToast}
                    />
                );
            case 'fin_categories':
                return <FinanceCategories categories={categories} onUpdate={handleUpdateFinanceCategories} darkMode={isDarkMode} />;
            case 'fin_goals':
                return <FinanceGoals goals={goals} onUpdate={handleUpdateFinanceGoals} darkMode={isDarkMode} />;
            case 'fin_challenges':
                return (
                    <FinanceChallenges
                        challenges={challenges}
                        cells={cells}
                        onUpdate={handleUpdateFinanceChallenges}
                        darkMode={isDarkMode}
                    />
                );
            default:
                return null;
        }
    };

    if (loading) return <LoadingScreen />;
    if (authView === 'LOGIN') return <Login onLoginSuccess={handleLoginSuccess} onRequestReset={() => setAuthView('REQUEST_RESET')} />;
    if (authView === 'REQUEST_RESET') return <RequestReset onBack={() => setAuthView('LOGIN')} />;
    if (authView === 'ERROR') return <div className="p-20 text-center text-red-500 font-bold">{authError}</div>;

    if (authView === 'BLOCKED') {
        return (
            <div className="h-screen bg-[#020617] flex items-center justify-center p-6 text-center animate-in fade-in">
                <div className="bg-slate-900 border-2 border-red-500/50 p-10 rounded-[3rem] shadow-[0_20px_50px_rgba(239,68,68,0.2)] max-w-sm w-full">
                    <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-500">
                        <ShieldAlert size={40} className="animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Acesso Bloqueado</h2>
                    <p className="text-slate-400 text-sm mb-8 font-medium">Sua licença de uso está inativa.</p>
                    <button onClick={handleLogout} className="w-full py-4 bg-slate-800 hover:bg-red-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all uppercase text-[10px] tracking-widest">
                        <LogOut size={16}/> Sair do Sistema
                    </button>
                </div>
            </div>
        );
    }

    return (
        <Layout 
            activeTab={activeTab} 
            setActiveTab={(t) => { setActiveTab(t); localStorage.setItem('sys_last_tab', t); }} 
            appMode={appMode} 
            setAppMode={(m) => { setAppMode(m); localStorage.setItem('sys_last_mode', m); }} 
            darkMode={true}
            currentTheme={theme}
            setTheme={setTheme}
            currentUser={currentUser!}
            onLogout={handleLogout}
            onNewSale={() => setShowSalesForm(true)}
            onNewIncome={() => { setTxFormType('INCOME'); setShowTxForm(true); }}
            onNewExpense={() => { setTxFormType('EXPENSE'); setShowTxForm(true); }}
            onNewTransfer={() => { setTxFormType('TRANSFER'); setShowTxForm(true); }}
            isAdmin={isAdmin}
            isDev={isDev}
            showSnow={showSnow}
            onToggleSnow={() => { setShowSnow(!showSnow); localStorage.setItem('sys_snow_enabled', String(!showSnow)); }}
            notifications={notifications}
            onClearAllNotifications={handleClearAllNotifications}
            onNotify={addToast}
        >
            <Suspense fallback={<ModuleLoader />}>
                {renderActiveTab()}
            </Suspense>

            <Suspense fallback={null}>
                <SalesForm
                    isOpen={showSalesForm}
                    onClose={() => {
                        setShowSalesForm(false);
                        setEditingSale(null);
                    }}
                    onSaved={loadDataForUser}
                    onSave={handleSaveSaleInApp}
                    initialData={editingSale}
                    isLocked={salesLockEnabled}
                    rulesBasic={rulesBasic}
                    rulesNatal={rulesNatal}
                />
                <FinanceTransactionForm
                    isOpen={showTxForm}
                    onClose={() => setShowTxForm(false)}
                    onSaved={loadDataForUser}
                    onSave={handleSaveTransactionInApp}
                    accounts={accounts}
                    cards={cards}
                    categories={categories}
                    initialType={txFormType}
                />
                <BackupModal
                    isOpen={isBackupModalOpen}
                    mode="BACKUP"
                    onClose={() => setIsBackupModalOpen(false)}
                    onSuccess={() => {}}
                />
                <BulkDateModal
                    isOpen={isBulkDateModalOpen}
                    onClose={() => setIsBulkDateModalOpen(false)}
                    onConfirm={handleBulkDateUpdate}
                    darkMode={isDarkMode}
                />
            </Suspense>

            {currentUser && (
                <ReportBugModal
                    isOpen={bugModalOpen}
                    onClose={() => setBugModalOpen(false)}
                    currentUser={currentUser}
                    darkMode={['glass', 'cyberpunk', 'dark'].includes(theme)}
                />
            )}

            {bugPrompt && (
                <div className="fixed bottom-6 right-6 z-[120] max-w-sm w-full">
                    <div className={`rounded-2xl border shadow-2xl p-4 flex flex-col gap-3 ${['glass', 'cyberpunk', 'dark'].includes(theme) ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                        <div className="text-xs font-black uppercase tracking-widest text-red-500">Instabilidade detectada</div>
                        <p className="text-sm leading-relaxed">
                            {bugPrompt.message}
                        </p>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => setBugPrompt(null)}
                                className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-700"
                            >
                                Agora não
                            </button>
                            <button
                                onClick={() => {
                                    setBugPrompt(null);
                                    setBugModalOpen(true);
                                }}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20"
                            >
                                Reportar bug
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ToastContainer toasts={toasts} removeToast={removeToast} />
            {showSnow && <SnowOverlay />}

            {/* ✅ Vercel Analytics (Vite/React) */}
            <Analytics />
            <SpeedInsights />
        </Layout>
    );
};

export default App;
