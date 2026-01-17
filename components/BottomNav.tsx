import React from 'react';
import { LayoutDashboard, ShoppingCart, Users, Menu, PieChart, Home } from 'lucide-react';
import { AppMode } from '../types';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  appMode: AppMode;
  toggleMenu: () => void;
  hasUnreadMessages: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  appMode,
  toggleMenu,
  hasUnreadMessages
}) => {
  const isSales = appMode === 'SALES';

  const items = [
    { id: 'home', label: 'Início', icon: Home },
    { id: isSales ? 'dashboard' : 'fin_dashboard', label: 'Painel', icon: LayoutDashboard },
    {
      id: isSales ? 'sales' : 'fin_transactions',
      label: isSales ? 'Vendas' : 'Extrato',
      icon: isSales ? ShoppingCart : PieChart
    },
    { id: 'settings', label: 'Config', icon: Users }
  ];

  const themeColor = isSales ? 'text-emerald-500' : 'text-blue-500';
  const glowColor = isSales ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)';

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-slate-950/90 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 relative ${isActive ? themeColor : 'text-slate-500'}`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isActive && (
                <div
                  className="absolute top-0 w-10 h-1 rounded-full bg-current shadow-[0_0_15px_current]"
                  style={{ boxShadow: `0 0 15px ${glowColor}` }}
                ></div>
              )}
              <item.icon size={22} className={`${isActive ? 'scale-110' : 'scale-100'} transition-transform duration-300`} />
              <span className="text-[10px] font-black uppercase tracking-tighter mt-1">{item.label}</span>
            </button>
          );
        })}

        {/* Botão de Menu (Trigger da Sidebar) */}
        <button
          onClick={toggleMenu}
          className="flex flex-col items-center justify-center flex-1 h-full text-slate-500 active:scale-90 transition-all"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <div className="relative">
            <Menu size={22} />
            {hasUnreadMessages && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950"></span>
            )}
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter mt-1">Menu</span>
        </button>
      </div>

      {/* Espaçador Dinâmico para iOS (Home Indicator) */}
      <div className="h-[env(safe-area-inset-bottom)] w-full bg-transparent"></div>
    </nav>
  );
};

export default BottomNav;
