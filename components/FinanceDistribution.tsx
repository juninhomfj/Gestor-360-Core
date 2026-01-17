
import React, { useState, useEffect } from 'react';
import { Receivable, FinanceAccount } from '../types';
import { ArrowRight, DollarSign, Percent, Save, AlertCircle } from 'lucide-react';

interface FinanceDistributionProps {
  receivables: Receivable[];
  accounts: FinanceAccount[];
  onDistribute: (receivableId: string, distributions: { accountId: string, value: number }[]) => void;
  darkMode?: boolean;
}

const FinanceDistribution: React.FC<FinanceDistributionProps> = ({ receivables, accounts, onDistribute, darkMode }) => {
  const [selectedId, setSelectedId] = useState<string>('');
  
  // Dynamic Distribution State: { [accountId]: { mode: 'PERCENT' | 'VALUE', value: number } }
  const [distState, setDistState] = useState<Record<string, { mode: 'PERCENT' | 'VALUE', value: number }>>({});

  // Filter accounts marked for distribution
  const targetAccounts = accounts.filter(a => a.includeInDistribution);

  // Find effective and undistributed items
  const availableItems = receivables.filter(r => r.status === 'EFFECTIVE' && !r.distributed);
  const selectedItem = availableItems.find(r => r.id === selectedId);

  // Initialize state when selection changes or accounts load
  useEffect(() => {
      if (targetAccounts.length > 0) {
          const initialState: any = {};
          targetAccounts.forEach(acc => {
              // Default to 0 percent
              initialState[acc.id] = { mode: 'PERCENT', value: 0 };
          });
          // Simple heuristic: set first account to 100% just to have a default, or leave all 0
          if (targetAccounts.length > 0) initialState[targetAccounts[0].id] = { mode: 'PERCENT', value: 100 };
          
          setDistState(initialState);
      }
  }, [selectedId, accounts.length]); // Reset on selection change

  const getNetValue = (item: Receivable) => {
      const deductions = item.deductions?.reduce((acc, d) => acc + d.amount, 0) || 0;
      return item.value - deductions; // If item.value is already net (from quick effective), deductions should be empty, safe logic.
  };

  const currentTotalToDistribute = selectedItem ? getNetValue(selectedItem) : 0;

  // Calculate actual currency values based on state
  const calculatedDistribution = targetAccounts.map(acc => {
      const state = distState[acc.id] || { mode: 'PERCENT', value: 0 };
      let realValue = 0;
      if (state.mode === 'PERCENT') {
          realValue = (currentTotalToDistribute * state.value) / 100;
      } else {
          realValue = state.value;
      }
      return { accountId: acc.id, realValue };
  });

  const totalDistributed = calculatedDistribution.reduce((acc, curr) => acc + curr.realValue, 0);
  const remaining = currentTotalToDistribute - totalDistributed;
  const isBalanced = Math.abs(remaining) < 0.05; // Tolerance for floating point

  const handleInputChange = (accId: string, field: 'mode' | 'value', val: any) => {
      setDistState(prev => ({
          ...prev,
          [accId]: { ...prev[accId], [field]: val }
      }));
  };

  const handleConfirm = () => {
      if (!selectedItem) return;
      if (!isBalanced) {
          alert('O valor distribuído deve ser igual ao valor total do recebível.');
          return;
      }
      
      const dists = calculatedDistribution
          .filter(d => d.realValue > 0)
          .map(d => ({ accountId: d.accountId, value: d.realValue }));

      onDistribute(selectedItem.id, dists);
      setSelectedId('');
  };

  const bgClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-800';
  const inputClass = darkMode ? 'bg-black border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900';

  return (
    <div className="space-y-6">
       <div>
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Distribuição</h1>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Divida o valor LÍQUIDO entre as contas habilitadas</p>
       </div>

       {targetAccounts.length === 0 && (
           <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-4" role="alert">
               <p className="font-bold">Nenhuma conta configurada para distribuição.</p>
               <p>Vá em "Contas & Cartões", edite suas contas e marque a opção "Habilitar na Distribuição?".</p>
           </div>
       )}

       {availableItems.length === 0 ? (
           <div className={`p-12 text-center rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800 text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
               <p>Não há valores efetivados disponíveis para distribuição no momento.</p>
               <p className="text-sm mt-2">Vá em "A Receber" e marque um item como efetivado.</p>
           </div>
       ) : (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               {/* Selection List */}
               <div className={`col-span-1 p-4 rounded-xl border ${bgClass}`}>
                   <h3 className="font-bold mb-4">Disponível para Distribuir</h3>
                   <div className="space-y-2">
                       {availableItems.map(item => {
                           const net = getNetValue(item);
                           return (
                               <button
                                 key={item.id}
                                 onClick={() => setSelectedId(item.id)}
                                 className={`w-full text-left p-3 rounded border transition-all ${selectedId === item.id ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                               >
                                   <p className="font-medium">{item.description}</p>
                                   <div className="flex justify-between items-center mt-1">
                                       <span className="text-xs text-gray-500">Líquido:</span>
                                       <span className="text-emerald-600 font-bold">R$ {net.toFixed(2)}</span>
                                   </div>
                               </button>
                           );
                       })}
                   </div>
               </div>

               {/* Distributor Panel */}
               <div className={`col-span-1 lg:col-span-2 p-6 rounded-xl border ${bgClass}`}>
                   {selectedItem ? (
                       <>
                           <div className="flex justify-between items-start mb-6">
                               <h3 className="text-xl font-bold flex items-center gap-2">
                                   <DollarSign className="text-emerald-500" />
                                   Distribuindo: R$ {currentTotalToDistribute.toFixed(2)}
                               </h3>
                               <div className={`text-right ${isBalanced ? 'text-emerald-500' : 'text-orange-500'}`}>
                                   <p className="text-sm font-bold">Restante: R$ {remaining.toFixed(2)}</p>
                                   {!isBalanced && <p className="text-xs">Distribua todo o valor.</p>}
                               </div>
                           </div>

                           <div className="space-y-4">
                               {targetAccounts.map(acc => {
                                   const state = distState[acc.id] || { mode: 'PERCENT', value: 0 };
                                   const realVal = calculatedDistribution.find(d => d.accountId === acc.id)?.realValue || 0;

                                   return (
                                       <div key={acc.id} className={`p-4 rounded border flex flex-col md:flex-row items-center gap-4 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                                           <div className="flex-1">
                                               <p className="font-bold">{acc.name}</p>
                                               <p className="text-xs opacity-70">{acc.type} - {acc.personType}</p>
                                           </div>
                                           
                                           <div className="flex items-center gap-2">
                                               <div className={`flex rounded overflow-hidden border ${darkMode ? 'border-slate-600' : 'border-gray-300'}`}>
                                                   <button 
                                                        onClick={() => handleInputChange(acc.id, 'mode', 'PERCENT')}
                                                        className={`px-3 py-2 text-xs font-bold ${state.mode === 'PERCENT' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-500'}`}
                                                   >
                                                       %
                                                   </button>
                                                   <button 
                                                        onClick={() => handleInputChange(acc.id, 'mode', 'VALUE')}
                                                        className={`px-3 py-2 text-xs font-bold ${state.mode === 'VALUE' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-500'}`}
                                                   >
                                                       R$
                                                   </button>
                                               </div>
                                               
                                               <input 
                                                 type="number"
                                                 className={`w-24 p-2 rounded border font-bold text-right ${inputClass}`}
                                                 value={state.value}
                                                 onChange={e => handleInputChange(acc.id, 'value', parseFloat(e.target.value) || 0)}
                                               />
                                           </div>

                                           <div className="w-24 text-right font-bold text-emerald-600">
                                               R$ {realVal.toFixed(2)}
                                           </div>
                                       </div>
                                   );
                               })}
                           </div>

                           <div className="flex justify-end items-center pt-4 mt-6 border-t border-gray-200 dark:border-slate-700">
                               <button 
                                 onClick={handleConfirm}
                                 disabled={!isBalanced}
                                 className={`px-6 py-3 rounded-lg font-bold text-white flex items-center gap-2 ${isBalanced ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-400 cursor-not-allowed'}`}
                               >
                                   <Save size={20} />
                                   Confirmar & Lançar
                               </button>
                           </div>
                       </>
                   ) : (
                       <div className="h-full flex items-center justify-center text-gray-400 flex-col">
                           <AlertCircle size={48} className="mb-2 opacity-20"/>
                           <p>Selecione um item à esquerda para distribuir.</p>
                       </div>
                   )}
               </div>
           </div>
       )}
    </div>
  );
};

export default FinanceDistribution;
