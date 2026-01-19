
import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, Info, CheckCircle, Clock, Trash2, X } from 'lucide-react';
import { AppNotification } from '../types';
import { AudioService } from '../services/audioService';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onNotificationClick: (notif: AppNotification) => void;
  onClearAll?: () => void;
}

interface NotificationItemProps {
  notif: AppNotification;
  onClick: (notif: AppNotification) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notif, onClick }) => {
    let icon = <Info size={16} className="text-blue-500" />;
    if (notif.type === 'ALERT') icon = <AlertTriangle size={16} className="text-red-500" />;
    if (notif.type === 'WARNING') icon = <Clock size={16} className="text-amber-500" />;

    return (
        <button 
          onClick={() => onClick(notif)}
          className="w-full text-left p-4 md:p-3 hover:bg-gray-50 dark:hover:bg-slate-800 border-b border-gray-100 dark:border-slate-700 transition-colors flex gap-3 items-start"
        >
            <div className="mt-0.5 shrink-0 flex items-start">{icon}</div>
            <div className="flex-1">
                <div className="flex justify-between items-center mb-0.5">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        {notif.source === 'SALES' ? 'Vendas' : (notif.source === 'FINANCE' ? 'Finanças' : (notif.source === 'WHATSAPP' ? 'WhatsApp' : 'Sistema'))}
                    </p>
                    <span className="text-[10px] text-gray-400">{new Date(notif.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-tight">{notif.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">{notif.message}</p>
            </div>
        </button>
    );
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications, onNotificationClick, onClearAll }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prevCount, setPrevCount] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({ top: 0 });

  const count = notifications.length;

  useEffect(() => {
      // Play sound if notifications increased
      if (count > prevCount) {
          AudioService.play('NOTIFICATION');
      }
      setPrevCount(count);
  }, [count, prevCount]);

  const toggleOpen = () => {
      if (!isOpen && buttonRef.current) {
          // Smart Positioning Logic (Desktop Only)
          const rect = buttonRef.current.getBoundingClientRect();
          const screenWidth = window.innerWidth;
          
          if (screenWidth >= 768) { // Only calculate for desktop
              const isLeftSide = rect.left < (screenWidth / 2);
              const style: React.CSSProperties = {
                  top: rect.bottom + 10,
                  maxHeight: 'calc(100vh - 100px)',
                  position: 'fixed',
                  ...(isLeftSide ? { left: rect.left } : { right: screenWidth - rect.right })
              };
              setDropdownStyle(style);
          }
      }
      setIsOpen(!isOpen);
  };

  const handleClick = (notif: AppNotification) => {
      onNotificationClick(notif);
      setIsOpen(false);
  };

  return (
    <>
        <button 
            ref={buttonRef}
            onClick={toggleOpen}
            className={`relative p-2 rounded-lg transition-colors group ${isOpen ? 'bg-gray-100 dark:bg-slate-800 text-emerald-600' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
        >
            <div className={count > 0 ? 'animate-swing origin-top' : ''}>
                <Bell size={20} />
            </div>
            
            {count > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                    {count > 9 ? '9+' : count}
                </span>
            )}
        </button>

        {isOpen && (
            <>
                <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none" onClick={() => setIsOpen(false)}></div>
                
                {/* 
                    MOBILE: Full Screen / Fixed Bottom Sheet style
                    DESKTOP: Floating Dropdown 
                */}
                <div 
                    className={`
                        fixed z-[120] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200
                        inset-0 md:inset-auto md:w-80 md:rounded-xl
                    `}
                    style={window.innerWidth >= 768 ? dropdownStyle : {}}
                >
                    <div className="p-4 md:p-3 border-b border-gray-100 dark:border-slate-700 font-bold text-gray-700 dark:text-white flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
                        <span className="flex items-center gap-2 text-lg md:text-sm"><Bell size={18} className="text-emerald-500"/> Notificações</span>
                        
                        <div className="flex items-center gap-3">
                            {count > 0 && (
                                <span className="text-[10px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full shadow-sm">{count} novas</span>
                            )}
                            {/* Botão de fechar explícito para mobile */}
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="p-2 bg-gray-200 dark:bg-slate-700 rounded-full md:p-1 md:bg-transparent dark:text-slate-100"
                            >
                                <X size={20} className="text-gray-600 dark:text-gray-300" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 scrollbar-thin max-h-[calc(100dvh-120px)] md:max-h-[400px]">
                        {count === 0 ? (
                            <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                                <CheckCircle size={48} className="mx-auto mb-3 opacity-20" />
                                <p className="text-lg font-medium">Tudo em ordem!</p>
                                <p className="text-sm mt-1">Nenhuma pendência encontrada.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-slate-800">
                                {notifications.map(n => <NotificationItem key={n.id} notif={n} onClick={handleClick} />)}
                            </div>
                        )}
                    </div>

                    {count > 0 && onClearAll && (
                        <div className="p-4 md:p-2 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 safe-area-pb dark:text-slate-100">
                            <button 
                                onClick={() => { onClearAll(); setIsOpen(false); }}
                                className="w-full py-3 md:py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center justify-center gap-2 transition-colors border border-red-100 dark:border-red-900/30"
                            >
                                <Trash2 size={16}/> Limpar Todas
                            </button>
                        </div>
                    )}
                </div>
            </>
        )}
    </>
  );
};

export default NotificationCenter;
