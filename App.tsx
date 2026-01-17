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

// Importação Dinâmica
const SalesForm = lazy(() => import('./components/SalesForm'));
const SalesList = lazy(() => import('./components/SalesList'));
const BoletoControl = lazy(() => import('./components/BoletoControl'));
const FinanceDashboard = lazy(() => import('./components/FinanceDashboard'));
const FinanceTransactionsList = lazy(() => import('./components/FinanceTransactionsList'));
const FinanceTransactionForm = lazy(() => import('./components/FinanceTransactionForm'));
const FinanceReceivables = lazy(() => import('./components/FinanceReceivables'));
const FinanceDistribution = lazy(() => import('./components/FinanceDistribution'));
const FinanceManager = lazy(() => import('./components/FinanceManager'));
const FinanceCategories = lazy(() => import('./components/FinanceCategories'));
const FinanceGoals = lazy(() => import('./components/FinanceGoals'));
const FinanceChallenges = lazy(() => import('./components/FinanceChallenges'));
const SettingsHub = lazy(() => import('./components/SettingsHub'));
const DevRoadmap = lazy(() => import('./components/DevRoadmap'));
const BackupModal = lazy(() => import('./components/BackupModal'));
const BulkDateModal = lazy(() => import('./components/BulkDateModal'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const CommissionEditor = lazy(() => import('./components/CommissionEditor'));
const ClientManagementHub = lazy(() => import('./components/ClientManagementHub'));
const TicketsManager = lazy(() => import('./components/TicketsManager'));
const Campaigns = lazy(() => import('./components/Campaigns'));

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
    canAccess, handleSoftDelete, clearNotifications, bulkBillSales, DEFAULT_SYSTEM_CONFIG, saveSales, deleteReceivablesBySaleIds, getSalesTasks, getSalesQueryDiagnostics
} from './services/logic';
import { applyAvistaLowMarginRule, applyCampaignOverlay } from './services/commissionCampaignOverlay';
import {
    getCampaignsByCompany,
    getMonthlyBasicBasketProgress,
    getSaleMonthKey,
    resolveCompanyId,
    resolveMonthlyBasicBasketTarget
} from './services/campaignService';

import { reloadSession, logout, getSession } from './services/auth';
import { AudioService } from './services/audioService';
import { Logger } from './services/logger';
import { startSyncWorker } from './services/syncWorker';
import { sendMessage } from './services/internalChat';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { SALES_TASK_LABELS } from './utils/salesTasks';

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
    const syncWorkerStopRef = useRef<(() => void) | null>(null);
    const emptySalesToastRef = useRef(false);
    const missingSalesIndexToastRef = useRef(false);
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
    const [hideValues, setHideValues] = useState(false);
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

    const addToast = (type: 'SUCCESS' | 'ERROR' | 'INFO', message: string) => {
        const id = crypto.randomUUID();
        setSortedToasts(prev => [...prev, { id, type, message }]);
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

    const removeToast = (id: string) => {
        setSortedToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleClearAllNotifications = async () => {
        if (!currentUser) return;
        setNotifications([]);
        if (isAdmin) {
            await clearNotifications(currentUser.id, 'ALL');
            addToast('INFO', 'Histórico de notificações limpo para toda a rede.');
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
            syncWorkerStopRef.current = startSyncWorker();
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
        const init = async () => {
            try {
                await AudioService.preload();
                const sessionUser = await reloadSession();
                if (sessionUser) {
                    if (!sessionUser.isActive || sessionUser.userStatus === 'INACTIVE') {
                        setAuthView('BLOCKED');
                        setLoading(false);
                    } else {
                        await handleLoginSuccess(sessionUser);
                    }
                } else {
                    setAuthView('LOGIN');
                    setLoading(false);
                }
            } catch (e: any) {
                setAuthError("Erro na conexão Cloud Firestore.");
                setAuthView('ERROR');
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleLoginSuccess = async (user: User) => {
        setCurrentUser(user);
        try {
            await bootstrapProductionData();
            await loadDataForUser();

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

    const applyCampaignOverlaysToSales = async (rawSales: Sale[]): Promise<Sale[]> => {
        const user = currentUser || getSession();
        if (!user || rawSales.length === 0) {
            Logger.info("Audit: Campanhas ignoradas por falta de usuário ou vendas.", {
                hasUser: !!user,
                salesCount: rawSales.length
            });
            return rawSales;
        }
        try {
            const companyId = await resolveCompanyId(user);
            const campaigns = await getCampaignsByCompany(companyId);
            const avistaRuleEnabled = systemConfig?.avistaLowMarginRuleEnabled ?? DEFAULT_SYSTEM_CONFIG.avistaLowMarginRuleEnabled ?? true;
            const avistaRulePct = systemConfig?.avistaLowMarginCommissionPct ?? DEFAULT_SYSTEM_CONFIG.avistaLowMarginCommissionPct ?? 0.25;
            const avistaRulePayments = systemConfig?.avistaLowMarginPaymentMethods ?? DEFAULT_SYSTEM_CONFIG.avistaLowMarginPaymentMethods ?? [];
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
        } catch (e) {}
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
            onNewIncome={() => setShowTxForm(true)}
            onNewExpense={() => setShowTxForm(true)}
            onNewTransfer={() => setShowTxForm(true)}
            isAdmin={isAdmin}
            isDev={isDev}
            showSnow={showSnow}
            onToggleSnow={() => { setShowSnow(!showSnow); localStorage.setItem('sys_snow_enabled', String(!showSnow)); }}
            notifications={notifications}
            onClearAllNotifications={handleClearAllNotifications}
            onNotify={addToast}
        >
            <Suspense fallback={<ModuleLoader />}>
                {/* ... seu conteúdo continua igual ... */}
            </Suspense>

            <Suspense fallback={null}>
                {/* ... seus modais continuam igual ... */}
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
        </Layout>
    );
};

export default App;
