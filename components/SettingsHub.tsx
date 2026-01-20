
import React, { useState, useEffect, useRef } from 'react';
import { CommissionRule, ProductType, ReportConfig, SystemConfig, AppTheme, User, Sale, AudioType, SalesTargets, UserPermissions, AppMode } from '../types';
import CommissionEditor from './CommissionEditor';
import ClientManagementHub from './ClientManagementHub';
import { Settings as SettingsIcon, Shield, Volume2, Trash2, User as UserIcon, Activity, Hammer, X, ArrowLeft, Users, Save, Bell, Terminal, Eraser, BookOpen, ToggleLeft, ToggleRight, Layout, Info, HardDrive, ShieldAlert, Download, Bug, CheckCircle, AlertTriangle, DollarSign, FlaskConical, Cpu, KeyRound, Eye, EyeOff, Layers } from 'lucide-react';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import { getSystemConfig, saveSystemConfig, DEFAULT_SYSTEM_CONFIG, canAccess, resetSalesToSoftDeletedSeed } from '../services/logic';
import { fileToBase64 } from '../utils/fileHelper';
import { Logger } from '../services/logger';
import BackupModal from './BackupModal';
import UserProfile from './UserProfile';
import AdminUsers from './AdminUsers';
import AdminWebhooks from './AdminWebhooks';
import DevRoadmap from './DevRoadmap';
import TrashBin from './TrashBin'; 
import AdminMessaging from './AdminMessaging';
import AuditLogExplorer from './AuditLogExplorer';
import ReportBugModal from './ReportBugModal';
import { SYSTEM_MODULES, isModuleEnabled } from '../config/modulesCatalog';
import { updateUser } from '../services/auth';
import { runSyncDiagnostics, SyncDiagnosticsResult } from '../services/syncDiagnostics';
import { applyAvistaLowMarginRule, applyCampaignOverlay } from '../services/commissionCampaignOverlay';
import { getCampaignsByCompany, getMonthlyBasicBasketProgress, getSaleMonthKey, resolveCompanyId, resolveMonthlyBasicBasketTarget } from '../services/campaignService';

interface SettingsHubProps {
  rulesBasic: CommissionRule[];
  rulesNatal: CommissionRule[];
  reportConfig: ReportConfig;
  onSaveRules: (type: ProductType, rules: CommissionRule[]) => void;
  onSaveReportConfig: (config: ReportConfig) => void;
  darkMode?: boolean;
  onThemeChange?: (theme: AppTheme) => void;
  currentUser: User;
  onUpdateUser: (user: User) => void;
  sales: Sale[]; 
  onUpdateSales: (sales: Sale[]) => void;
  onNotify: (type: 'SUCCESS' | 'ERROR' | 'INFO', msg: string) => void; 
  isAdmin: boolean;
  isDev: boolean;
  onLogout: () => void;
  appMode: AppMode;
  initialTab?: 'PROFILE' | 'SYSTEM' | 'USERS' | 'WEBHOOKS' | 'COMMISSIONS' | 'ROADMAP' | 'SOUNDS' | 'TRASH' | 'CLIENTS' | 'MESSAGING' | 'LOGS' | 'AUDIT_FULL' | 'ACCESS' | 'DEVTOOLS' | 'AI_BI';
}

interface CampaignSimulationRow {
  id: string;
  margin: number;
  baseCommissionValueTotal: number;
  overlayCommissionValueTotal: number;
  campaignTag: string;
  campaignLabel: string;
  campaignMessage: string;
  campaignColor: string;
  applied: boolean;
}

const SettingsHub: React.FC<SettingsHubProps> = ({ 
  rulesBasic, rulesNatal, reportConfig, onSaveRules, onSaveReportConfig,
  darkMode, onThemeChange, currentUser, onUpdateUser, sales, onUpdateSales, onNotify,
  isAdmin, isDev, onLogout, initialTab, appMode
}) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SYSTEM' | 'USERS' | 'WEBHOOKS' | 'COMMISSIONS' | 'ROADMAP' | 'SOUNDS' | 'TRASH' | 'CLIENTS' | 'MESSAGING' | 'LOGS' | 'AUDIT_FULL' | 'ACCESS' | 'DEVTOOLS' | 'AI_BI'>(initialTab || 'PROFILE');
  const [commissionTab, setCommissionTab] = useState<ProductType>(ProductType.BASICA); 
  const [showMobileContent, setShowMobileContent] = useState(false);
  const [logExporting, setLogExporting] = useState(false);
  const [logStatus, setLogStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [bugModalOpen, setBugModalOpen] = useState(false);
  
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [showBackupModal, setShowBackupModal] = useState(false);

  const [notificationSound, setNotificationSound] = useState('');
  const [alertSound, setAlertSound] = useState('');
  const [successSound, setSuccessSound] = useState('');
  const [warningSound, setWarningSound] = useState('');
  const [paymentMethodInput, setPaymentMethodInput] = useState('');
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(1);
  const [uploadingFor, setUploadingFor] = useState<AudioType | 'GENERAL'>('GENERAL');
  
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [syncResults, setSyncResults] = useState<SyncDiagnosticsResult[] | null>(null);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [devHiddenModules, setDevHiddenModules] = useState<Partial<UserPermissions>>({});
  const [devPermissions, setDevPermissions] = useState<UserPermissions>(currentUser.permissions);
  const [devSalesTargets, setDevSalesTargets] = useState<SalesTargets>(currentUser.salesTargets || { basic: 0, natal: 0 });
  const [devSaving, setDevSaving] = useState(false);
  const [campaignSimulation, setCampaignSimulation] = useState<CampaignSimulationRow[]>([]);
  const [campaignRunning, setCampaignRunning] = useState(false);

  const [aiProvider, setAiProvider] = useState<'OPENAI' | 'GEMINI'>('OPENAI');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [biEnabled, setBiEnabled] = useState(true);
  const [showAiKey, setShowAiKey] = useState(false);

  const handleResetSales = async () => {
    if (!isDev) {
      onNotify('ERROR', 'Apenas DEV pode executar este reset.');
      return;
    }
    const resetPassword = import.meta.env.VITE_RESET_SALES_PASSWORD as string | undefined;
    if (!resetPassword) {
      onNotify('ERROR', 'Senha de reset nao configurada no .env.');
      return;
    }
    const password = window.prompt('Digite a senha de reset para continuar.');
    if (!password || password !== resetPassword) {
      onNotify('ERROR', 'Senha invalida.');
      return;
    }
    const token = window.prompt('Digite RESETAR para apagar todas as vendas e manter apenas um seed inativo.');
    if (token !== 'RESETAR') return;
    const confirmed = window.confirm('Ultima confirmacao: deseja apagar vendas, clientes e dependencias?');
    if (!confirmed) return;
    try {
      await resetSalesToSoftDeletedSeed();
      onUpdateSales([]);
      onNotify('SUCCESS', 'Vendas resetadas. Apenas o seed inativo foi mantido.');
    } catch (e: any) {
      onNotify('ERROR', 'Falha ao resetar vendas. Verifique permissoes.');
    }
  };

  useEffect(() => {
      const loadConfig = async () => {
          try {
              const cfg = await getSystemConfig();
              if (!cfg) return;

              setSystemConfig({
                  ...DEFAULT_SYSTEM_CONFIG,
                  ...cfg,
                  modules: { ...DEFAULT_SYSTEM_CONFIG.modules, ...cfg.modules }
              });
              
              if (cfg.notificationSounds) {
                  setNotificationSound(cfg.notificationSound || cfg.notificationSounds.sound || '');
                  setSoundEnabled(!!cfg.notificationSounds.enabled);
                  setSoundVolume(cfg.notificationSounds.volume ?? 1);
              } else {
                  setNotificationSound(cfg.notificationSound || '');
              }
              setAlertSound(cfg.alertSound || '');
              setSuccessSound(cfg.successSound || '');
              setWarningSound(cfg.warningSound || '');
          } catch (err) {
              console.error("[SettingsHub] Failed to load config", err);
          }
      };
      loadConfig();
  }, []);

  useEffect(() => {
      try {
          const raw = localStorage.getItem('sys_ai_settings_v1');
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (parsed?.provider) setAiProvider(parsed.provider);
          if (typeof parsed?.apiKey === 'string') setAiApiKey(parsed.apiKey);
          if (typeof parsed?.aiEnabled === 'boolean') setAiEnabled(parsed.aiEnabled);
          if (typeof parsed?.biEnabled === 'boolean') setBiEnabled(parsed.biEnabled);
      } catch {}
  }, []);

  useEffect(() => {
      const baseHidden = SYSTEM_MODULES.reduce((acc, mod) => ({ ...acc, [mod.key]: false }), {} as Partial<UserPermissions>);
      setDevHiddenModules({ ...baseHidden, ...(currentUser.hiddenModules || {}) });
      setDevPermissions({ ...currentUser.permissions });
      setDevSalesTargets(currentUser.salesTargets || { basic: 0, natal: 0 });
  }, [currentUser]);

  useEffect(() => {
      if (initialTab) {
          setActiveTab(initialTab);
          setShowMobileContent(true);
      }
  }, [initialTab]);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const base64 = await fileToBase64(file);
          if (uploadingFor === 'GENERAL' || uploadingFor === 'NOTIFICATION') setNotificationSound(base64);
          else if (uploadingFor === 'ALERT') setAlertSound(base64);
          else if (uploadingFor === 'SUCCESS') setSuccessSound(base64);
          else if (uploadingFor === 'WARNING') setWarningSound(base64);

          onNotify('SUCCESS', 'Som carregado com sucesso!');
      } catch (err) {
          onNotify('ERROR', 'Erro ao processar áudio.');
      }
      if (audioInputRef.current) audioInputRef.current.value = '';
  };

  const openUpload = (type: AudioType | 'GENERAL') => {
      setUploadingFor(type);
      audioInputRef.current?.click();
  };

  const handleClearLogs = async () => {
      if (confirm("Deseja apagar todos os logs de auditoria locais? Esta ação não afeta os logs na nuvem.")) {
          await Logger.clearLogs();
          onNotify('INFO', 'Logs locais limpos.');
      }
  };

  const handleDownloadLogs = async () => {
      setLogExporting(true);
      setLogStatus(null);
      const success = await Logger.downloadLogs();
      setLogStatus(success ? { type: 'success', message: 'Relatório baixado no dispositivo.' } : { type: 'error', message: 'Falha ao gerar relatório.' });
      setLogExporting(false);
  };

  const toggleGlobalModule = (mod: string) => {
      const current = systemConfig.modules || DEFAULT_SYSTEM_CONFIG.modules!;
      const nextModules = { ...current, [mod]: !(current as any)[mod] };
      setSystemConfig({ ...systemConfig, modules: nextModules });
  };

  const toggleMaintenance = () => {
      setSystemConfig({ ...systemConfig, isMaintenanceMode: !systemConfig.isMaintenanceMode });
  };

  const toggleSalesLock = () => {
      setSystemConfig({ ...systemConfig, salesLockEnabled: !systemConfig.salesLockEnabled });
  };

  const handleSaveAiSettings = () => {
      const payload = {
          provider: aiProvider,
          apiKey: aiApiKey,
          aiEnabled,
          biEnabled
      };
      localStorage.setItem('sys_ai_settings_v1', JSON.stringify(payload));
      onNotify('SUCCESS', 'Preferencias de IA/BI salvas localmente.');
  };

  const handleSaveSystemSettings = async () => {
      if (!isDev) {
          onNotify('ERROR', 'Somente DEV pode salvar configura??es globais do sistema.');
          return;
      }
      const newConfig: any = { 
          ...systemConfig, 
          notificationSounds: {
              enabled: soundEnabled,
              volume: soundVolume,
              sound: notificationSound
          },
          notificationSound,
          alertSound,
          successSound,
          warningSound
      };

      setSystemConfig(newConfig);
      try {
          await saveSystemConfig(newConfig);
          onNotify('SUCCESS', 'Configuracoes de sistema atualizadas!');
          Logger.info('Config: Sistema atualizado.', { userId: currentUser.id });
      } catch (error: any) {
          onNotify('ERROR', error?.message || 'Falha ao salvar configura??es do sistema.');
      }
  };

  const handleSaveCommissionSettings = async () => {
      if (!isDev) {
          onNotify('ERROR', 'Somente DEV pode salvar ajustes globais de comissao.');
          return;
      }
      try {
          await saveSystemConfig(systemConfig);
          onNotify('SUCCESS', 'Configuracoes de comissao atualizadas!');
          Logger.info('Config: Comissoes atualizadas.', { userId: currentUser.id });
      } catch (error: any) {
          onNotify('ERROR', error?.message || 'Falha ao salvar configuracoes de comissao.');
      }
  };

  const handleRunSyncDiagnostics = async () => {
      if (!currentUser?.uid) return;
      setSyncRunning(true);
      setSyncError(null);
      try {
          const results = await runSyncDiagnostics(currentUser.uid);
          setSyncResults(results);
          Logger.info('DEV: Diagnóstico de sync executado.', { userId: currentUser.id, results });
      } catch (error: any) {
          const message = error?.message || 'Falha ao executar diagnóstico de sync.';
          setSyncError(message);
          Logger.error('DEV: Diagnóstico de sync falhou.', { userId: currentUser.id, message });
      } finally {
          setSyncRunning(false);
      }
  };

  const handleSaveDevVisibility = async () => {
      setDevSaving(true);
      try {
          await updateUser(currentUser.id, {
              hiddenModules: devHiddenModules,
              permissions: devPermissions
          });
          onUpdateUser({
              ...currentUser,
              hiddenModules: devHiddenModules,
              permissions: devPermissions
          });
          onNotify('SUCCESS', 'Configurações DEV salvas.');
      } catch (error: any) {
          onNotify('ERROR', 'Falha ao salvar ajustes DEV.');
      } finally {
          setDevSaving(false);
      }
  };

  const handleSaveDevTargets = async () => {
      setDevSaving(true);
      try {
          await updateUser(currentUser.id, { salesTargets: devSalesTargets });
          onUpdateUser({
              ...currentUser,
              salesTargets: devSalesTargets
          });
          onNotify('SUCCESS', 'Meta de campanha atualizada.');
      } catch (error: any) {
          onNotify('ERROR', 'Falha ao salvar meta de campanha.');
      } finally {
          setDevSaving(false);
      }
  };

  const handleRunCampaignSimulation = async () => {
      setCampaignRunning(true);
      try {
          const target = resolveMonthlyBasicBasketTarget({
              ...currentUser,
              salesTargets: devSalesTargets
          });
          const companyId = await resolveCompanyId(currentUser);
          const campaigns = await getCampaignsByCompany(companyId);
          const now = new Date().toISOString().slice(0, 10);
          const salesSample: Sale[] = [1, 3, -1].map((margin) => ({
              id: `sim-${margin.toString().replace('.', '_')}`,
              userId: currentUser.uid,
              client: 'Simulação Campanha',
              quantity: 1,
              type: ProductType.BASICA,
              status: 'FATURADO',
              valueProposed: 1000,
              valueSold: 1000,
              marginPercent: margin,
              date: now,
              isBilled: true,
              hasNF: false,
              observations: '',
              trackingCode: '',
              commissionBaseTotal: 1000,
              commissionValueTotal: 50,
              commissionRateUsed: 0.05,
              createdAt: now,
              updatedAt: now,
              deleted: false,
              paymentMethod: 'À vista / Antecipado'
          }));
          const monthKey = getSaleMonthKey(salesSample[0]);
          const progress = monthKey
              ? await getMonthlyBasicBasketProgress(currentUser.uid, monthKey, companyId, {
                  sales: salesSample,
                  targetOverride: target
              })
              : { target, current: 0, hit: false };
          const avistaRuleEnabled = systemConfig?.avistaLowMarginRuleEnabled ?? DEFAULT_SYSTEM_CONFIG.avistaLowMarginRuleEnabled ?? true;
          const avistaRulePct = systemConfig?.avistaLowMarginCommissionPct ?? DEFAULT_SYSTEM_CONFIG.avistaLowMarginCommissionPct ?? 0.25;
          const avistaRulePayments = systemConfig?.avistaLowMarginPaymentMethods ?? DEFAULT_SYSTEM_CONFIG.avistaLowMarginPaymentMethods ?? [];

          const rows = salesSample.map((sale) => {
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
              const overlay = avistaOverlay || (monthKey
                  ? applyCampaignOverlay(sale, baseCommission, {
                      month: monthKey,
                      campaigns,
                      goalProgress: progress
                  })
                  : null);
              return {
                  id: sale.id,
                  margin: sale.marginPercent,
                  baseCommissionValueTotal: sale.commissionValueTotal,
                  overlayCommissionValueTotal: overlay?.commissionValueTotal ?? sale.commissionValueTotal,
                  campaignTag: overlay?.campaignTag || '-',
                  campaignLabel: overlay?.campaignLabel || 'Sem campanha',
                  campaignMessage: overlay?.campaignMessage || 'Sem overlay aplicado.',
                  campaignColor: overlay?.campaignColor || 'slate',
                  applied: !!overlay
              };
          });
          setCampaignSimulation(rows);
          Logger.info('DEV: Simulador de campanhas executado.', {
              userId: currentUser.id,
              target,
              rows
          });
      } catch (error: any) {
          onNotify('ERROR', 'Falha ao simular campanha.');
      } finally {
          setCampaignRunning(false);
      }
  };

  const handleAddSystemPaymentMethod = () => {
      const trimmed = paymentMethodInput.trim();
      if (!trimmed) return;
      const current = systemConfig.paymentMethods || DEFAULT_SYSTEM_CONFIG.paymentMethods || [];
      const exists = current.some(method => method.trim().toLowerCase() === trimmed.toLowerCase());
      if (exists) {
          setPaymentMethodInput('');
          return;
      }
      setSystemConfig({ ...systemConfig, paymentMethods: [...current, trimmed] });
      setPaymentMethodInput('');
  };

  const handleRemoveSystemPaymentMethod = (method: string) => {
      const current = systemConfig.paymentMethods || DEFAULT_SYSTEM_CONFIG.paymentMethods || [];
      setSystemConfig({ ...systemConfig, paymentMethods: current.filter(item => item !== method) });
  };

  const handleAddPaymentMethod = () => {
      const trimmed = paymentMethodInput.trim();
      if (!trimmed) return;
      const current = systemConfig.paymentMethods || DEFAULT_SYSTEM_CONFIG.paymentMethods || [];
      const exists = current.some(method => method.trim().toLowerCase() === trimmed.toLowerCase());
      if (exists) {
          setPaymentMethodInput('');
          return;
      }
      setSystemConfig({ ...systemConfig, paymentMethods: [...current, trimmed] });
      setPaymentMethodInput('');
  };

  const handleRemovePaymentMethod = (method: string) => {
      const current = systemConfig.paymentMethods || DEFAULT_SYSTEM_CONFIG.paymentMethods || [];
      const nextPaymentMethods = current.filter(item => item !== method);
      const avistaMethods = systemConfig.avistaLowMarginPaymentMethods || DEFAULT_SYSTEM_CONFIG.avistaLowMarginPaymentMethods || [];
      const nextAvistaMethods = avistaMethods.filter(item => item !== method);
      setSystemConfig({
          ...systemConfig,
          paymentMethods: nextPaymentMethods,
          avistaLowMarginPaymentMethods: nextAvistaMethods
      });
  };

  const toggleAvistaPaymentMethod = (method: string) => {
      const current = systemConfig.avistaLowMarginPaymentMethods || DEFAULT_SYSTEM_CONFIG.avistaLowMarginPaymentMethods || [];
      const currentSet = new Set(current);
      if (currentSet.has(method)) currentSet.delete(method);
      else currentSet.add(method);
      setSystemConfig({ ...systemConfig, avistaLowMarginPaymentMethods: Array.from(currentSet) });
  };

  const handleTabSelect = (id: any) => {
      setActiveTab(id);
      setShowMobileContent(true);
  };

  const NavBtn = ({ id, icon: Icon, label, show = true, badge }: any) => {
      if (!show) return null;
      const active = activeTab === id;
      if (!Icon) return null;

      return (
          <button 
            onClick={() => handleTabSelect(id)}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold rounded-xl transition-all mb-1 text-left ${
                active 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                : (darkMode ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-100')
            }`}
          >
              <div className="flex items-center gap-3">
                <Icon size={18} className={active ? 'text-white' : 'text-indigo-500'} />
                {label}
              </div>
              {badge && <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] font-black">{badge}</span>}
          </button>
      )
  };

  const visibilityModules = [
      { key: 'sales', label: 'Vendas' },
      { key: 'finance', label: 'Financeiro' },
      { key: 'receivables', label: 'A Receber' },
      { key: 'distribution', label: 'Distribuição' },
      { key: 'imports', label: 'Importações' },
      { key: 'audit_logs', label: 'Auditoria' },
      { key: 'chat', label: 'Chat Interno' },
      { key: 'logs', label: 'Logs Locais' },
      { key: 'dev', label: 'Engenharia (DEV)' }
  ] as const;

  const ACCESS_SEGMENTS = [
      {
          title: 'Operação',
          description: 'Acesso diário para times de vendas e financeiro.',
          items: ['sales', 'finance', 'receivables', 'distribution', 'imports']
      },
      {
          title: 'Administração',
          description: 'Gestão avançada de usuários, logs e segurança.',
          items: ['users', 'audit_logs', 'profiles', 'settings', 'dev']
      }
  ];

  return (
    <div className="min-h-[calc(100vh-10rem)] flex flex-col md:flex-row gap-6 relative animate-in fade-in pb-20 overflow-x-hidden">
       <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
       <ReportBugModal 
         isOpen={bugModalOpen} 
         onClose={() => setBugModalOpen(false)} 
         currentUser={currentUser} 
         darkMode={!!darkMode} 
       />

       {/* Sidebar Menu */}
       <div className={`w-full md:w-64 shrink-0 flex flex-col gap-1 ${showMobileContent ? 'hidden md:flex' : 'flex'}`}>
           <div className={`max-h-[calc(100vh-8rem)] overflow-y-auto p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-200'} shadow-sm`}>
               <h2 className="px-2 mb-4 text-[10px] font-black uppercase tracking-widest text-indigo-500">Gerais</h2>
               <NavBtn id="PROFILE" icon={UserIcon} label="Meu Perfil" />
               <NavBtn id="SOUNDS" icon={Volume2} label="Sons & Avisos" />
               <NavBtn id="LOGS" icon={Terminal} label="Logs & Diagnostico" />
               <NavBtn id="AI_BI" icon={Cpu} label="AI & BI" />
               <NavBtn id="SYSTEM" icon={SettingsIcon} label="Sistema (Admin)" show={isAdmin} />
               <NavBtn id="TRASH" icon={Trash2} label="Lixeira" />

               {appMode === 'SALES' && (
                   <>
                       <h2 className="px-2 mb-4 mt-6 text-[10px] font-black uppercase tracking-widest text-indigo-500">Modulo Atual</h2>
                       <NavBtn id="COMMISSIONS" icon={SettingsIcon} label="Tabelas de Comissao" />
                       <NavBtn id="CLIENTS" icon={Users} label="Gestao de Clientes" />
                   </>
               )}

{(isAdmin || isDev) && (
                   <>
                       <div className="my-6 border-t dark:border-slate-800 border-gray-100"></div>
                       <h2 className="px-2 mb-4 text-[10px] font-black uppercase tracking-widest text-amber-500">Administração</h2>
                       <NavBtn id="ACCESS" icon={Shield} label="Acessos & Usuários" />
                       <NavBtn id="WEBHOOKS" icon={Activity} label="Webhooks" />
                       <NavBtn id="AUDIT_FULL" icon={HardDrive} label="Audit Global" />
                       <NavBtn id="MESSAGING" icon={Bell} label="Comunicados Hub" />
                       <NavBtn id="ROADMAP" icon={Hammer} label="Roadmap" />
                       <NavBtn id="DEVTOOLS" icon={FlaskConical} label="DEV Diagnostics" show={isDev} />
                   </>
               )}
           </div>
       </div>

       {/* Content Area */}
       <div className={`flex-1 min-w-0 ${!showMobileContent ? 'hidden md:block' : 'block'}`}>
           {showMobileContent && (
               <div className="md:hidden mb-6 flex items-center">
                   <button onClick={() => setShowMobileContent(false)} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl active:scale-95 transition-all border border-white/10">
                       <ArrowLeft size={16} /> Voltar ao Menu
                   </button>
               </div>
           )}

           <div className="space-y-6">
               {activeTab === 'PROFILE' && <UserProfile user={currentUser} onUpdate={onUpdateUser} onLogout={onLogout} />}
{activeTab === 'USERS' && (isAdmin || isDev) && <AdminUsers currentUser={currentUser} />}
               {activeTab === 'WEBHOOKS' && (isAdmin || isDev) && <AdminWebhooks onNotify={onNotify} darkMode={!!darkMode} />}
               {activeTab === 'MESSAGING' && (isAdmin || isDev) && <AdminMessaging currentUser={currentUser} darkMode={!!darkMode} />}
               {activeTab === 'AUDIT_FULL' && (isAdmin || isDev) && <AuditLogExplorer darkMode={!!darkMode} />}

               {activeTab === 'AI_BI' && (
                    <div className={`p-6 sm:p-8 rounded-2xl border shadow-sm animate-in fade-in slide-in-from-right-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center gap-3 mb-8">
                            <Cpu className="text-indigo-500" size={28}/>
                            <div>
                                <h3 className="text-xl font-black">AI & BI</h3>
                                <p className="text-xs text-gray-500">Configure provedor e chave. Armazenamento local (navegador).</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className={`p-5 rounded-2xl border ${darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-gray-200 bg-gray-50'}`}>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Provedor</label>
                                <select
                                    value={aiProvider}
                                    onChange={(e) => setAiProvider(e.target.value as 'OPENAI' | 'GEMINI')}
                                    className={`w-full p-3 rounded-xl border text-sm font-semibold ${darkMode ? 'bg-black border-slate-700 text-white' : 'bg-white border-gray-200'}`}
                                >
                                    <option value="OPENAI">OpenAI</option>
                                    <option value="GEMINI">Gemini</option>
                                </select>
                                <p className="text-[10px] text-gray-400 mt-2">Selecione o provedor principal para recursos de IA/BI.</p>
                            </div>

                            <div className={`p-5 rounded-2xl border ${darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-gray-200 bg-gray-50'}`}>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Chave de API</label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type={showAiKey ? 'text' : 'password'}
                                            value={aiApiKey}
                                            onChange={(e) => setAiApiKey(e.target.value)}
                                            placeholder="Cole a chave aqui"
                                            className={`w-full p-3 pr-10 rounded-xl border text-sm font-semibold ${darkMode ? 'bg-black border-slate-700 text-white' : 'bg-white border-gray-200'}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowAiKey(!showAiKey)}
                                            className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showAiKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                                        </button>
                                    </div>
                                    <KeyRound className="text-indigo-500" size={18}/>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2">A chave nao e enviada para o servidor automaticamente.</p>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <label className={`p-4 rounded-2xl border flex items-center justify-between ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-gray-200 bg-gray-50'}`}>
                                <span className="text-sm font-bold">IA ativada</span>
                                <input
                                    type="checkbox"
                                    checked={aiEnabled}
                                    onChange={(e) => setAiEnabled(e.target.checked)}
                                    className="h-5 w-5 accent-indigo-600"
                                />
                            </label>
                            <label className={`p-4 rounded-2xl border flex items-center justify-between ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-gray-200 bg-gray-50'}`}>
                                <span className="text-sm font-bold">BI ativado</span>
                                <input
                                    type="checkbox"
                                    checked={biEnabled}
                                    onChange={(e) => setBiEnabled(e.target.checked)}
                                    className="h-5 w-5 accent-indigo-600"
                                />
                            </label>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleSaveAiSettings}
                                className="px-8 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700"
                            >
                                Salvar IA & BI
                            </button>
                        </div>
                    </div>
               )}
               {activeTab === 'ACCESS' && (isAdmin || isDev) && (
                    <div className={`p-6 sm:p-8 rounded-2xl border shadow-sm animate-in fade-in slide-in-from-right-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center gap-3 mb-8">
                            <ShieldCheckIcon className="text-indigo-500" size={28}/>
                            <div>
                                <h3 className="text-xl font-black">Acessos & Permissões</h3>
                                <p className="text-xs text-gray-500">Segmentação de permissões e auditoria centralizada.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="p-6 rounded-2xl border border-indigo-200/40 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-900/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <Users size={18} className="text-indigo-500" />
                                    <h4 className="text-sm font-black">Gestão de usuários</h4>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                                    Crie segmentos de acesso por usuário e libere módulos granulares. As áreas administrativas ficam ocultas
                                    para quem não tem acesso liberado.
                                </p>
                                <button
                                    onClick={() => handleTabSelect('USERS')}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-900/20"
                                >
                                    Abrir Usuários Cloud
                                </button>
                            </div>
                            <div className="p-6 rounded-2xl border border-emerald-200/40 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <HardDrive size={18} className="text-emerald-500" />
                                    <h4 className="text-sm font-black">Auditoria completa</h4>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                                    Consulte logs globais e trilhas de eventos para validação de acessos e alterações críticas.
                                </p>
                                <button
                                    onClick={() => handleTabSelect('AUDIT_FULL')}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20"
                                >
                                    Abrir Audit Global
                                </button>
                            </div>
                        </div>

                        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {ACCESS_SEGMENTS.map(segment => (
                                <div key={segment.title} className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-gray-200'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Layers size={16} className="text-indigo-500" />
                                        <h5 className="text-xs font-black uppercase tracking-widest">{segment.title}</h5>
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">{segment.description}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {segment.items.map(item => (
                                            <span
                                                key={item}
                                                className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-900 text-white dark:bg-white/10 dark:text-white"
                                            >
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
               )}
               
               {activeTab === 'LOGS' && (
                    <div className={`p-6 sm:p-8 rounded-2xl border shadow-sm animate-in fade-in slide-in-from-right-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center gap-3 mb-6">
                            <Terminal className="text-indigo-500" size={28}/>
                            <h3 className="text-xl font-black">Auditoria de Sistema</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                            Logs locais ficam no seu navegador (IndexedDB). Baixe ou limpe quando precisar.
                        </p>
                        {logStatus && (
                            <div className={`mb-6 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${logStatus.type === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                                {logStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                {logStatus.message}
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handleDownloadLogs}
                                disabled={logExporting}
                                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-all shadow-lg shadow-slate-900/30 disabled:opacity-60"
                            >
                                <Download size={16}/> {logExporting ? 'Gerando...' : 'Baixar Logs'}
                            </button>
                            <button
                                onClick={handleClearLogs}
                                className="px-6 py-3 bg-red-100 text-red-600 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-red-200 transition-all"
                            >
                                <Eraser size={16}/> Limpar Logs
                            </button>
                        </div>
                    </div>
               )}

               {activeTab === 'SYSTEM' && isAdmin && (
                    <div className={`p-6 sm:p-8 rounded-2xl border shadow-sm animate-in fade-in slide-in-from-right-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center gap-3 mb-8">
                            <Shield className="text-indigo-500" size={28}/>
                            <h3 className="text-xl font-black">Infraestrutura Administrativa</h3>
                        </div>
                        
                        <div className="space-y-10">
                            {/* Módulos Globais */}
                            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/30 border border-gray-200 dark:border-slate-800 dark:text-slate-100">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Layout size={14} className="text-indigo-500" /> Interruptores de Módulos Globais
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {['sales', 'finance', 'receivables', 'distribution', 'imports', 'chat', 'logs', 'users'].map((mod) => {
                                        const isEnabled = (systemConfig.modules as any)?.[mod] ?? true;
                                        return (
                                            <button 
                                                key={mod}
                                                onClick={() => toggleGlobalModule(mod)}
                                                className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${isEnabled ? 'bg-white dark:bg-slate-800 border-emerald-500/30 shadow-md' : 'bg-gray-100 dark:bg-black/20 border-gray-200 dark:border-slate-800 opacity-60'}`}
                                            >
                                                <span className="text-xs font-black uppercase tracking-wider">{mod}</span>
                                                {isEnabled ? <ToggleRight className="text-emerald-500" size={28}/> : <ToggleLeft className="text-gray-400" size={28}/>}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="mt-4 flex gap-2 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-100 dark:border-amber-800">
                                    <Info size={14} className="shrink-0"/>
                                    <p>Estes controles afetam a visibilidade dos módulos para <b>todos os usuários</b> do sistema, exceto Desenvolvedores.</p>
                                </div>
                            </div>

                            {(isDev || isAdmin) && (
                                <div className="p-6 rounded-3xl border border-red-500/40 bg-red-500/10">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 text-red-500">
                                        <ShieldAlert size={14} /> Reset de Vendas (DEV)
                                    </h4>
                                    <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                                        Apaga vendas, clientes e dependências (pendências e recebíveis) do usuário e recria apenas um seed com soft delete ativo.
                                    </p>
                                    <button
                                        onClick={handleResetSales}
                                        className="px-5 py-3 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest"
                                    >
                                        Resetar Vendas
                                    </button>
                                </div>
                            )}

                            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 dark:text-slate-100">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-amber-500" /> Diagnóstico de Visibilidade
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {visibilityModules.map((mod) => {
                                        const moduleEnabled = (systemConfig.modules as any)?.[mod.key] ?? true;
                                        const hasPermission = currentUser.role === 'DEV' || currentUser.role === 'ADMIN' || !!(currentUser.permissions as any)?.[mod.key];
                                        const badgeClass = moduleEnabled && hasPermission
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-amber-100 text-amber-700';
                                        return (
                                            <div key={mod.key} className="flex items-center justify-between rounded-2xl border border-gray-100 dark:border-slate-800 px-4 py-3">
                                                <div>
                                                    <p className="text-xs font-black text-gray-700 dark:text-slate-200">{mod.label}</p>
                                                    <p className="text-[10px] text-gray-500">
                                                        {moduleEnabled ? 'Módulo ativo' : 'Módulo desativado'} • {hasPermission ? 'Com permissão' : 'Sem permissão'}
                                                    </p>
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${badgeClass}`}>
                                                    {moduleEnabled && hasPermission ? 'Visível' : 'Oculto'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="mt-4 text-[10px] text-gray-500">Use este bloco para mapear telas/ações que não aparecem para usuários específicos.</p>
                            </div>

                            {/* MODO MANUTENÇÃO (NEW) */}
                            <div className={`p-6 rounded-3xl border transition-all ${systemConfig.isMaintenanceMode ? 'bg-red-500/10 border-red-500 shadow-lg shadow-red-900/20' : 'bg-slate-50 dark:bg-slate-800/30 border-gray-200'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${systemConfig.isMaintenanceMode ? 'text-red-500' : 'text-gray-400'}`}>
                                        <ShieldAlert size={14} /> Modo de Manutenção Global
                                    </h4>
                                    <button onClick={toggleMaintenance}>
                                        {systemConfig.isMaintenanceMode ? <ToggleRight className="text-red-500" size={32}/> : <ToggleLeft className="text-gray-400" size={32}/>}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Ao ativar o Modo de Manutenção, o sistema bloqueia qualquer nova inserção ou edição de dados (Vendas/Financeiro) para todos os usuários comum. Apenas <b>DEV (Root)</b> permanece com permissões de escrita ativas. Use para backups estruturais ou atualizações de banco.
                                </p>
                            </div>

                            <div className={`p-6 rounded-3xl border transition-all ${systemConfig.salesLockEnabled ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-900/10' : 'bg-slate-50 dark:bg-slate-800/30 border-gray-200'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${systemConfig.salesLockEnabled ? 'text-amber-600' : 'text-gray-400'}`}>
                                        <ShieldAlert size={14} /> Bloqueio do Módulo de Vendas
                                    </h4>
                                    <button onClick={toggleSalesLock}>
                                        {systemConfig.salesLockEnabled ? <ToggleRight className="text-amber-500" size={32}/> : <ToggleLeft className="text-gray-400" size={32}/>}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Ative para congelar alterações no módulo de vendas (somente leitura). Nenhuma nova venda, edição, faturamento em lote ou exclusão será permitida para usuários comuns.
                                </p>
                            </div>

                            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/40 border border-gray-200 dark:border-slate-800 dark:text-slate-100">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <DollarSign size={14} className="text-emerald-500" /> Formas de Pagamento (Vendas)
                                </h4>
                                <p className="text-xs text-gray-500 mb-4">
                                    Cadastre as opções que aparecerão no modal de vendas e serão usadas nas regras de premiação à vista.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                                    <input
                                        type="text"
                                        className={`flex-1 px-4 py-3 rounded-xl border text-sm font-semibold ${darkMode ? 'bg-black/40 border-slate-700 text-white' : 'bg-white border-gray-200'}`}
                                        placeholder="Ex.: À vista, PIX, Boleto"
                                        value={paymentMethodInput}
                                        onChange={e => setPaymentMethodInput(e.target.value)}
                                    />
                                    <button
                                        onClick={handleAddPaymentMethod}
                                        className="px-5 py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(systemConfig.paymentMethods || DEFAULT_SYSTEM_CONFIG.paymentMethods || []).map(method => (
                                        <button
                                            key={method}
                                            onClick={() => handleRemovePaymentMethod(method)}
                                            className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-colors"
                                            title="Remover forma de pagamento"
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-3 text-[10px] text-gray-400">
                                    Clique em uma opção para removê-la. Salve as alterações globais ao final.
                                </p>
                            </div>

                            <div className="p-6 rounded-3xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800">
                                <label className="block text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Bell size={14}/> Notificações Push (FCM HTTP v1)
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    O envio agora utiliza a API HTTP v1 do Firebase via Cloud Functions, com autenticação OAuth2.
                                </p>
                                <p className="text-[10px] text-gray-400">
                                    Nenhuma Server Key legacy é necessária. A permissão vem das credenciais do Firebase Admin no backend.
                                </p>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t dark:border-slate-800 flex justify-end">
                            <button onClick={handleSaveSystemSettings} className="w-full md:w-auto px-10 py-4 bg-indigo-600 text-white font-black rounded-xl active:scale-95 transition-all shadow-xl hover:bg-indigo-700 uppercase text-xs tracking-widest">
                               <Save size={18} className="inline mr-2"/> Gravar Alterações Globais
                            </button>
                        </div>
                    </div>
               )}

               {activeTab === 'COMMISSIONS' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
                    <div className={`p-6 rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h4 className="text-sm font-black uppercase tracking-widest text-gray-400">Regra À Vista (Margem &lt; 4%)</h4>
                                <p className="text-xs text-gray-500">Ative/desative e ajuste o percentual aplicado para pagamento à vista ou antecipado.</p>
                            </div>
                            <button
                                onClick={handleSaveCommissionSettings}
                                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700"
                            >
                                <Save size={16} className="inline mr-2" /> Salvar Regra
                            </button>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-xl border ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-gray-200 bg-gray-50'}`}>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm font-bold">Regra Ativa</span>
                                    <button
                                        onClick={() => setSystemConfig({ ...systemConfig, avistaLowMarginRuleEnabled: !systemConfig.avistaLowMarginRuleEnabled })}
                                        className="flex items-center gap-2"
                                        type="button"
                                    >
                                        {systemConfig.avistaLowMarginRuleEnabled ? <ToggleRight className="text-emerald-500" size={28} /> : <ToggleLeft className="text-gray-400" size={28} />}
                                    </button>
                                </label>
                            </div>
                            <div className={`p-4 rounded-xl border ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-gray-200 bg-gray-50'}`}>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Comissão (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className={`w-full p-3 rounded-xl border outline-none ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200'}`}
                                    value={systemConfig.avistaLowMarginCommissionPct ?? 0.25}
                                    onChange={(e) => setSystemConfig({ ...systemConfig, avistaLowMarginCommissionPct: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className={`mt-4 p-4 rounded-xl border ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-gray-200 bg-gray-50'}`}>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Formas de pagamento válidas</label>
                            <div className="flex flex-wrap gap-2">
                                {(systemConfig.paymentMethods || DEFAULT_SYSTEM_CONFIG.paymentMethods || []).map((method) => {
                                    const selected = (systemConfig.avistaLowMarginPaymentMethods || DEFAULT_SYSTEM_CONFIG.avistaLowMarginPaymentMethods || []).includes(method);
                                    return (
                                        <button
                                            key={method}
                                            type="button"
                                            onClick={() => toggleAvistaPaymentMethod(method)}
                                            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase border transition-colors ${selected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-transparent text-gray-500 border-gray-300 hover:border-emerald-400 hover:text-emerald-500'}`}
                                        >
                                            {method}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-3 text-[10px] text-gray-400">Selecione quais formas acionam a regra de margem abaixo de 4%.</p>
                        </div>
                    </div>

                    <div className="flex p-1 rounded-xl w-fit flex-wrap gap-2 bg-gray-100 dark:bg-slate-800 shadow-inner dark:text-slate-100">
                        <button onClick={() => setCommissionTab(ProductType.BASICA)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${commissionTab === ProductType.BASICA ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500'}`}>Cesta Básica</button>
                        <button onClick={() => setCommissionTab(ProductType.NATAL)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${commissionTab === ProductType.NATAL ? 'bg-red-600 text-white shadow-md' : 'text-gray-500'}`}>Cesta de Natal</button>
                    </div>
                    <div className="overflow-x-hidden">
                        <CommissionEditor 
                            type={commissionTab} 
                            readOnly={!isDev && !isAdmin} 
                            currentUser={currentUser} 
                        />
                    </div>
                  </div>
               )}
               
               {activeTab === 'SOUNDS' && (
                    <div className={`p-6 sm:p-8 rounded-2xl border shadow-sm animate-in fade-in slide-in-from-right-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center gap-3 mb-8">
                            <Volume2 className="text-indigo-500" size={28}/>
                            <h3 className="text-xl font-black">Configurações de Alerta</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="p-4 rounded-xl border dark:border-slate-800 bg-gray-50 dark:bg-slate-950 dark:text-slate-100">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm font-bold">Ativar Sons</span>
                                    <input 
                                        type="checkbox" 
                                        checked={soundEnabled} 
                                        onChange={e => setSoundEnabled(e.target.checked)}
                                        className="w-5 h-5 accent-indigo-600"
                                    />
                                </label>
                            </div>
                            <div className="p-4 rounded-xl border dark:border-slate-800 bg-gray-50 dark:bg-slate-950 dark:text-slate-100">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Volume Geral</label>
                                <input 
                                    type="range" min="0" max="1" step="0.1"
                                    value={soundVolume}
                                    onChange={e => setSoundVolume(parseFloat(e.target.value))}
                                    className="w-full accent-indigo-600"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <SoundRow 
                                label="Som das Notificações (Geral)" 
                                value={notificationSound} 
                                onUpload={() => openUpload('GENERAL')} 
                                onTest={() => {
                                    if (!notificationSound) return;
                                    const a = new Audio(notificationSound);
                                    a.volume = soundVolume;
                                    a.play().catch(() => {});
                                }} 
                                onDelete={() => setNotificationSound('')} 
                            />
                            <SoundRow 
                                label="Som de Alerta / Erro" 
                                value={alertSound} 
                                onUpload={() => openUpload('ALERT')} 
                                onTest={() => {
                                    if (!alertSound) return;
                                    const a = new Audio(alertSound);
                                    a.volume = soundVolume;
                                    a.play().catch(() => {});
                                }} 
                                onDelete={() => setAlertSound('')} 
                            />
                            <SoundRow 
                                label="Som de Sucesso / Venda" 
                                value={successSound} 
                                onUpload={() => openUpload('SUCCESS')} 
                                onTest={() => {
                                    if (!successSound) return;
                                    const a = new Audio(successSound);
                                    a.volume = soundVolume;
                                    a.play().catch(() => {});
                                }} 
                                onDelete={() => setSuccessSound('')} 
                            />
                            <SoundRow 
                                label="Som de Aviso / Pendência" 
                                value={warningSound} 
                                onUpload={() => openUpload('WARNING')} 
                                onTest={() => {
                                    if (!warningSound) return;
                                    const a = new Audio(warningSound);
                                    a.volume = soundVolume;
                                    a.play().catch(() => {});
                                }} 
                                onDelete={() => setWarningSound('')} 
                            />
                        </div>

                        <div className="mt-10 pt-6 border-t dark:border-slate-800 flex justify-end">
                            <button onClick={handleSaveSystemSettings} className="w-full md:w-auto px-10 py-4 bg-emerald-600 text-white font-black rounded-xl active:scale-95 transition-all shadow-xl hover:bg-emerald-700 uppercase text-xs tracking-widest">
                               <Save size={18} className="inline mr-2"/> Salvar Configurações
                            </button>
                        </div>
                    </div>
               )}

               {activeTab === 'TRASH' && <TrashBin darkMode={!!darkMode} />}
               {activeTab === 'ROADMAP' && (isAdmin || isDev) && <DevRoadmap />}
               {activeTab === 'CLIENTS' && <ClientManagementHub currentUser={currentUser} darkMode={!!darkMode} />}
           </div>
       </div>

       <BackupModal isOpen={showBackupModal} mode="BACKUP" onClose={() => setShowBackupModal(false)} onSuccess={() => {}} />
    </div>
  );
};

const SoundRow = ({ label, value, onUpload, onTest, onDelete }: any) => (
    <div className="p-5 rounded-2xl border bg-black/5 dark:bg-white/5 border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group transition-all hover:border-indigo-500/30">
        <div>
            <span className="font-bold text-sm block mb-0.5">{label}</span>
            <span className="text-[10px] text-gray-500 font-mono tracking-tighter">{value ? '✓ Áudio customizado carregado' : '× Som padrão (Silencioso)'}</span>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            {value && <button onClick={onTest} className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl hover:scale-110 transition-transform"><Activity size={18}/></button>}
            <button onClick={onUpload} className="flex-1 sm:flex-none px-5 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-900/20">{value ? 'Trocar' : 'Carregar'}</button>
            {value && <button onClick={onDelete} className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl hover:bg-red-50 hover:text-white transition-all"><Trash2 size={18}/></button>}
        </div>
    </div>
);

export default SettingsHub;
