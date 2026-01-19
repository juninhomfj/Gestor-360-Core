import React, { useMemo, useState, useEffect } from 'react';
import { FinanceAccount, Transaction, CreditCard as CardType, Receivable, DashboardWidgetConfig, FinancialPacing, TransactionCategory, Sale, FinanceGoal } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, ReferenceLine, ReferenceArea } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Plus, EyeOff, Eye, Settings, X, PiggyBank, ArrowLeftRight, List, Bell, Calculator, AlertCircle, PlayCircle, BarChart3 } from 'lucide-react';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import { getSystemConfig, calculateFinancialPacing, getFinanceData, formatCurrency, markAsReconciled, calculatePredictiveCashFlow, buildBilledSalesMap } from '../services/logic';
import { getSession } from '../services/auth'; 

interface FinanceDashboardProps {
  accounts: FinanceAccount[];
  transactions: Transaction[];
  cards: CardType[];
  receivables?: Receivable[];
  sales?: Sale[];
  goals?: FinanceGoal[];
  darkMode?: boolean;
  hideValues: boolean;
  config: DashboardWidgetConfig;
  onToggleHide: () => void;
  onUpdateConfig: (cfg: DashboardWidgetConfig) => void;
  onNavigate: (tab: string) => void;
}

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ 
    accounts, transactions, cards, receivables = [], sales = [], goals = [],
    darkMode, hideValues, config, onToggleHide, onUpdateConfig, onNavigate
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [includeNonAccounting, setIncludeNonAccounting] = useState(false);
  
  useEffect(() => {
      getSystemConfig().then(cfg => {
          setIncludeNonAccounting(cfg.includeNonAccountingInTotal);
      });
  }, []);

  const totalBalance = accounts.reduce((acc, a) => {
      if (!includeNonAccounting && a.isAccounting === false) return acc;
      return acc + a.balance;
  }, 0);

  // --- MOTOR PREDITIVO (Etapa 4) ---
  const timelineData = useMemo(() => {
    return calculatePredictiveCashFlow(totalBalance, receivables, transactions);
  }, [totalBalance, receivables, transactions]);

  const stats = useMemo(() => {
      const pendingIncome = receivables.filter(r => r.status === 'PENDING').reduce((acc, r) => acc + (r.value - (r.deductions?.reduce((a,b) => a+b.amount,0)||0)), 0);
      const futureExpenses = transactions.filter(t => !t.isPaid && t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
      const reconciledCount = transactions.filter(t => t.reconciled).length;
      const totalPaid = transactions.filter(t => t.isPaid).length;
      const reconciliationRate = totalPaid > 0 ? (reconciledCount / totalPaid) * 100 : 0;
      return { pendingIncome, futureExpenses, reconciliationRate };
  }, [receivables, transactions]);

  const audit = useMemo(() => {
      const activeAccounts = new Set(accounts.map(a => a.id));
      const activeCards = new Set(cards.map(c => c.id));
      const transactionsMissingAccount = transactions.filter(t => t.accountId && !activeAccounts.has(t.accountId));
      const transactionsMissingCard = transactions.filter(t => t.cardId && !activeCards.has(t.cardId));
      const transactionsMissingCategory = transactions.filter(t => !t.categoryId);
      const billedSalesById = buildBilledSalesMap(sales);
      const billedSales = Array.from(billedSalesById.values());
      const salesCommissionTotal = billedSales.reduce((acc, sale) => acc + (sale.commissionValueTotal || 0), 0);
      const receivablesFromSales = receivables.filter(r => r.saleId && billedSalesById.has(r.saleId));
      const receivableCommissionTotal = receivablesFromSales.reduce((acc, r) => acc + (r.value || 0), 0);
      const commissionGap = salesCommissionTotal - receivableCommissionTotal;
      const activeGoals = goals.filter(goal => goal.status === 'ACTIVE').length;
      return {
          accountsCount: accounts.length,
          cardsCount: cards.length,
          transactionsCount: transactions.length,
          receivablesCount: receivables.length,
          missingAccounts: transactionsMissingAccount.length,
          missingCards: transactionsMissingCard.length,
          missingCategories: transactionsMissingCategory.length,
          billedSalesCount: billedSales.length,
          salesCommissionTotal,
          receivableCommissionTotal,
          commissionGap,
          goalsCount: goals.length,
          activeGoals,
          transactionsMissingAccount,
          transactionsMissingCard,
          transactionsMissingCategory
      };
  }, [accounts, cards, transactions, receivables, sales, goals]);

  const handleDownloadAudit = () => {
      const rows: string[][] = [
          ['Seção', 'Métrica', 'Valor'],
          ['Resumo', 'Contas Ativas', String(audit.accountsCount)],
          ['Resumo', 'Cartões Ativos', String(audit.cardsCount)],
          ['Resumo', 'Transações', String(audit.transactionsCount)],
          ['Resumo', 'Recebíveis', String(audit.receivablesCount)],
          ['Resumo', 'Transações sem Conta', String(audit.missingAccounts)],
          ['Resumo', 'Transações sem Cartão', String(audit.missingCards)],
          ['Resumo', 'Transações sem Categoria', String(audit.missingCategories)],
          ['Resumo', 'Vendas Faturadas', String(audit.billedSalesCount)],
          ['Resumo', 'Comissão Vendas', formatCurrency(audit.salesCommissionTotal)],
          ['Resumo', 'Comissão Recebíveis', formatCurrency(audit.receivableCommissionTotal)],
          ['Resumo', 'Diferença', formatCurrency(audit.commissionGap)],
          ['Resumo', 'Metas Ativas', `${audit.activeGoals} de ${audit.goalsCount}`]
      ];

      const addIssueRows = (label: string, items: Transaction[]) => {
          items.forEach(item => {
              rows.push([
                  'Inconsistência',
                  label,
                  `${item.description || 'Sem descrição'} (${item.id})`
              ]);
          });
      };

      addIssueRows('Transação sem Conta', audit.transactionsMissingAccount);
      addIssueRows('Transação sem Cartão', audit.transactionsMissingCard);
      addIssueRows('Transação sem Categoria', audit.transactionsMissingCategory);

      const csvContent = '\uFEFF' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `auditoria_financeira_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const cardStyle = darkMode ? 'glass-panel border-slate-700' : 'bg-white border-gray-100 shadow-sm';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      <div className="flex justify-between items-center">
        <div>
            <h1 className={`text-3xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'} mb-1`}>
                Painel Financeiro <span className="text-indigo-500 font-normal">360</span>
            </h1>
            <p className={darkMode ? 'text-slate-400' : 'text-gray-500'}>Inteligência Diária e Fluxo Preditivo.</p>
        </div>
        <div className="flex gap-3">
            <button onClick={onToggleHide} className={`p-2.5 rounded-xl transition-all ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {hideValues ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <button onClick={() => setShowConfig(true)} className={`p-2.5 rounded-xl transition-all ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-white border border-gray-200 text-gray-600'}`}>
                <Settings size={20} />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatMini icon={<Wallet/>} label="Saldo Contábil" value={formatCurrency(totalBalance)} color="emerald" hide={hideValues} darkMode={darkMode} />
          <StatMini icon={<TrendingDown/>} label="Despesas em Aberto" value={formatCurrency(stats.futureExpenses)} color="red" hide={hideValues} darkMode={darkMode} />
          <StatMini icon={<PiggyBank/>} label="Comissões Pendentes" value={formatCurrency(stats.pendingIncome)} color="blue" hide={hideValues} darkMode={darkMode} />
          <StatMini icon={<TrendingUp/>} label="Saldo Final (30d)" value={formatCurrency(timelineData[30].balance)} color="indigo" hide={hideValues} darkMode={darkMode} />
      </div>

      <div className={`p-8 rounded-[2.5rem] border ${cardStyle}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                  <h3 className="text-lg font-black flex items-center gap-2">
                      <ShieldCheckIcon className="text-emerald-500" size={20} /> Auditoria Financeira
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                      Validação de tabelas, conexões e comissões vindas do módulo de vendas
                  </p>
              </div>
              <div className="flex flex-wrap gap-3">
                  <button
                      onClick={handleDownloadAudit}
                      className="px-5 py-2 rounded-xl bg-white text-indigo-600 text-xs font-black uppercase tracking-widest border border-indigo-200 hover:border-indigo-400 transition-all"
                  >
                      Baixar Auditoria
                  </button>
                  <button
                      onClick={() => onNavigate('fin_receivables')}
                      className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                  >
                      Revisar A Receber
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <AuditItem label="Contas Ativas" value={`${audit.accountsCount}`} status="ok" />
              <AuditItem label="Cartões Ativos" value={`${audit.cardsCount}`} status="ok" />
              <AuditItem label="Transações" value={`${audit.transactionsCount}`} status={audit.transactionsCount ? 'ok' : 'warn'} />
              <AuditItem label="Recebíveis" value={`${audit.receivablesCount}`} status={audit.receivablesCount ? 'ok' : 'warn'} />
              <AuditItem label="Transações sem Conta" value={`${audit.missingAccounts}`} status={audit.missingAccounts === 0 ? 'ok' : 'error'} />
              <AuditItem label="Transações sem Cartão" value={`${audit.missingCards}`} status={audit.missingCards === 0 ? 'ok' : 'error'} />
              <AuditItem label="Transações sem Categoria" value={`${audit.missingCategories}`} status={audit.missingCategories === 0 ? 'ok' : 'warn'} />
              <AuditItem label="Vendas Faturadas" value={`${audit.billedSalesCount}`} status={audit.billedSalesCount ? 'ok' : 'warn'} />
              <AuditItem label="Metas Financeiras" value={`${audit.activeGoals} ativas de ${audit.goalsCount}`} status={audit.goalsCount ? 'ok' : 'warn'} />
              <AuditItem
                  label="Comissões (Vendas x Recebíveis)"
                  value={hideValues ? '•••••• / ••••••' : `${formatCurrency(audit.salesCommissionTotal)} / ${formatCurrency(audit.receivableCommissionTotal)}`}
                  status={Math.abs(audit.commissionGap) <= 0.01 ? 'ok' : 'warn'}
              />
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-500">
              Diferença apurada: <span className="font-bold text-slate-700 dark:text-slate-200">
                  {hideValues ? '••••••' : formatCurrency(audit.commissionGap)}
              </span>
              <span className="ml-2">Idealmente próximo de zero após a importação do período.</span>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* GRÁFICO PREDITIVO (Etapa 4) */}
          <div className={`col-span-2 p-8 rounded-[2.5rem] border relative overflow-hidden ${cardStyle}`}>
              <div className="flex justify-between items-start mb-10">
                  <div>
                      <h3 className="text-xl font-black flex items-center gap-2">
                        <TrendingUp className="text-indigo-500" size={24}/> Fluxo de Caixa Preditivo
                      </h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Evolução do saldo diário baseada em compromissos</p>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${timelineData[30].balance >= totalBalance ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {timelineData[30].balance >= totalBalance ? 'Capital em Crescimento' : 'Retração de Caixa'}
                  </div>
              </div>

              <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData}>
                          <defs>
                              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                          <XAxis dataKey="displayDate" axisLine={false} tickLine={false} fontSize={10} interval={5} />
                          <YAxis hide={hideValues} axisLine={false} tickLine={false} fontSize={10} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '15px', border: 'none', backgroundColor: '#0f172a', color: '#fff' }}
                            formatter={(val: number) => [formatCurrency(val), 'Saldo Projetado']}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="balance" 
                            stroke="#6366f1" 
                            strokeWidth={4} 
                            fillOpacity={1} 
                            fill="url(#colorBalance)" 
                            animationDuration={1500}
                          />
                          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                          {/* Destaque para áreas críticas se houver saldo negativo */}
                          {timelineData.some(d => d.balance < 0) && (
                              <ReferenceArea y1={-1000000} y2={0} fill="#ef4444" fillOpacity={0.05} />
                          )}
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="space-y-6">
              <div className={`p-6 rounded-[2rem] border ${cardStyle}`}>
                  <h4 className="font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2 text-gray-400">
                    <ShieldCheckIcon size={18} className="text-emerald-500"/> Governança de Saldo
                  </h4>
                  <div className="space-y-6">
                      <div>
                          <div className="flex justify-between text-xs font-bold mb-2">
                              <span className="text-gray-500">Conciliação de Extrato</span>
                              <span className="text-indigo-500">{stats.reconciliationRate.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner dark:text-slate-100">
                              <div className="h-full bg-indigo-600 transition-all duration-1000" style={{width: `${stats.reconciliationRate}%`}}></div>
                          </div>
                      </div>
                      
                      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                          <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Atenção Próximos 30 dias</p>
                          <p className="text-sm font-bold text-amber-700">
                             {timelineData.filter(d => d.isCritical).length > 0 
                                ? `Possível insuficiência de caixa em ${timelineData.find(d => d.isCritical)?.displayDate}.`
                                : "Saldo projetado permanece positivo em todo o ciclo."}
                          </p>
                      </div>
                  </div>
              </div>
              
              <button 
                onClick={() => onNavigate('fin_transactions')}
                className="w-full py-5 bg-slate-900 text-white font-black rounded-[2rem] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-[10px] tracking-[0.2em]"
              >
                  <ArrowLeftRight size={20}/> Abrir Extrato Completo
              </button>
          </div>
      </div>
    </div>
  );
};

const StatMini = ({ icon: Icon, label, value, color, hide, darkMode }: any) => (
    <div className={`p-5 rounded-3xl border flex items-center gap-4 transition-all hover:translate-y-[-4px] ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-100 shadow-sm'}`}>
        <div className={`p-3 rounded-2xl bg-${color}-500/10 text-${color}-500`}>
            {Icon}
        </div>
        <div>
            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{label}</p>
            <p className={`text-lg font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>{hide ? '••••••' : value}</p>
        </div>
    </div>
);

const AuditItem = ({ label, value, status }: { label: string; value: string; status: 'ok' | 'warn' | 'error' }) => {
    const statusStyles = {
        ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        warn: 'border-amber-200 bg-amber-50 text-amber-700',
        error: 'border-red-200 bg-red-50 text-red-700'
    } as const;
    return (
        <div className={`rounded-2xl border p-4 ${statusStyles[status]}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{label}</p>
            <p className="text-sm font-black">{value}</p>
        </div>
    );
};

export default FinanceDashboard;