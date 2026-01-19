import React, { useMemo } from 'react';
import { ArrowRight, Wallet, ShoppingCart, ShieldCheck } from 'lucide-react';
import { AppMode, FinanceAccount, Receivable, Sale, SalesTask, Transaction, User } from '../types';
import { formatCurrency } from '../services/logic';

interface HomeDashboardProps {
  sales: Sale[];
  salesTasks: SalesTask[];
  transactions: Transaction[];
  receivables: Receivable[];
  accounts: FinanceAccount[];
  hideValues: boolean;
  onToggleHide: () => void;
  onNavigate: (tab: string, mode?: AppMode) => void;
  currentUser: User;
  onSetDefaultModule: (route: string) => void;
  darkMode?: boolean;
  onNotify?: (type: 'SUCCESS' | 'ERROR' | 'INFO', msg: string) => void;
}

const EyeToggleIcon: React.FC<{ hidden: boolean }> = ({ hidden }) => {
  const irisStyle: React.CSSProperties = {
    transformOrigin: '12px 12px',
    transform: hidden ? 'scale(0.2)' : 'scale(1)',
    transition: 'transform 200ms ease'
  };
  const lidStyle: React.CSSProperties = {
    opacity: hidden ? 1 : 0,
    transition: 'opacity 200ms ease'
  };
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12c2.8-4.2 6.5-6.3 10-6.3S19.2 7.8 22 12c-2.8 4.2-6.5 6.3-10 6.3S4.8 16.2 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" style={irisStyle} />
      <path
        d="M4 18L20 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        style={lidStyle}
      />
    </svg>
  );
};

const HomeDashboard: React.FC<HomeDashboardProps> = ({
  sales,
  salesTasks,
  transactions,
  receivables,
  accounts,
  hideValues,
  onToggleHide,
  onNavigate,
  currentUser,
  onSetDefaultModule,
  darkMode
}) => {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);

  const summary = useMemo(() => {
    const activeSales = sales.filter((s) => !s.deleted);
    const salesMonth = activeSales.filter((s) => (s.date || s.completionDate || '').startsWith(monthKey));
    const salesTotal = salesMonth.reduce((acc, s) => acc + (s.valueSold || 0), 0);
    const commissionTotal = salesMonth.reduce((acc, s) => acc + (s.commissionValueTotal || 0), 0);
    const openTasks = salesTasks.filter((t) => t.status === 'OPEN').length;
    const pendingSales = activeSales.filter((s) => !s.date).length;

    const totalBalance = accounts.reduce((acc, a) => acc + (a.balance || 0), 0);
    const pendingIncome = receivables
      .filter((r) => r.status === 'PENDING')
      .reduce((acc, r) => acc + (r.value || 0), 0);
    const pendingExpenses = transactions
      .filter((t) => !t.isPaid && t.type === 'EXPENSE')
      .reduce((acc, t) => acc + (t.amount || 0), 0);

    return {
      salesTotal,
      commissionTotal,
      openTasks,
      pendingSales,
      totalBalance,
      pendingIncome,
      pendingExpenses
    };
  }, [sales, salesTasks, receivables, transactions, accounts, monthKey]);

  const formatMoney = (value: number) => (hideValues ? '••••••' : formatCurrency(value));
  const defaultModule = currentUser.prefs?.defaultModule || 'home';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className={`text-2xl md:text-3xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Central Gestor360
          </h1>
          <p className="text-xs md:text-sm text-gray-500">
            Escolha seu fluxo e acompanhe um resumo rápido de Vendas e Finanças.
          </p>
        </div>
        <button
          onClick={onToggleHide}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
            darkMode ? 'border-slate-700 text-slate-200 hover:bg-slate-800/60' : 'border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <EyeToggleIcon hidden={hideValues} />
          {hideValues ? 'Privado' : 'Exibir Valores'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-6 rounded-3xl border ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-emerald-500">
              <ShoppingCart size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Vendas360</span>
            </div>
            <span className="text-xs text-gray-500">{monthKey.replace('-', '/')}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/30">
              <div className="text-[10px] uppercase tracking-widest text-emerald-500 font-black">Volume</div>
              <div className="text-lg font-black text-emerald-600">{formatMoney(summary.salesTotal)}</div>
            </div>
            <div className="rounded-2xl p-4 bg-indigo-500/10 border border-indigo-500/30">
              <div className="text-[10px] uppercase tracking-widest text-indigo-500 font-black">Comissao</div>
              <div className="text-lg font-black text-indigo-600">{formatMoney(summary.commissionTotal)}</div>
            </div>
            <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30">
              <div className="text-[10px] uppercase tracking-widest text-amber-600 font-black">Pendencias</div>
              <div className="text-lg font-black text-amber-600">{summary.openTasks}</div>
            </div>
            <div className="rounded-2xl p-4 bg-slate-500/10 border border-slate-500/30">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">A faturar</div>
              <div className="text-lg font-black text-slate-600">{summary.pendingSales}</div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('dashboard', 'SALES')}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
            >
              Abrir Vendas360 <ArrowRight size={14} />
            </button>
            <button
              onClick={() => onSetDefaultModule('sales')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                defaultModule === 'sales'
                  ? 'border-emerald-500 text-emerald-500'
                  : darkMode
                    ? 'border-slate-700 text-slate-300'
                    : 'border-gray-200 text-gray-600'
              }`}
            >
              {defaultModule === 'sales' ? 'Padrao atual' : 'Definir como padrao'}
            </button>
          </div>
        </div>

        <div className={`p-6 rounded-3xl border ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-blue-500">
              <Wallet size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Financas360</span>
            </div>
            <span className="text-xs text-gray-500">Resumo</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-4 bg-blue-500/10 border border-blue-500/30">
              <div className="text-[10px] uppercase tracking-widest text-blue-500 font-black">Saldo</div>
              <div className="text-lg font-black text-blue-600">{formatMoney(summary.totalBalance)}</div>
            </div>
            <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/30">
              <div className="text-[10px] uppercase tracking-widest text-emerald-500 font-black">A receber</div>
              <div className="text-lg font-black text-emerald-600">{formatMoney(summary.pendingIncome)}</div>
            </div>
            <div className="rounded-2xl p-4 bg-rose-500/10 border border-rose-500/30">
              <div className="text-[10px] uppercase tracking-widest text-rose-500 font-black">A pagar</div>
              <div className="text-lg font-black text-rose-600">{formatMoney(summary.pendingExpenses)}</div>
            </div>
            <div className="rounded-2xl p-4 bg-slate-500/10 border border-slate-500/30">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Contas</div>
              <div className="text-lg font-black text-slate-600">{accounts.length}</div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('fin_dashboard', 'FINANCE')}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
            >
              Abrir Financas360 <ArrowRight size={14} />
            </button>
            <button
              onClick={() => onSetDefaultModule('fin_dashboard')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                defaultModule === 'fin_dashboard'
                  ? 'border-blue-500 text-blue-500'
                  : darkMode
                    ? 'border-slate-700 text-slate-300'
                    : 'border-gray-200 text-gray-600'
              }`}
            >
              {defaultModule === 'fin_dashboard' ? 'Padrao atual' : 'Definir como padrao'}
            </button>
          </div>
        </div>
      </div>

      <div className={`p-6 rounded-3xl border ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-200'}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-indigo-500" />
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-gray-400">Preferencia de entrada</div>
              <div className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {defaultModule === 'home' ? 'Abrir sempre no Home' : `Abrir em: ${defaultModule}`}
              </div>
            </div>
          </div>
          <button
            onClick={() => onSetDefaultModule('home')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
              defaultModule === 'home'
                ? 'border-indigo-500 text-indigo-500'
                : darkMode
                  ? 'border-slate-700 text-slate-300'
                  : 'border-gray-200 text-gray-600'
            }`}
          >
            {defaultModule === 'home' ? 'Padrao atual' : 'Usar Home como padrao'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomeDashboard;
