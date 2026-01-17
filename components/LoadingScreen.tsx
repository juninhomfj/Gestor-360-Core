
import React from 'react';
import { ShoppingBag } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[99999] transition-opacity duration-300">
      <div className="relative">
        <div className="absolute inset-0 bg-emerald-500/20 blur-[100px] rounded-full animate-pulse"></div>
        <div className="relative bg-slate-900 p-8 rounded-3xl shadow-2xl border border-white/5 mb-6">
            <ShoppingBag size={64} className="text-emerald-500 animate-bounce" />
        </div>
      </div>
      
      <h1 className="text-3xl font-black text-white tracking-tighter mb-2">
        Gestor<span className="text-emerald-500 italic">360</span>
      </h1>
      
      <div className="flex gap-2 mb-4">
        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
      
      <p className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.3em] animate-pulse">Sincronizando Ecossistema</p>
    </div>
  );
};

export default LoadingScreen;
