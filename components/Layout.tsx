import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutDashboard, ShoppingCart, Settings, Menu, X, Users, FileText, Wallet, PieChart, Trophy, Tag, ArrowLeftRight, PiggyBank, List, LogOut, ClipboardList, PartyPopper, MessageSquare, Home, Shield } from 'lucide-react';
import { AppMode, User, AppTheme, AppNotification, SystemConfig, SystemModules } from '../types';
import { getSystemConfig, canAccess } from '../services/logic';
import { isModuleEnabled } from '../config/modulesCatalog';
import { getMessages } from '../services/internalChat';
import FAB from './FAB';
import NotificationCenter from './NotificationCenter';
import SyncStatus from './SyncStatus';
import Logo from './Logo';
import { AudioService } from '../services/audioService';
import InternalChatSystem from './InternalChatSystem'; 
import { safeInitials } from '../utils/stringUtils';
import BottomNav from './BottomNav';
import { Logger } from '../services/logger';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  darkMode: boolean; 
  currentTheme: AppTheme; 
  setTheme: (theme: AppTheme) => void;
  currentUser: User;
  onLogout: () => void;
  onNewSale: () => void;
  onNewIncome: () => void;
  onNewExpense: () => void;
  onNewTransfer: () => void;
  isAdmin: boolean;
  isDev: boolean;
  showSnow: boolean;
  onToggleSnow: () => void;
  notifications: AppNotification[];
  onClearAllNotifications: () => void;
  onNotify: (type: 'SUCCESS' | 'ERROR' | 'INFO', message: string) => void;
}

const THEME_CONFIG: Record<AppTheme, { background: string; sidebar: string; navActive: (mode: AppMode) => string; navInactive: string }> = {
    glass: {
        background: 'bg-slate-950 animate-aurora', 
        sidebar: 'bg-slate-900/90 md:bg-black/30 backdrop-blur-2xl border-r border-white/10 text-gray-100 shadow-[4px_0_24px_rgba(0,0,0,0.5)]',
        navActive: (mode) => {
            if (mode === 'SALES') return 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
            return 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/50';
        },
        navInactive: 'text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-200'
    },
    neutral: {
        background: 'bg-slate-50',
        sidebar: 'bg-white border-r border-slate-200 text-slate-700 shadow-sm',
        navActive: (mode) => 'bg-slate-800 text-white shadow-md shadow-slate-900/10',
        navInactive: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all'
    },
    rose: {
        background: 'bg-gradient-to-br from-rose-50 to-orange-50',
        sidebar: 'bg-white/80 backdrop-blur-xl border-r border-rose-100 text-rose-900 shadow-sm',
        navActive: (mode) => 'bg-rose-500 text-white shadow-lg shadow-rose-500/30',
        navInactive: 'text-rose-400 hover:bg-rose-50 hover:text-rose-700 transition-all'
    },
    cyberpunk: {
        background: 'bg-[#050505] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black',
        sidebar: 'bg-black border-r border-pink-500/20 text-cyan-400 shadow-[0_0_15px_rgba(236,72,153,0.1)]',
        navActive: (mode) => 'bg-pink-600/10 border border-pink-500 text-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.4)]',
        navInactive: 'text-slate-500 hover:text-cyan-300 hover:bg-cyan-900/10 transition-all'
    },
    dark: {
        background: 'bg-slate-950',
        sidebar: 'bg-slate-900 border-r border-slate-800 text-slate-300',
        navActive: (mode) => 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20',
        navInactive: 'text-slate-500 hover:bg-slate-800 hover:text-white transition-all'
    }
};

const Layout: React.FC<LayoutProps> = ({ 
    children, activeTab, setActiveTab, appMode, setAppMode, darkMode, currentTheme, setTheme,
    currentUser, onLogout,
    onNewSale, onNewIncome, onNewExpense, onNewTransfer,
    isAdmin, isDev,
    showSnow, onToggleSnow,
    notifications, onClearAllNotifications,
    onNotify
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const lastChatWarnRef = useRef(0);

  useEffect(() => {
    const isDarkTheme = ['glass', 'cyberpunk', 'dark'].includes(currentTheme);
    if (isDarkTheme) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
      const loadMsgs = async () => {
          if (!currentUser) return;
          try {
              const msgs = await getMessages(currentUser.id, isAdmin);
              const unread = msgs.messages.filter(m => !m.read && m.recipientId === currentUser.id).length;
              setUnreadCount(unread);
          } catch (error: any) {
              const now = Date.now();
              if (now - lastChatWarnRef.current > 60000) {
                  Logger.warn('Chat: falha ao carregar mensagens.', {
                       userId: currentUser.id,
                       code: error?.code,
                       name: error?.name,
                       message: error?.message
                   });
                  lastChatWarnRef.current = now;
              }
              setUnreadCount(0);
          }
      };
      loadMsgs();
      const interval = setInterval(loadMsgs, 15000); 
      return () => clearInterval(interval);
  }, [currentUser, isAdmin]);

  useEffect(() => {
      const loadConfig = async () => {
          const config = await getSystemConfig();
          setSystemConfig(config);
      };
      loadConfig();
  }, []);

  const currentStyle = THEME_CONFIG[currentTheme] || THEME_CONFIG['glass'];
  const modeLabels: Record<AppMode, string> = {
    SALES: 'Vendas',
    FINANCE: 'Finanças'
  };
  
  const hasAccess = (mod: string) => canAccess(currentUser, mod);
  const isModuleHidden = (mod: keyof SystemModules) => !!currentUser.hiddenModules?.[mod];
  const isModuleVisible = (mod: keyof SystemModules) =>
      hasAccess(mod) && isModuleEnabled(systemConfig?.modules, mod, isDev) && !isModuleHidden(mod);

  const navigate = (tabId: string) => {
    Logger.info(`Navegação: Usuário mudou aba de [${activeTab}] para [${tabId}]`, { 
        userId: currentUser.id, 
        role: currentUser.role 
    });
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  // Sidebar Items - Expandidos para incluir Perfil e Tabelas
  const commonItems = [
    { id: 'tickets', label: 'Gestão de Tickets', icon: MessageSquare, show: true },
    { id: 'chat', label: 'Chat interno', icon: MessageSquare, show: true },
    { id: 'settings', label: 'Configurações', icon: Settings, show: true },
    { id: 'dev_roadmap', label: 'Diagnostico DEV', icon: Shield, show: isDev },
  ];

  const salesNavItems = [
    { id: 'home', label: 'Menu Principal', icon: Home, show: true },
    { id: 'dashboard', label: 'Indicadores', icon: LayoutDashboard, show: true },
    { id: 'sales', label: 'Gestão de Vendas', icon: ShoppingCart, show: true },
    { id: 'commissions', label: 'Tabelas de Margem', icon: FileText, show: true },
    { id: 'campaigns', label: 'Campanhas', icon: PartyPopper, show: true },
    { id: 'pendencias', label: 'Pendências', icon: ClipboardList, show: true }, 
    { id: 'clients_hub', label: 'Hub de Clientes', icon: Users, show: true }, 
  ];

  const financeNavItems = [
    { id: 'home', label: 'Menu Principal', icon: Home, show: true },
    { id: 'fin_dashboard', label: 'Visão Geral', icon: PieChart, show: true },
    { id: 'fin_receivables', label: 'A Receber', icon: PiggyBank, show: isModuleVisible('receivables') },
    { id: 'fin_distribution', label: 'Distribuição', icon: ArrowLeftRight, show: isModuleVisible('distribution') },
    { id: 'fin_transactions', label: 'Extrato', icon: List, show: true }, 
    { id: 'fin_manager', label: 'Contas & Cartões', icon: Wallet, show: true },
    { id: 'fin_categories', label: 'Orçamentos', icon: Tag, show: true },
    { id: 'fin_goals', label: 'Metas', icon: Trophy, show: true },
    { id: 'fin_challenges', label: 'Desafios', icon: Trophy, show: true },
  ];

  const getCurrentNavItems = () => {
    let items: any[] = [];
    if (activeTab === 'home') items = [{ id: 'home', label: 'Menu Principal', icon: Home, show: true }];
    else if (appMode === 'SALES') items = salesNavItems.filter(i => i.show);
    else if (appMode === 'FINANCE') items = financeNavItems.filter(i => i.show);
    
    // Adiciona itens comuns ao final de cada lista
    return [...items, ...commonItems.filter(i => i.show)];
  };

  const activeLabel = useMemo(() => {
    const allItems = [
      ...salesNavItems,
      ...financeNavItems,
      ...commonItems,
      { id: 'home', label: 'Menu Principal', icon: Home, show: true }
    ];
    return allItems.find((item) => item.id === activeTab)?.label || 'Navegação';
  }, [activeTab]);

  const availableModes = useMemo(() => {
    const modes: AppMode[] = [];
    if (isModuleVisible('sales')) modes.push('SALES');
    if (isModuleVisible('finance')) modes.push('FINANCE');
    if (!modes.length) return [appMode];
    return modes;
  }, [currentUser, systemConfig, isDev, appMode]);

  const handleModeSwitch = (mode: AppMode) => {
    if (mode === appMode) return;
    setAppMode(mode);
    if (mode === 'FINANCE') setActiveTab('fin_dashboard');
    else setActiveTab('dashboard');
  };

  const toggleAppMode = () => {
    const modes = availableModes;
    const currentIndex = modes.indexOf(appMode);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];

    Logger.info(`Módulo: Usuário alterou Modo Global de [${appMode}] para [${nextMode}]`, {
        userId: currentUser.id
    });

    setAppMode(nextMode);
    if (nextMode === 'FINANCE') setActiveTab('fin_dashboard');
    else setActiveTab('dashboard');
  };

  return (
    <div className={`flex h-[100dvh] overflow-hidden transition-all duration-500 relative ${currentStyle.background}`}>
      
      {/* Sidebar Desktop/Mobile */}
      <aside className={`fixed md:static inset-y-0 left-0 w-72 z-[80] flex flex-col transition-all duration-500 ease-in-out transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${currentStyle.sidebar} md:rounded-r-[2.5rem] md:my-4 md:ml-4 md:h-[calc(100vh-2rem)] shadow-2xl`}>
        <div className={`p-8 flex items-center justify-between border-b border-white/5`}>
          <Logo size="sm" variant="full" lightMode={['glass', 'cyberpunk', 'dark'].includes(currentTheme)} planUser={currentUser} />
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-white/50 hover:text-white p-2">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="mb-4">
            <div className="text-[9px] uppercase tracking-[0.3em] text-slate-400">Navegação</div>
            <div className="text-xs font-black text-white/90">{modeLabels[appMode]} • {activeLabel}</div>
          </div>
          {getCurrentNavItems().map((item) => (
            <button 
              key={item.id} 
              onClick={() => navigate(item.id)} 
              className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 group ${activeTab === item.id ? currentStyle.navActive(appMode) : currentStyle.navInactive}`}
            >
                <item.icon size={22} className={`transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="font-black text-[11px] uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5">
            <button onClick={onLogout} className="w-full flex items-center space-x-4 px-5 py-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all font-black text-[11px] uppercase tracking-widest">
                <LogOut size={22}/>
                <span>Sair do Sistema</span>
            </button>
        </div>
      </aside>

      {/* Mobile Header Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] animate-in fade-in" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Content Area */}
      <main className="flex-1 flex flex-col min-w-0 md:h-screen min-h-0">
        <header className="h-20 flex items-center justify-between px-6 md:px-10 shrink-0">
          <div className="flex items-center gap-4">
              <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-400 hover:text-white transition-colors">
                <Menu size={24} />
              </button>
              <div className="flex flex-col">
                  <SyncStatus />
                  <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {modeLabels[appMode]} • {activeLabel}
                  </div>
              </div>
              <div className="hidden lg:flex items-center gap-2">
                {availableModes.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleModeSwitch(mode)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                      appMode === mode
                        ? 'bg-white/10 text-white border-white/20'
                        : 'text-slate-400 border-white/10 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {modeLabels[mode]}
                  </button>
                ))}
              </div>
              <div className="hidden md:flex flex-col text-xs">
                <span className="text-slate-400 font-semibold">Você está em</span>
                <span className="text-white font-black">{modeLabels[appMode]} • {activeLabel}</span>
              </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <button onClick={toggleAppMode} className={`px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all ${appMode === 'SALES' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-blue-50/10 text-blue-400 border-blue-500/30'}`}>
                {modeLabels[appMode]}
            </button>
            <div className="w-px h-6 bg-white/10 hidden sm:block"></div>
            <NotificationCenter 
                notifications={notifications} 
                onNotificationClick={(notif) => {
                    if (notif.id?.startsWith('chat:')) {
                        navigate('chat');
                        return;
                    }
                    if (notif.id?.startsWith('ticket:')) {
                        navigate('tickets');
                        return;
                    }
                    if (notif.source === 'SALES') {
                        navigate('dashboard');
                        return;
                    }
                    if (notif.source === 'FINANCE') {
                        navigate('fin_dashboard');
                        return;
                    }
                    navigate('home');
                }} 
                onClearAll={onClearAllNotifications} 
            />
            <button onClick={() => setIsChatOpen(true)} className="relative p-2 text-slate-400 hover:text-white transition-colors">
                <MessageSquare size={22} />
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center ring-2 ring-slate-950 animate-pulse">{unreadCount}</span>}
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 md:px-10 pb-32 md:pb-10 custom-scrollbar">
           {children}

        </div>
      </main>

      {/* Floating Action Button */}
      <FAB 
        appMode={appMode} 
        onNewSale={onNewSale} 
        onNewIncome={onNewIncome} 
        onNewExpense={onNewExpense} 
        onNewTransfer={onNewTransfer} 
        isMobileView={true}
      />

      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={navigate} 
        appMode={appMode} 
        toggleMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
        hasUnreadMessages={unreadCount > 0} 
      />

      {isChatOpen && (
        <InternalChatSystem 
            currentUser={currentUser} 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)} 
            darkMode={['glass', 'cyberpunk', 'dark'].includes(currentTheme)}
            onNotify={onNotify}
        />
      )}
    </div>
  );
};

export default Layout;
