
import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, BellOff } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'INFO';
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
  onMute?: (message: string, durationMs: number) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast, onMute }) => {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none p-4 md:p-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} onMute={onMute} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: (id: string) => void; onMute?: (message: string, duration: number) => void }> = ({ toast, onRemove, onMute }) => {
  const [isFading, setIsFading] = useState(false);
  const [showMuteOptions, setShowMuteOptions] = useState(false);
  const DURATION = 4000; // 4 seconds

  useEffect(() => {
    // If mute options are open, prevent auto-close
    if (showMuteOptions) {
      setIsFading(false);
      return;
    }

    setIsFading(false);

    // Start fade out shortly before removal
    const fadeTimer = setTimeout(() => {
        setIsFading(true);
    }, DURATION - 500);

    const removeTimer = setTimeout(() => {
      onRemove(toast.id);
    }, DURATION);

    return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
    };
  }, [toast.id, onRemove, showMuteOptions]);

  const styles = {
    SUCCESS: 'bg-white dark:bg-slate-800 border-l-4 border-emerald-500 text-gray-800 dark:text-gray-100 shadow-xl',
    ERROR: 'bg-white dark:bg-slate-800 border-l-4 border-red-500 text-gray-800 dark:text-gray-100 shadow-xl',
    INFO: 'bg-white dark:bg-slate-800 border-l-4 border-blue-500 text-gray-800 dark:text-gray-100 shadow-xl',
  };

  const icons = {
    SUCCESS: <CheckCircle size={22} className="text-emerald-500" />,
    ERROR: <AlertCircle size={22} className="text-red-500" />,
    INFO: <Info size={22} className="text-blue-500" />,
  };

  const handleMute = (durationMinutes: number) => {
      if (onMute) {
          onMute(toast.message, durationMinutes * 60 * 1000);
          // O toast é removido automaticamente pelo parent após mutar
      }
  };

  // SVG Circle Parameters
  const radius = 9; 
  const circumference = 2 * Math.PI * radius;

  return (
    <div 
        className={`pointer-events-auto min-w-[300px] max-w-md p-4 rounded-lg flex items-start gap-3 transform transition-all duration-500 ${styles[toast.type]} ${isFading ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-in slide-in-from-right'}`}
        onMouseEnter={() => setShowMuteOptions(true)} // Keep alive on hover
        onMouseLeave={() => setShowMuteOptions(false)}
    >
      <div className="mt-0.5 shrink-0">{icons[toast.type]}</div>
      
      <div className="flex-1">
          <div className="text-sm font-medium leading-relaxed pt-0.5">{toast.message}</div>
          
          {/* MUTE OPTIONS */}
          {showMuteOptions && onMute && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700 animate-in fade-in">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 flex items-center gap-1">
                      <BellOff size={10} /> Silenciar este aviso por:
                  </p>
                  <div className="flex gap-1">
                      <button onClick={() => handleMute(1)} className="px-2 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 text-xs rounded transition-colors dark:text-slate-100">1m</button>
                      <button onClick={() => handleMute(5)} className="px-2 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 text-xs rounded transition-colors dark:text-slate-100">5m</button>
                      <button onClick={() => handleMute(60)} className="px-2 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 text-xs rounded transition-colors dark:text-slate-100">1h</button>
                  </div>
              </div>
          )}
      </div>
      
      {/* Timer Container (Hidden if showing options to reduce clutter) */}
      {!showMuteOptions && (
          <div className="relative flex items-center justify-center w-6 h-6 shrink-0 ml-2">
              <svg 
                className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                 <circle
                    cx="12"
                    cy="12"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-gray-100 dark:text-slate-700"
                 />
                 <circle
                    cx="12"
                    cy="12"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={circumference}
                    strokeDashoffset={0}
                    strokeLinecap="round"
                    className="text-gray-400 dark:text-slate-500 opacity-80 animate-countdown"
                    style={{ animationDuration: '4s' }}
                 />
              </svg>
              
              <button 
                onClick={() => onRemove(toast.id)} 
                className="relative z-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X size={12} />
              </button>
          </div>
      )}
      
      {/* Explicit close button when options showing */}
      {showMuteOptions && (
          <button 
            onClick={() => onRemove(toast.id)} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X size={14} />
          </button>
      )}
    </div>
  );
};

export default ToastContainer;
