
import React from 'react';
import { Send, Check, X, Mail } from 'lucide-react';

interface InvitationSentModalProps {
  email: string;
  onClose: () => void;
}

const InvitationSentModal: React.FC<InvitationSentModalProps> = ({ email, onClose }) => {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 relative overflow-hidden text-center dark:text-slate-100">
        
        {/* Elementos Decorativos de Fundo */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
        
        {/* Container da Animação */}
        <div className="relative h-32 w-full flex items-center justify-center mb-6">
            {/* O Avião */}
            <div className="absolute animate-plane-takeoff text-indigo-500">
                <Send size={48} className="rotate-[-45deg] drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
            </div>

            {/* Ícone de Sucesso que aparece no final */}
            <div className="animate-success-pop flex flex-col items-center">
                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] border-4 border-emerald-400/20">
                    <Check size={40} className="text-white stroke-[3px]" />
                </div>
            </div>
            
            {/* Trilha de decolagem (SVG) */}
            <svg className="absolute w-full h-full pointer-events-none opacity-20" viewBox="0 0 200 100">
                <path d="M20,80 Q60,20 180,10" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400 animate-trail" />
            </svg>
        </div>

        <div className="space-y-3 relative z-10">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Convite a caminho!</h3>
            <div className="flex flex-col items-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 mb-1">
                    <Mail size={20} />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Instruções de acesso e criação de senha foram enviadas para o endereço:
                </p>
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-black/5 dark:border-white/5 w-full dark:text-slate-100">
                    <span className="font-mono text-xs font-bold text-indigo-500 break-all select-all">{email}</span>
                </div>
            </div>
        </div>

        <div className="mt-10">
            <button 
                onClick={onClose}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-900/20 active:scale-95 uppercase text-[10px] tracking-[0.2em] border border-white/10"
            >
                Excelente, fechar
            </button>
            <p className="text-[10px] text-gray-400 mt-4 uppercase font-bold tracking-widest opacity-50">Gestor360 Cloud Identity</p>
        </div>

        <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
        >
            <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default InvitationSentModal;
