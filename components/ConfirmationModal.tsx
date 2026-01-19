
import React, { useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'DANGER' | 'WARNING' | 'INFO';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
    isOpen, onClose, onConfirm, title, message, 
    confirmText = 'Confirmar', cancelText = 'Cancelar', type = 'DANGER' 
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
      setIsDeleting(true);
      // Delay visual para a animação da lixeira acontecer
      if (type === 'DANGER') {
          await new Promise(resolve => setTimeout(resolve, 1500));
      }
      onConfirm();
      setIsDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700 transform transition-all scale-100 dark:text-slate-100">
            
            <div className="p-6 text-center">
                {/* ÍCONE ANIMADO */}
                <div className="relative w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    {type === 'DANGER' ? (
                        <div className={`w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center relative overflow-visible transition-all duration-500 ${isDeleting ? 'scale-110' : ''}`}>
                            <Trash2 size={40} className={`text-red-600 dark:text-red-500 relative z-10 transition-transform ${isDeleting ? 'animate-bounce' : ''}`} />
                            
                            {/* Animação de Papel Caindo */}
                            {isDeleting && (
                                <>
                                    <div className="absolute -top-4 w-3 h-4 bg-white dark:bg-slate-200 shadow-sm rounded-sm animate-trash-paper-1 z-20 dark:text-slate-100"></div>
                                    <div className="absolute -top-6 w-2 h-3 bg-white dark:bg-slate-200 shadow-sm rounded-sm animate-trash-paper-2 z-20 dark:text-slate-100"></div>
                                    <div className="absolute -top-2 w-2.5 h-3.5 bg-white dark:bg-slate-200 shadow-sm rounded-sm animate-trash-paper-1 z-20 dark:text-slate-100" style={{ animationDelay: '0.3s' }}></div>
                                </>
                            )}
                        </div>
                    ) : type === 'WARNING' ? (
                        <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <AlertTriangle size={40} className="text-amber-600 dark:text-amber-500" />
                        </div>
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <CheckCircle size={40} className="text-blue-600 dark:text-blue-500" />
                        </div>
                    )}
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {isDeleting ? 'Excluindo...' : title}
                </h3>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
                    {message}
                </p>

                <div className="flex gap-3">
                    <button 
                        onClick={onClose}
                        disabled={isDeleting}
                        className="flex-1 py-3 px-4 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={isDeleting}
                        className={`flex-1 py-3 px-4 text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                            type === 'DANGER' 
                            ? 'bg-red-600 hover:bg-red-700 shadow-red-900/20' 
                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'
                        }`}
                    >
                        {isDeleting ? 'Processando...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ConfirmationModal;
