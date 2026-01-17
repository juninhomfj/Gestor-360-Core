
import React, { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight, ShoppingCart, X } from 'lucide-react';
import { AppMode } from '../types';

interface FABProps {
  appMode: AppMode;
  onNewSale: () => void;
  onNewIncome: () => void;
  onNewExpense: () => void;
  onNewTransfer: () => void;
  isMobileView?: boolean;
}

const FAB: React.FC<FABProps> = ({ appMode, onNewSale, onNewIncome, onNewExpense, onNewTransfer, isMobileView }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Define o deslocamento vertical se estiver no mobile para não cobrir a BottomNav
  const bottomClass = isMobileView ? 'bottom-20' : 'bottom-6';

  // SALES MODE: Simple Button
  if (appMode === 'SALES') {
    return (
      <button
        onClick={onNewSale}
        className={`fixed ${bottomClass} right-6 z-50 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center border-2 border-white/20`}
        title="Nova Venda"
      >
        <Plus size={28} />
      </button>
    );
  }

  if (appMode === 'ERP') {
    return null;
  }

  // FINANCE MODE: Speed Dial
  return (
    <div className={`fixed ${bottomClass} right-6 z-50 flex flex-col items-end space-y-3`}>
      {/* Menu Items */}
      <div className={`transition-all duration-300 flex flex-col items-end space-y-3 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
        
        <div className="flex items-center space-x-2">
            <span className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-white/10 opacity-0 md:opacity-100 transition-opacity">Transferência</span>
            <button
                onClick={() => { onNewTransfer(); setIsOpen(false); }}
                className="w-12 h-12 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 flex items-center justify-center border-2 border-white/10"
            >
                <ArrowLeftRight size={20} />
            </button>
        </div>

        <div className="flex items-center space-x-2">
            <span className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-white/10 opacity-0 md:opacity-100 transition-opacity">Nova Receita</span>
            <button
                onClick={() => { onNewIncome(); setIsOpen(false); }}
                className="w-12 h-12 bg-emerald-600 text-white rounded-full shadow-xl hover:bg-emerald-700 flex items-center justify-center border-2 border-white/10"
            >
                <TrendingUp size={20} />
            </button>
        </div>

        <div className="flex items-center space-x-2">
            <span className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-white/10 opacity-0 md:opacity-100 transition-opacity">Nova Despesa</span>
            <button
                onClick={() => { onNewExpense(); setIsOpen(false); }}
                className="w-12 h-12 bg-red-600 text-white rounded-full shadow-xl hover:bg-red-700 flex items-center justify-center border-2 border-white/10"
            >
                <TrendingDown size={20} />
            </button>
        </div>
      </div>

      {/* Main Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all border-2 border-white/20 ${
            isOpen ? 'bg-slate-800 text-white rotate-45' : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        <Plus size={28} />
      </button>
    </div>
  );
};

export default FAB;
