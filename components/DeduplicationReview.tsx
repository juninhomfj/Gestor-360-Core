
import React, { useState } from 'react';
import { Sale, Transaction, DuplicateGroup } from '../types';
import { smartMergeSales } from '../services/logic';
import { Trash2, Merge, CheckCircle, X, ChevronRight, AlertTriangle, Calendar, DollarSign, FileText } from 'lucide-react';

interface DeduplicationReviewProps {
  salesDuplicates: DuplicateGroup<Sale>[];
  transactionDuplicates: DuplicateGroup<Transaction>[];
  onResolveSales: (resolvedSales: Sale[], deletedIds: string[]) => void;
  onResolveTransactions: (resolvedTransactions: Transaction[], deletedIds: string[]) => void;
  onClose: () => void;
  darkMode?: boolean;
}

const DeduplicationReview: React.FC<DeduplicationReviewProps> = ({ 
    salesDuplicates, transactionDuplicates, onResolveSales, onResolveTransactions, onClose, darkMode 
}) => {
  const [activeTab, setActiveTab] = useState<'SALES' | 'FINANCE'>('SALES');
  const [resolvedGroups, setResolvedGroups] = useState<Set<string>>(new Set());

  // --- ACTIONS ---

  const handleResolveGroup = (group: DuplicateGroup<any>, action: 'KEEP_OLDEST' | 'MERGE' | 'DELETE_ALL', specificKeepId?: string) => {
      const items = group.items;
      
      // Determine final item
      let finalItem: any = null;
      let idsToDelete: string[] = [];

      if (action === 'DELETE_ALL') {
          idsToDelete = items.map(i => i.id);
      } else if (action === 'KEEP_OLDEST' || (action === 'MERGE' && activeTab === 'FINANCE')) { 
          // For finance or simple keep, keep oldest created
          // If specificKeepId provided, keep that one
          if (specificKeepId) {
              finalItem = items.find(i => i.id === specificKeepId);
              idsToDelete = items.filter(i => i.id !== specificKeepId).map(i => i.id);
          } else {
              // Sort by ID or Date if avail (simple approach: items are usually already sorted by logic)
              finalItem = items[0];
              idsToDelete = items.slice(1).map(i => i.id);
          }
      } else if (action === 'MERGE' && activeTab === 'SALES') {
          // Smart Merge for Sales
          finalItem = smartMergeSales(items as Sale[]);
          // In merge, we conceptually keep the master ID and remove others
          idsToDelete = items.filter(i => i.id !== finalItem.id).map(i => i.id);
      }

      // Execute Callback
      if (activeTab === 'SALES') {
          if (finalItem) {
              // Update master in parent list? No, parent expects resolved list to SAVE.
              // Actually, logic.ts handles saving. We need to pass back what to KEEP and what to DELETE.
              // The callback expects (resolvedItems, deletedIds). 
              // Since we are doing one by one, we might need a better flow.
              // Simplification: We trigger the update immediately for this group.
              onResolveSales([finalItem], idsToDelete);
          } else {
              onResolveSales([], idsToDelete);
          }
      } else {
          if (finalItem) {
              onResolveTransactions([finalItem], idsToDelete);
          } else {
              onResolveTransactions([], idsToDelete);
          }
      }

      // Mark visual state
      setResolvedGroups(new Set([...resolvedGroups, group.id]));
  };

  // --- RENDER HELPERS ---

  const renderSaleGroup = (group: DuplicateGroup<Sale>) => (
      <div key={group.id} className={`mb-4 border rounded-xl overflow-hidden ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-white'}`}>
          <div className={`p-3 border-b flex justify-between items-center ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span className="font-bold text-sm">Conflito: {group.items[0].client}</span>
                  <span className="text-xs opacity-60">({group.items.length} registros)</span>
              </div>
              <div className="flex gap-2">
                  <button onClick={() => handleResolveGroup(group, 'MERGE')} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 flex items-center gap-1">
                      <Merge size={12}/> Mesclar Tudo
                  </button>
                  <button onClick={() => handleResolveGroup(group, 'DELETE_ALL')} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 flex items-center gap-1">
                      <Trash2 size={12}/> Excluir Todos
                  </button>
              </div>
          </div>
          
          <div className="p-3 grid gap-2">
              {group.items.map(item => (
                  <div key={item.id} className={`flex justify-between items-center p-2 rounded border ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="text-xs">
                          <p><strong className="text-emerald-500">R$ {item.valueSold}</strong> em {new Date(item.date || item.completionDate || 0).toLocaleDateString()}</p>
                          <p className="opacity-70 truncate max-w-[200px]">{item.observations || 'Sem observação'}</p>
                      </div>
                      <button onClick={() => handleResolveGroup(group, 'KEEP_OLDEST', item.id)} className="text-xs border border-green-500 text-green-500 hover:bg-green-500 hover:text-white px-3 py-1 rounded transition-colors">
                          Manter Este
                      </button>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderTransactionGroup = (group: DuplicateGroup<Transaction>) => (
      <div key={group.id} className={`mb-4 border rounded-xl overflow-hidden ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-white'}`}>
          <div className={`p-3 border-b flex justify-between items-center ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span className="font-bold text-sm">{group.items[0].description}</span>
                  <span className="text-xs opacity-60">({group.items.length} itens)</span>
              </div>
              <button onClick={() => handleResolveGroup(group, 'DELETE_ALL')} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 flex items-center gap-1">
                  <Trash2 size={12}/> Excluir Todos
              </button>
          </div>
          <div className="p-3 grid gap-2">
              {group.items.map(item => (
                  <div key={item.id} className={`flex justify-between items-center p-2 rounded border ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="text-xs">
                          <p><strong>R$ {item.amount}</strong> - {new Date(item.date).toLocaleDateString()}</p>
                          <p className="opacity-70">{item.type} via {item.personType}</p>
                      </div>
                      <button onClick={() => handleResolveGroup(group, 'KEEP_OLDEST', item.id)} className="text-xs border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white px-3 py-1 rounded transition-colors">
                          Manter Este
                      </button>
                  </div>
              ))}
          </div>
      </div>
  );

  const visibleSalesGroups = salesDuplicates.filter(g => !resolvedGroups.has(g.id));
  const visibleTxGroups = transactionDuplicates.filter(g => !resolvedGroups.has(g.id));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <div className={`w-full max-w-2xl h-[80vh] flex flex-col rounded-2xl shadow-2xl ${darkMode ? 'bg-slate-900 text-white border border-slate-700' : 'bg-white text-gray-900'}`}>
            
            <div className="p-5 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Merge className="text-purple-500" /> Analisar Duplicatas
                </h3>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full" aria-label="Fechar" title="Fechar"><X size={20}/></button>
            </div>

            <div className="flex p-2 gap-2 bg-gray-50 dark:bg-slate-950/50 border-b border-gray-200 dark:border-slate-800 dark:text-slate-100">
                <button 
                    onClick={() => setActiveTab('SALES')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'SALES' ? 'bg-white dark:bg-slate-800 shadow text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}
                >
                    Vendas <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{visibleSalesGroups.length}</span>
                </button>
                <button 
                    onClick={() => setActiveTab('FINANCE')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'FINANCE' ? 'bg-white dark:bg-slate-800 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}
                >
                    Financeiro <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{visibleTxGroups.length}</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'SALES' && (
                    <>
                        {visibleSalesGroups.length === 0 && <p className="text-center text-gray-500 py-10">Nenhuma duplicata de venda pendente.</p>}
                        {visibleSalesGroups.map(renderSaleGroup)}
                    </>
                )}
                {activeTab === 'FINANCE' && (
                    <>
                        {visibleTxGroups.length === 0 && <p className="text-center text-gray-500 py-10">Nenhuma duplicata financeira pendente.</p>}
                        {visibleTxGroups.map(renderTransactionGroup)}
                    </>
                )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex justify-end dark:text-slate-100">
                <button onClick={onClose} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-lg">Concluir Análise</button>
            </div>
        </div>
    </div>
  );
};

export default DeduplicationReview;
