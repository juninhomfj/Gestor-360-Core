import React, { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { bootstrapLock } from '../services/bootstrapLock';

/**
 * ETAPA 2: Indicador de Bootstrap
 * Mostra status do carregamento do sistema em background
 */

interface BootstrapIndicatorProps {
  isDarkMode?: boolean;
}

const BootstrapIndicator: React.FC<BootstrapIndicatorProps> = ({ isDarkMode = true }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Mostra apenas se bootstrap não está pronto
    if (!bootstrapLock.isReady()) {
      setIsVisible(true);
    }

    // Escuta conclusão
    const unsubscribe = bootstrapLock.onBootstrapComplete(() => {
      setIsReady(true);
      // Desaparece após 2 segundos
      const timeout = setTimeout(() => setIsVisible(false), 2000);
      return () => clearTimeout(timeout);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[100] animate-in fade-in slide-in-from-left-4">
      <div className={`rounded-full p-3 flex items-center gap-2 shadow-lg border transition-all ${
        isDarkMode 
          ? 'bg-slate-900/95 border-slate-700 text-indigo-400' 
          : 'bg-white/95 border-gray-200 text-indigo-600'
      }`}>
        {isReady ? (
          <>
            <Check size={18} className="animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-widest">Sistema Pronto</span>
          </>
        ) : (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span className="text-xs font-semibold uppercase tracking-widest">Carregando Sistema</span>
          </>
        )}
      </div>
    </div>
  );
};

export default BootstrapIndicator;
