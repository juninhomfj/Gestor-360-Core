
import React, { useState, useMemo, useRef } from 'react';
// Fix: Removed SaleFormData as it is not exported from ../types
import { Sale, ProductType, SalesTaskType } from '../types';
import { 
    Edit2, Plus, Download, Trash2, CalendarCheck, X, ChevronLeft, 
    ChevronRight, ArrowUpDown, AlertTriangle, Search, Clock, CheckCircle, 
    Calculator, Eye, EyeOff, Settings, Filter, ShieldAlert, Lock, Loader2, Upload, Database, RefreshCw, FileSpreadsheet, ClipboardList
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatCurrency, readExcelFile, downloadSalesTemplate } from '../services/logic';
import { Logger } from '../services/logger';
import ImportModal from './ImportModal';
import { SALES_TASK_LABELS, SALES_TASK_OPTIONS } from '../utils/salesTasks';

interface SalesListProps {
  sales: Sale[];
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => void;
  onNew: () => void;
  onExportTemplate?: () => void;
  onClearAll: () => void;
  onRestore: () => void;
  onOpenBulkAdvanced: () => void;
  onBillBulk: (ids: string[], date: string, options?: { createReceivables?: boolean }) => void;
  onDeleteBulk: (ids: string[], options?: { deleteReceivables?: boolean }) => void;
  onBulkAdd: (data: any[]) => void;
  onCreateTask: (sale: Sale, type: SalesTaskType, dueDate: string) => Promise<void>;
  onRecalculate?: (includeBilled: boolean, filterType: ProductType | 'ALL', dateFrom: string, dateTo?: string) => void;
  onNotify?: (type: 'SUCCESS' | 'ERROR' | 'INFO', msg: string) => void;
  darkMode?: boolean;
  isLocked?: boolean;
}

const SalesList: React.FC<SalesListProps> = ({ 
    sales, onEdit, onDelete, onNew, onClearAll, onRestore, onOpenBulkAdvanced, 
    onBillBulk, onDeleteBulk, onBulkAdd, onCreateTask, onRecalculate, onNotify, darkMode, isLocked
}) => {
  const [filterType, setFilterType] = useState<ProductType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'BILLED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Sale | 'status', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [billingModal, setBillingModal] = useState<{ isOpen: boolean, ids: string[] }>({ isOpen: false, ids: [] });
  const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
  const [createReceivables, setCreateReceivables] = useState(false);
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean, ids: string[] }>({ isOpen: false, ids: [] });
  const [deleteReceivables, setDeleteReceivables] = useState(true);
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [taskModal, setTaskModal] = useState<{ isOpen: boolean; sale: Sale | null }>({ isOpen: false, sale: null });
  const [taskType, setTaskType] = useState<SalesTaskType>('ENVIAR_BOLETO');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split('T')[0]);

  const processedSales = useMemo(() => {
    let result = sales.filter(sale => {
      if (searchTerm && !(sale.client.toLowerCase().includes(searchTerm.toLowerCase()) || (sale.trackingCode || '').toLowerCase().includes(searchTerm.toLowerCase()))) return false;
      if (filterType !== 'ALL' && sale.type !== filterType) return false;
      if (filterStatus === 'PENDING' && !!sale.date) return false;
      if (filterStatus === 'BILLED' && !sale.date) return false;
      const compDate = sale.date || sale.completionDate || '';
      if (dateFrom && compDate < dateFrom) return false;
      if (dateTo && compDate > dateTo) return false;
      return true;
    });

    result.sort((a, b) => {
        let valA = a[sortConfig.key as keyof Sale] || '';
        let valB = b[sortConfig.key as keyof Sale] || '';
        if (sortConfig.key === 'date') {
            valA = new Date(a.date || a.completionDate || 0).getTime();
            valB = new Date(b.date || b.completionDate || 0).getTime();
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    return result;
  }, [sales, searchTerm, filterType, filterStatus, dateFrom, dateTo, sortConfig]);

  const salesSummary = useMemo(() => {
    const totals = {
      count: processedSales.length,
      billedCount: 0,
      totalRevenue: 0,
      billedRevenue: 0,
      totalCommission: 0,
      avgMargin: 0,
      avgTicket: 0,
      billingRate: 0
    };
    if (!processedSales.length) return totals;

    let marginSum = 0;
    processedSales.forEach(sale => {
      const saleRevenue = (sale.valueSold || 0) * (sale.quantity || 0);
      totals.totalRevenue += saleRevenue;
      totals.totalCommission += sale.commissionValueTotal || 0;
      marginSum += sale.marginPercent || 0;
      if (sale.date) {
        totals.billedCount += 1;
        totals.billedRevenue += saleRevenue;
      }
    });

    totals.avgMargin = marginSum / processedSales.length;
    totals.avgTicket = totals.totalRevenue / processedSales.length;
    totals.billingRate = (totals.billedCount / processedSales.length) * 100;
    return totals;
  }, [processedSales]);

  const topClients = useMemo(() => {
    const byClient = new Map<string, number>();
    processedSales.forEach(sale => {
      const saleRevenue = (sale.valueSold || 0) * (sale.quantity || 0);
      byClient.set(sale.client, (byClient.get(sale.client) || 0) + saleRevenue);
    });
    return Array.from(byClient.entries())
      .map(([client, total]) => ({ client, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [processedSales]);

  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(processedSales.length / (itemsPerPage as number));
  const paginatedSales = itemsPerPage === 'ALL' ? processedSales : processedSales.slice((currentPage - 1) * (itemsPerPage as number), currentPage * (itemsPerPage as number));

  const handleDownloadModel = () => {
    Logger.info("Auditoria: Usuário clicou em baixar modelo de importação.");
    downloadSalesTemplate();
    if (onNotify) onNotify('SUCCESS', 'Modelo de importação baixado!');
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      Logger.info(`Auditoria: Iniciando leitura de arquivo para importação: ${file.name}`);
      try {
          const rows = await readExcelFile(file);
          if (rows.length > 0) {
              setImportData(rows);
              setIsImportModalOpen(true);
          } else {
              Logger.warn('Auditoria: Arquivo de importação vazio ou inválido.', { fileName: file.name });
              if (onNotify) onNotify('ERROR', 'Arquivo inválido ou vazio.');
          }
      } catch (err: any) {
          Logger.error('Auditoria: Erro ao ler arquivo Excel/CSV.', { fileName: file.name, error: err?.message });
          if (onNotify) onNotify('ERROR', 'Erro ao ler arquivo Excel/CSV.');
      }
      e.target.value = '';
  };

  const handlePermanentDelete = async () => {
      if (!passwordConfirm) return alert("Digite sua senha para confirmar.");
      setIsDeleting(true);
      Logger.warn(`Auditoria: Exclusão permanente em massa de ${deleteConfirmModal.ids.length} itens.`);
      await new Promise(r => setTimeout(r, 1000));
      onDeleteBulk(deleteConfirmModal.ids, { deleteReceivables });
      setIsDeleting(false);
      setDeleteConfirmModal({ isOpen: false, ids: [] });
      setSelectedIds([]);
      setPasswordConfirm('');
      setDeleteReceivables(true);
  };

  const containerClass = darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200 shadow-sm text-gray-900';

  const handleConfirmBilling = async () => {
      if (!billingDate) {
          alert("Selecione uma data de faturamento.");
          return;
      }
      await onBillBulk(billingModal.ids, billingDate, { createReceivables });
      setBillingModal({ isOpen: false, ids: [] });
      setSelectedIds([]);
      setCreateReceivables(false);
  };

  const isReadOnly = Boolean(isLocked);

  const openTaskModal = (sale: Sale) => {
    setTaskModal({ isOpen: true, sale });
    setTaskType('ENVIAR_BOLETO');
    setTaskDueDate(new Date().toISOString().split('T')[0]);
  };

  const handleCreateTask = async () => {
    if (!taskModal.sale) return;
    if (!taskDueDate) {
        alert('Selecione uma data para a pendência.');
        return;
    }
    await onCreateTask(taskModal.sale, taskType, taskDueDate);
    setTaskModal({ isOpen: false, sale: null });
  };

  const parseNumber = (value: any) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    const raw = String(value)
      .replace('%', '')
      .replace('R$', '')
      .replace(/\s/g, '')
      .trim();
    let normalized = raw;
    if (raw.includes(',') && raw.includes('.')) {
      normalized = raw.replace(/\./g, '').replace(',', '.');
    } else if (raw.includes(',')) {
      normalized = raw.replace(',', '.');
    }
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const parseDateValue = (value: any) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().split('T')[0];
    }
    if (typeof value === 'number') {
      const parsed = XLSX.SSF ? XLSX.SSF.parse_date_code(value) : null;
      if (parsed) {
        const formatted = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
        return formatted;
      }
    }
    const text = String(value).trim();
    if (!text) return null;
    const ddmmyyyy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, dd, mm, yyyy] = ddmmyyyy;
      return `${yyyy}-${mm}-${dd}`;
    }
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
  };
  
  const normalizePaymentMethod = (value: any) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (normalized === 'a vista' || normalized === 'avista' || normalized.includes('a vista')) {
      return 'À vista / Antecipado';
    }
    return raw;
  };

  return (
    <div className="space-y-6 relative pb-20">

      {isReadOnly && (
          <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 flex items-center gap-3">
              <Lock size={18} />
              <div>
                  <p className="text-xs font-black uppercase tracking-widest">Módulo de Vendas Bloqueado</p>
                  <p className="text-xs">Operações de inclusão, edição, faturamento ou exclusão estão desativadas.</p>
              </div>
          </div>
      )}
      
      {selectedIds.length > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-[720px] bg-slate-900 dark:bg-indigo-600 text-white px-6 py-4 rounded-3xl shadow-2xl flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 animate-in slide-in-from-bottom-10 border border-white/10">
              <span className="font-black text-xs uppercase tracking-widest text-center sm:text-left">{selectedIds.length} Selecionados</span>
              <div className="hidden h-8 w-px bg-white/20 sm:block"></div>
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  <button disabled={isReadOnly} onClick={() => setBillingModal({ isOpen: true, ids: selectedIds })} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 rounded-xl text-xs font-black uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      <CalendarCheck size={16}/> Faturar
                  </button>
                  <button disabled={isReadOnly} onClick={() => setDeleteConfirmModal({ isOpen: true, ids: selectedIds })} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-xl text-xs font-black uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      <Trash2 size={16}/> Excluir
                  </button>
                  <button onClick={() => setSelectedIds([])} className="p-2 hover:bg-white/10 rounded-full"><X size={18}/></button>
              </div>
          </div>
      )}

      {billingModal.isOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xl w-full max-w-md dark:text-slate-100">
                  <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                          <h3 className="text-lg font-black">Faturar Vendas</h3>
                          <p className="text-xs text-gray-500">Defina a data de faturamento para {billingModal.ids.length} item(ns).</p>
                      </div>
                      <button
                          onClick={() => {
                              setBillingModal({ isOpen: false, ids: [] });
                              setCreateReceivables(false);
                          }}
                          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
                      >
                          <X size={18} />
                      </button>
                  </div>
                  <div className="p-6 space-y-4">
                      <label className="block text-xs font-black text-gray-400 uppercase">Data de Faturamento</label>
                      <input
                          type="date"
                          className={`w-full p-3 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`}
                          value={billingDate}
                          onChange={e => setBillingDate(e.target.value)}
                      />
                      <label className="flex items-start gap-3 text-xs text-gray-500">
                          <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 accent-emerald-600"
                              checked={createReceivables}
                              onChange={(e) => setCreateReceivables(e.target.checked)}
                          />
                          <span>
                              Criar recebíveis automaticamente para essas vendas faturadas.
                              <span className="block text-[11px] text-gray-400">Use somente quando quiser enviar para o financeiro.</span>
                          </span>
                      </label>
                  </div>
                  <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex gap-3 justify-end">
                      <button onClick={() => setBillingModal({ isOpen: false, ids: [] })} className="px-5 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800">
                          Cancelar
                      </button>
                      <button onClick={handleConfirmBilling} className="px-6 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700">
                          Confirmar Faturamento
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-black">Gestão de Vendas</h1>
            <p className="text-sm text-gray-500">Controle operacional e financeiro.</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
              <button onClick={handleDownloadModel} className="flex-1 p-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-indigo-500 hover:shadow-lg transition-all sm:flex-none dark:text-slate-100" title="Baixar Modelo (XLSX)">
                  <FileSpreadsheet size={20}/>
              </button>
              <button onClick={onRestore} className="flex-1 p-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-blue-500 hover:shadow-lg transition-all sm:flex-none dark:text-slate-100" title="Backup e Restauração">
                  <Database size={20}/>
              </button>
              <button disabled={isReadOnly} onClick={handleImportClick} className="flex-1 p-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-emerald-500 hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed sm:flex-none dark:text-slate-100" title="Importar XLSX/CSV">
                  <Upload size={20}/>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileChange}/>
              <button onClick={onClearAll} className="flex-1 p-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-amber-500 hover:shadow-lg transition-all sm:flex-none dark:text-slate-100" title="Limpar Cache Local">
                  <RefreshCw size={20}/>
              </button>
              <button disabled={isReadOnly} onClick={onNew} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed sm:w-auto">
                  <Plus size={18}/> Nova Venda
              </button>
          </div>
      </div>

      <div className={`p-6 rounded-3xl border ${containerClass} grid grid-cols-1 md:grid-cols-12 gap-4 items-end`}>
          <div className="md:col-span-3">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Pesquisar</label>
              <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                  <input className={`w-full pl-10 pr-4 py-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`} placeholder="Cliente ou Rastreio..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
          </div>
          <div className="md:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Tipo</label>
                  <select className={`w-full p-2 rounded-xl border text-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50'}`} value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                      <option value="ALL">Todas</option>
                      <option value={ProductType.BASICA}>Cesta Básica</option>
                      <option value={ProductType.NATAL}>Cesta de Natal</option>
                  </select>
              </div>
              <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Status</label>
                  <select className={`w-full p-2 rounded-xl border text-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50'}`} value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                      <option value="ALL">Todos</option>
                      <option value="PENDING">Pendente</option>
                      <option value="BILLED">Faturado</option>
                  </select>
              </div>
          </div>
          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Início</label>
                  <input type="date" className={`w-full p-2 rounded-xl border text-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50'}`} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Fim</label>
                  <input type="date" className={`w-full p-2 rounded-xl border text-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50'}`} value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
          </div>
          <div className="md:col-span-2 flex flex-col gap-2 sm:flex-row">
              <button disabled={isReadOnly} onClick={onOpenBulkAdvanced} className="flex-1 p-2.5 bg-blue-500 text-white rounded-xl shadow-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase disabled:opacity-40 disabled:cursor-not-allowed">
                  <CalendarCheck size={16}/> Lote
              </button>
              <button disabled={isReadOnly} onClick={() => onRecalculate?.(true, filterType, dateFrom)} className="flex-1 p-2.5 bg-orange-500 text-white rounded-xl shadow-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase disabled:opacity-40 disabled:cursor-not-allowed">
                  <Calculator size={16}/> Recalc
              </button>
          </div>
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4`}>
          <div className={`lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`}>
              <div className={`p-4 rounded-2xl border ${containerClass}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Receita Total</p>
                  <p className="text-lg font-black">{formatCurrency(salesSummary.totalRevenue)}</p>
                  <p className="text-[11px] text-gray-500">{salesSummary.count} vendas no período</p>
              </div>
              <div className={`p-4 rounded-2xl border ${containerClass}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Faturado x Pendente</p>
                  <p className="text-lg font-black">{formatCurrency(salesSummary.billedRevenue)}</p>
                  <p className="text-[11px] text-gray-500">Pendente: {formatCurrency(salesSummary.totalRevenue - salesSummary.billedRevenue)}</p>
              </div>
              <div className={`p-4 rounded-2xl border ${containerClass}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Ticket Médio</p>
                  <p className="text-lg font-black">{formatCurrency(salesSummary.avgTicket)}</p>
                  <p className="text-[11px] text-gray-500">Margem média: {salesSummary.avgMargin.toFixed(1)}%</p>
              </div>
              <div className={`p-4 rounded-2xl border ${containerClass}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Eficiência de Faturamento</p>
                  <p className="text-lg font-black">{salesSummary.billingRate.toFixed(1)}%</p>
                  <p className="text-[11px] text-gray-500">{salesSummary.billedCount} vendas faturadas</p>
              </div>
          </div>
          <div className={`lg:col-span-3 p-4 rounded-2xl border ${containerClass}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Top Clientes (Receita)</p>
              <div className="space-y-3">
                  {topClients.map((client, idx) => (
                      <div key={client.client} className="flex items-center justify-between text-sm">
                          <span className="font-bold text-gray-700 dark:text-slate-200">{idx + 1}. {client.client}</span>
                          <span className="text-xs font-black text-emerald-600">{formatCurrency(client.total)}</span>
                      </div>
                  ))}
                  {topClients.length === 0 && (
                      <p className="text-xs text-gray-500">Sem dados suficientes no período.</p>
                  )}
              </div>
          </div>
      </div>

      <div className={`rounded-3xl border overflow-hidden ${containerClass}`}>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className={`text-[10px] font-black uppercase tracking-widest border-b ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-50 text-gray-500'}`}>
                      <tr>
                          <th className="p-5 w-12"><input disabled={isReadOnly} type="checkbox" onChange={e => setSelectedIds(e.target.checked ? processedSales.map(s => s.id) : [])} checked={selectedIds.length === processedSales.length && processedSales.length > 0} /></th>
                          <th className="p-5">Data</th>
                          <th className="p-5">Cliente</th>
                          <th className="p-5">Tipo</th>
                          <th className="p-5 text-right">Margem</th>
                          <th className="p-5 text-right">Comissão</th>
                          <th className="p-5 text-center">Ações</th>
                      </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-100'}`}>
                      {paginatedSales.map(sale => (
                          <tr key={sale.id} className={`hover:bg-indigo-500/5 transition-colors ${selectedIds.includes(sale.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                              <td className="p-5"><input disabled={isReadOnly} type="checkbox" checked={selectedIds.includes(sale.id)} onChange={() => setSelectedIds(p => p.includes(sale.id) ? p.filter(x => x !== sale.id) : [...p, sale.id])} /></td>
                              <td className="p-5">
                                  <div className="flex flex-col">
                                      <span className="font-black">{new Date(sale.date || sale.completionDate).toLocaleDateString('pt-BR')}</span>
                                      <span className={`text-[9px] font-black uppercase ${sale.date ? 'text-emerald-500' : 'text-amber-500'}`}>{sale.date ? 'Faturado' : 'Pendente'}</span>
                                  </div>
                              </td>
                              <td className="p-5 font-bold">{sale.client}</td>
                              <td className="p-5"><span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${sale.type === ProductType.NATAL ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{sale.type === ProductType.NATAL ? 'Natal' : 'Básica'}</span></td>
                              <td className="p-5 text-right font-mono text-xs">{sale.marginPercent.toFixed(2)}%</td>
                              <td className="p-5 text-right">
                                  <div className="flex flex-col items-end gap-1">
                                      <span className={`font-black ${sale.campaignTag ? (sale.campaignColor === 'amber' ? 'text-amber-500' : 'text-emerald-400') : 'text-emerald-600'}`}>
                                          R$ {sale.commissionValueTotal.toFixed(2)}
                                      </span>
                                      {sale.campaignTag && (
                                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${sale.campaignColor === 'amber' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                              COMISSÃO PREMIAÇÃO
                                          </span>
                                      )}
                                      {sale.campaignMessage && (
                                          <span className={`text-[10px] font-bold ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                              {sale.campaignMessage}
                                          </span>
                                      )}
                                  </div>
                              </td>
                              <td className="p-5 text-center">
                                  <div className="flex justify-center gap-2">
                                      <button disabled={isReadOnly} onClick={() => onEdit(sale)} className="p-2 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"><Edit2 size={16}/></button>
                                      <button disabled={isReadOnly} onClick={() => openTaskModal(sale)} title="Criar Pendência" className="p-2 text-amber-500 hover:bg-amber-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"><ClipboardList size={16}/></button>
                                      <button disabled={isReadOnly} onClick={() => setDeleteConfirmModal({ isOpen: true, ids: [sale.id] })} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 size={16}/></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
          
          <div className={`p-4 border-t flex flex-col md:flex-row justify-between items-center gap-4 ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-4">
                  <select value={itemsPerPage} onChange={e => { setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)); setCurrentPage(1); }} className={`p-2 rounded-lg border text-xs font-bold ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white'}`}>
                      <option value={25}>25 por página</option>
                      <option value={50}>50 por página</option>
                      <option value="ALL">Ver Todos</option>
                  </select>
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total: {processedSales.length} registros</span>
              </div>

              {itemsPerPage !== 'ALL' && totalPages > 1 && (
                  <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border disabled:opacity-30"><ChevronLeft size={16}/></button>
                      <span className="text-xs font-bold px-4">Página {currentPage} de {totalPages}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border disabled:opacity-30"><ChevronRight size={16}/></button>
                  </div>
              )}
          </div>
      </div>

      {isImportModalOpen && (
          <ImportModal 
            isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} fileData={importData} darkMode={darkMode} 
            onConfirm={(mapping) => {
                const processed = importData.slice(1).map(row => {
                    const obj: any = {};
                    Object.keys(mapping).forEach(key => { const idx = mapping[key]; if (idx !== -1) obj[key] = row[idx]; });

                    let pType = ProductType.BASICA;
                    const typeStr = String(obj.type || '').toUpperCase();
                    if (typeStr.includes('NATAL')) pType = ProductType.NATAL;

                    const dateValue = parseDateValue(obj.date);
                    const completionValue = parseDateValue(obj.completionDate);
                    const valueProposed = parseNumber(obj.valueProposed) || parseNumber(obj.budget);
                    const valueSold = parseNumber(obj.valueSold);
                    const margin = parseNumber(obj.margin);

                    return {
                        client: obj.client || 'Lead Importado',
                        quantity: parseNumber(obj.quantity) || 1,
                        type: pType,
                        valueProposed: valueProposed || 0,
                        valueSold: valueSold || 0,
                        marginPercent: margin || 0,
                        date: dateValue,
                        completionDate: completionValue || new Date().toISOString().split('T')[0],
                        isBilled: !!dateValue,
                        observations: obj.obs || "",
                        trackingCode: obj.trackingCode || obj.tracking || "",
                        paymentMethod: normalizePaymentMethod(obj.paymentMethod || obj.payment || "")
                    };
                });
                onBulkAdd(processed);
                setIsImportModalOpen(false);
                Logger.info(`Auditoria: Importação em lote de ${processed.length} itens processada.`);
            }}
          />
      )}

      {deleteConfirmModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
              <div className={`w-full max-w-md rounded-[2.5rem] p-8 border-2 border-red-500/50 ${darkMode ? 'bg-slate-900 text-white' : 'bg-white shadow-2xl'} animate-in zoom-in-95`}>
                  <div className="flex flex-col items-center text-center mb-8">
                      <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 border-4 border-red-500"><Trash2 size={40}/></div>
                      <h3 className="text-2xl font-black">Excluir Permanentemente</h3>
                      <p className="text-sm text-gray-500 mt-2">Você apagará <b>{deleteConfirmModal.ids.length}</b> registros. Esta ação é irreversível.</p>
                  </div>
                  <div className="space-y-4">
                      <div className={`rounded-2xl border p-4 text-xs ${darkMode ? 'border-slate-700 bg-slate-950/40 text-slate-300' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                          Ao excluir a venda, os lembretes de boleto/entrega vinculados deixam de aparecer no módulo de pendências.
                      </div>
                      <label className="flex items-start gap-3 text-xs text-gray-500">
                          <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 accent-red-600"
                              checked={deleteReceivables}
                              onChange={(e) => setDeleteReceivables(e.target.checked)}
                          />
                          <span>
                              Excluir recebíveis vinculados às vendas selecionadas.
                              <span className="block text-[11px] text-gray-400">Não remove cadastro do cliente.</span>
                          </span>
                      </label>
                      <input type="password" placeholder="Senha de Admin" className={`w-full p-4 rounded-2xl border ${darkMode ? 'bg-black border-slate-700' : 'bg-gray-50'}`} value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} />
                      <button onClick={handlePermanentDelete} disabled={isDeleting} className="w-full py-5 bg-red-600 text-white font-black rounded-3xl shadow-xl transition-all">
                          {isDeleting ? <Loader2 className="animate-spin mx-auto"/> : 'CONFIRMAR EXCLUSÃO'}
                      </button>
                      <button
                          onClick={() => {
                              setDeleteConfirmModal({ isOpen: false, ids: [] });
                              setPasswordConfirm('');
                              setDeleteReceivables(true);
                          }}
                          className="w-full text-gray-500 font-bold"
                      >
                          Cancelar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {taskModal.isOpen && taskModal.sale && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className={`w-full max-w-md rounded-[2.5rem] p-8 border ${darkMode ? 'bg-slate-900 text-white border-slate-700' : 'bg-white shadow-2xl border-gray-200'} animate-in zoom-in-95`}>
                  <div className="flex items-center justify-between mb-6">
                      <div>
                          <h3 className="text-2xl font-black">Criar Pendência</h3>
                          <p className="text-xs text-gray-500 mt-1">Venda: <span className="font-bold text-indigo-500">{taskModal.sale.client}</span></p>
                      </div>
                      <button
                          onClick={() => setTaskModal({ isOpen: false, sale: null })}
                          className={`p-2 rounded-full ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                          aria-label="Fechar"
                      >
                          <X size={18} />
                      </button>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tipo de Pendência</label>
                          <select
                              className={`w-full p-4 rounded-2xl border text-sm ${darkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                              value={taskType}
                              onChange={(e) => setTaskType(e.target.value as SalesTaskType)}
                          >
                              {SALES_TASK_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                          </select>
                      </div>

                      <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Data de Prazo</label>
                          <input
                              type="date"
                              className={`w-full p-4 rounded-2xl border text-sm ${darkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                              value={taskDueDate}
                              onChange={(e) => setTaskDueDate(e.target.value)}
                          />
                      </div>

                      <div className="flex flex-col gap-3 pt-2">
                          <button
                              onClick={handleCreateTask}
                              disabled={isReadOnly}
                              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              Criar Pendência
                          </button>
                          <button
                              onClick={() => setTaskModal({ isOpen: false, sale: null })}
                              className={`w-full text-sm font-bold ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                              Cancelar
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SalesList;
