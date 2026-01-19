
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, TransactionCategory, FinanceAccount, ImportMapping } from '../types';
import { 
    Filter, Trash2, CheckCircle2, Clock, PlayCircle, TrendingUp, TrendingDown, 
    ArrowLeftRight, Paperclip, X, FileText, Image as ImageIcon, ChevronLeft, 
    ChevronRight, Upload, Download, Loader2, ShieldAlert 
} from 'lucide-react';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import TransactionSettleModal from './TransactionSettleModal';
import FinanceImportModal from './FinanceImportModal';
import { processFinanceImport, readExcelFile, exportReportToCSV, saveFinanceData, markAsReconciled, bulkMarkAsReconciled } from '../services/logic';

interface FinanceTransactionsListProps {
  transactions: Transaction[];
  accounts: FinanceAccount[];
  categories: TransactionCategory[];
  onDelete: (id: string) => void;
  onPay?: (transaction: Transaction, details: { accountId: string; amount: number; date: string; attachments?: string[] }) => void;
  darkMode?: boolean;
  initialFilter?: 'ALL' | 'PENDING';
}

const FinanceTransactionsList: React.FC<FinanceTransactionsListProps> = ({ 
    transactions, accounts, categories, onDelete, onPay, darkMode, initialFilter = 'ALL' 
}) => {
  const [viewMode, setViewMode] = useState<'ALL' | 'PENDING'>(initialFilter);
  const [filterType, setFilterType] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(25);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      setViewMode(initialFilter);
      setCurrentPage(1); 
  }, [initialFilter]);

  const filtered = useMemo(() => {
      return transactions.filter(t => {
          if (viewMode === 'PENDING') {
              if (t.isPaid) return false;
          }
          if (filterType !== 'ALL' && t.type !== filterType) return false;
          if (filterMonth && !t.date.startsWith(filterMonth)) return false;
          return true;
      }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, viewMode, filterType, filterMonth]);

  const paginatedTransactions = useMemo(() => {
      if (itemsPerPage === 'ALL') return filtered;
      const startIndex = (currentPage - 1) * (itemsPerPage as number);
      return filtered.slice(startIndex, startIndex + (itemsPerPage as number));
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(filtered.length / (itemsPerPage as number));

  const getCategoryName = (id: string) => {
      if (id === 'DISTRIBUTION') return 'Distribuição de Lucros';
      if (id === 'CARD_PAYMENT') return 'Pagamento de Fatura';
      if (id === 'uncategorized') return 'Sem Categoria';
      return categories.find(c => c.id === id)?.name || 'Outros';
  };
  
  const getAccountName = (id?: string) => accounts.find(a => a.id === id)?.name || '-';

  const handleToggleReconciliation = async (txId: string, current: boolean) => {
      await markAsReconciled(txId, !current);
  };

  const handleBulkReconcile = async (status: boolean) => {
      if (selectedIds.length === 0) return;
      await bulkMarkAsReconciled(selectedIds, status);
      setSelectedIds([]);
  };

  const getTypeIcon = (type: string) => {
      if (type === 'INCOME') return <TrendingUp size={18} className="text-emerald-500" />;
      if (type === 'EXPENSE') return <TrendingDown size={18} className="text-red-500" />;
      return <ArrowLeftRight size={18} className="text-blue-500" />;
  };

  const handleExport = () => {
      const data = filtered.map(t => ({
          Data: new Date(t.date).toLocaleDateString('pt-BR'),
          Descrição: t.description,
          Valor: t.amount.toFixed(2),
          Tipo: t.type === 'INCOME' ? 'Receita' : t.type === 'EXPENSE' ? 'Despesa' : 'Transferência',
          Categoria: getCategoryName(t.categoryId),
          Conta: getAccountName(t.accountId),
          Status: t.isPaid ? 'Pago' : 'Pendente',
          Conciliado: t.reconciled ? 'Sim' : 'Não'
      }));
      exportReportToCSV(data, `extrato_financeiro_${new Date().toISOString().slice(0,10)}`);
  };

  return (
      <div className="space-y-6">
          
          {selectedIds.length > 0 && (
              <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10 border border-white/10">
                  <span className="font-black text-xs uppercase tracking-widest">{selectedIds.length} Itens Selecionados</span>
                  <div className="h-8 w-px bg-white/20"></div>
                  <div className="flex gap-2">
                      <button onClick={() => handleBulkReconcile(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 rounded-xl text-xs font-black uppercase transition-all">
                          <ShieldCheckIcon size={16}/> Conciliar
                      </button>
                      <button onClick={() => setSelectedIds([])} className="p-2 hover:bg-white/10 rounded-full"><X size={18}/></button>
                  </div>
              </div>
          )}

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-xl dark:text-slate-100">
                  <button onClick={() => setViewMode('ALL')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'ALL' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-gray-500'}`}>TODOS</button>
                  <button onClick={() => setViewMode('PENDING')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'PENDING' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm' : 'text-gray-500'}`}>PENDENTES</button>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={handleExport} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-bold ${darkMode ? 'border-slate-700 text-slate-300' : 'border-gray-200 text-gray-600'}`}>
                      <Download size={16}/> Exportar
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700">
                      {isImporting ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>} Importar
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.csv" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsImporting(true);
                      try {
                          const rows = await readExcelFile(file);
                          setImportData(rows);
                          setImportModalOpen(true);
                      } catch (err) { alert("Erro ao ler arquivo."); }
                      finally { setIsImporting(false); e.target.value = ''; }
                  }}/>
              </div>
          </div>
          
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
              <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Tipo</label>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)} className={`w-full p-2 rounded-lg border text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300'}`}>
                      <option value="ALL">Todos</option>
                      <option value="INCOME">Receitas</option>
                      <option value="EXPENSE">Despesas</option>
                      <option value="TRANSFER">Transferências</option>
                  </select>
              </div>
              <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Mês</label>
                  <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className={`w-full p-2 rounded-lg border text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300'}`}/>
              </div>
          </div>

          <div className={`rounded-xl border overflow-hidden ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-50 text-gray-600'}`}>
                          <tr>
                              <th className="p-4 w-10 text-center">
                                  <input type="checkbox" onChange={e => setSelectedIds(e.target.checked ? filtered.map(t => t.id) : [])} checked={selectedIds.length === filtered.length && filtered.length > 0} />
                              </th>
                              <th className="p-4 w-10">Audit</th>
                              <th className="p-4">Data</th>
                              <th className="p-4">Descrição</th>
                              <th className="p-4">Conta</th>
                              <th className="p-4 text-right">Valor</th>
                              <th className="p-4 text-center">Ações</th>
                          </tr>
                      </thead>
                      <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-100'}`}>
                          {paginatedTransactions.map(t => (
                              <tr key={t.id} className={`${darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-gray-50'} ${t.reconciled ? 'opacity-60' : ''} ${selectedIds.includes(t.id) ? 'bg-indigo-500/10' : ''}`}>
                                  <td className="p-4 text-center">
                                      <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => setSelectedIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} />
                                  </td>
                                  <td className="p-4 text-center">
                                      <button 
                                        onClick={() => handleToggleReconciliation(t.id, !!t.reconciled)}
                                        className={`transition-all ${t.reconciled ? 'text-emerald-500' : 'text-gray-300 hover:text-amber-500'}`}
                                        title={t.reconciled ? "Conciliado (Conferido com extrato)" : "Clique para conciliar"}
                                      >
                                          {t.reconciled ? <ShieldCheckIcon size={18}/> : <ShieldAlert size={18}/>}
                                      </button>
                                  </td>
                                  <td className="p-4 whitespace-nowrap">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                                  <td className="p-4">
                                      <div className="flex items-center gap-2">
                                          {getTypeIcon(t.type)}
                                          <span className="font-medium truncate max-w-[200px]">{t.description}</span>
                                          {t.attachments && t.attachments.length > 0 && <Paperclip size={12} className="text-blue-500"/>}
                                      </div>
                                  </td>
                                  <td className="p-4">{getAccountName(t.accountId)}</td>
                                  <td className={`p-4 text-right font-black ${t.type === 'INCOME' ? 'text-emerald-500' : 'text-red-500'}`}>
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                                  </td>
                                  <td className="p-4 text-center">
                                      <div className="flex justify-center gap-2">
                                          {!t.isPaid && onPay && (
                                              <button onClick={() => { setSelectedTransaction(t); setSettleModalOpen(true); }} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded">
                                                  <CheckCircle2 size={16}/>
                                              </button>
                                          )}
                                          <button onClick={() => onDelete(t.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                                              <Trash2 size={16}/>
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
  );
};

export default FinanceTransactionsList;