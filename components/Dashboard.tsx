
import React, { useState, useEffect, useMemo } from 'react';
import { Sale, ProductType, DashboardWidgetConfig, Transaction, User, SalesTargets, Receivable, SalesTask } from '../types'; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, Gift, ShoppingBasket, Plus, Calendar, Eye, EyeOff, Settings, X, Clock, CheckCircle2, Edit3, ShoppingBag, ArrowRight, AlertTriangle, UserMinus, Users, Sparkles } from 'lucide-react';
import { getFinanceData, getABCAnalysis, analyzeClients, buildBilledSalesMap } from '../services/logic'; 
import { SALES_TASK_LABELS } from '../utils/salesTasks';

interface DashboardProps {
  sales: Sale[];
  salesTasks: SalesTask[];
  onNewSale: () => void;
  darkMode?: boolean;
  hideValues: boolean;
  config: DashboardWidgetConfig;
  onToggleHide: () => void;
  onUpdateConfig: (cfg: DashboardWidgetConfig) => void;
  currentUser?: User;
  salesTargets?: SalesTargets; 
  onUpdateTargets?: (targets: SalesTargets) => void; 
  isAdmin: boolean;
  isDev: boolean;
}

const formatCurrency = (val: number, hidden: boolean) => {
    if (hidden) return '••••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const StatCard: React.FC<{ title: string; value: string; sub: string; icon: React.ReactNode; color: string; darkMode?: boolean }> = ({ title, value, sub, icon, color, darkMode }) => {
  const bgClass = darkMode ? 'bg-slate-800/60 backdrop-blur-sm border-slate-700/50' : 'bg-white border-gray-100'; 
  return (
    <div className={`${bgClass} rounded-xl p-4 sm:p-6 shadow-sm border flex items-start gap-3 transition-all hover:shadow-md hover:scale-[1.01] min-w-0`}>
        <div className={`p-3 rounded-lg ${color} text-white shadow-lg shrink-0`}>{icon}</div>
        <div className="min-w-0">
            <p className={`text-xs sm:text-sm font-medium leading-tight break-words ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{title}</p>
            <h3 className={`text-xl sm:text-2xl font-bold mt-1 leading-tight break-words ${darkMode ? 'text-white' : 'text-gray-900'}`}>{value}</h3>
            <p className={`text-[11px] sm:text-xs mt-1 font-medium leading-tight break-words ${darkMode ? 'text-slate-500' : 'text-gray-500'}`}>{sub}</p>
        </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
  sales, salesTasks, onNewSale, darkMode, hideValues, config, onToggleHide, onUpdateConfig, 
  currentUser, salesTargets, onUpdateTargets,
  isAdmin, isDev 
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]); 
  const [receivables, setReceivables] = useState<Receivable[]>([]); 
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  useEffect(() => {
      getFinanceData().then(data => {
          setTransactions(data.transactions || []);
          setReceivables(data.receivables || []);
      });
  }, []);
  const activeSales = sales.filter(s => !s.deleted);
  const salesById = useMemo(() => new Map(activeSales.map(sale => [sale.id, sale])), [activeSales]);
  const billedSalesById = useMemo(() => buildBilledSalesMap(sales), [sales]);
  const activeReceivables = useMemo(() => {
      return receivables.filter(r => !r.saleId || billedSalesById.has(r.saleId));
  }, [receivables, billedSalesById]);

  const overdueCommissions = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      return activeReceivables.filter(r => {
          if (r.status !== 'PENDING' || !r.date) return false;
          const dueDate = new Date(r.date).toISOString().split('T')[0];
          return dueDate < today;
      });
  }, [activeReceivables]);

  const overdueIdsTooltip = useMemo(() => {
      if (!overdueCommissions.length) return '';
      return `IDs: ${overdueCommissions.map(r => r.id).join(', ')}`;
  }, [overdueCommissions]);

  const pendingTasks = useMemo(() => {
      return salesTasks
        .filter(task => task.status === 'OPEN')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 4);
  }, [salesTasks]);

  // --- RADAR DE CHURN (Etapa 5) ---
  const churnRisks = useMemo(() => {
    const reportCfg = { daysForNewClient: 30, daysForInactive: 45, daysForLost: 90 };
    const analysis = analyzeClients(sales, reportCfg);
    const abc = getABCAnalysis(sales);
    
    return analysis
        .filter(c => (c.status === 'INACTIVE' || c.status === 'LOST'))
        .map(c => ({
            ...c,
            classification: abc.find(a => a.name === c.name)?.classification || 'C'
        }))
        .filter(c => c.classification === 'A' || c.classification === 'B') // Apenas prioridades
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 3);
  }, [sales]);
  const basicSalesMonth = activeSales.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return s.type === ProductType.BASICA && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalCommissionMonth = activeSales.filter(s => {
      if (!s.date) return false;
      const d = new Date(s.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).reduce((acc, curr) => acc + (curr.commissionValueTotal || 0), 0);

  const basicQtyMonth = basicSalesMonth.reduce((acc, curr) => acc + curr.quantity, 0);
  const basicCommissionMonth = basicSalesMonth.reduce((acc, curr) => acc + curr.commissionValueTotal, 0);
  
  const natalYears = activeSales
    .filter(s => s.type === ProductType.NATAL && !!s.date)
    .map(s => new Date(s.date as string).getFullYear());
  const natalYear = natalYears.length ? Math.max(...natalYears) : currentYear;
  const natalSalesYear = activeSales.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return s.type === ProductType.NATAL && d.getFullYear() === natalYear;
  });
  const natalQtyYear = natalSalesYear.reduce((acc, curr) => acc + curr.quantity, 0);
  const natalCommissionYear = natalSalesYear.reduce((acc, curr) => acc + curr.commissionValueTotal, 0);
  
  const showNatalCard = natalSalesYear.length > 0 || (salesTargets?.natal || 0) > 0;

  const advancedIndicators = useMemo(() => {
    if (!activeSales.length) {
      return {
        totalRevenue: 0,
        avgTicket: 0,
        avgMargin: 0,
        billingRate: 0,
        uniqueClients: 0
      };
    }
    const totalRevenue = activeSales.reduce((acc, sale) => acc + (sale.valueSold || 0) * (sale.quantity || 0), 0);
    const avgTicket = totalRevenue / activeSales.length;
    const avgMargin = activeSales.reduce((acc, sale) => acc + (sale.marginPercent || 0), 0) / activeSales.length;
    const billedCount = activeSales.filter(sale => !!sale.date).length;
    const billingRate = (billedCount / activeSales.length) * 100;
    const uniqueClients = new Set(activeSales.map(sale => sale.client)).size;
    return { totalRevenue, avgTicket, avgMargin, billingRate, uniqueClients };
  }, [activeSales]);

  const chartData = React.useMemo(() => {
    const months = new Map<string, { name: string; basica: number; natal: number; total: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      months.set(key, { name: d.toLocaleDateString('pt-BR', { month: 'short' }), basica: 0, natal: 0, total: 0 });
    }
    activeSales.forEach(sale => {
      if (!sale.date) return;
      const d = new Date(sale.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (months.has(key)) {
        const bin = months.get(key)!;
        if (sale.type === ProductType.BASICA) bin.basica += sale.commissionValueTotal;
        else bin.natal += sale.commissionValueTotal;
        bin.total += sale.commissionValueTotal;
      }
    });
    return Array.from(months.values());
  }, [activeSales]);

  const recentSales = [...activeSales].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : new Date(a.completionDate || '2099-01-01').getTime();
      const dateB = b.date ? new Date(b.date).getTime() : new Date(b.completionDate || '2099-01-01').getTime();
      return dateB - dateA;
  }).slice(0, 5);

  const containerClass = darkMode ? 'bg-slate-800/60 border-slate-700/50 backdrop-blur-md' : 'bg-white border-gray-100';

  return (
    <div className="space-y-6 relative h-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-gray-800'}`}>Visão Geral</h1>
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Competência: {capitalizedMonth} / {currentYear}</p>
        </div>
        
        <div className="flex gap-2 items-center">
            <button onClick={onToggleHide} className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {hideValues ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <button onClick={onNewSale} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center shadow-sm active:scale-95 transition-all">
                <Plus size={20} className="mr-2" /> Nova Venda
            </button>
        </div>
      </div>
      
      {/* ALERTA DE OPERAÇÕES CRÍTICAS & RADAR DE CHURN (Etapa 4 + 5) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {overdueCommissions.length > 0 && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-4 animate-in slide-in-from-top-4">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500 text-white rounded-xl shadow-lg">
                          <AlertTriangle size={20}/>
                      </div>
                      <div>
                          <p className="font-black text-red-500 uppercase text-[9px] tracking-widest">Recebíveis Atrasados</p>
                          <p
                            className={`text-xs font-bold ${darkMode ? 'text-red-200' : 'text-red-800'}`}
                            title={overdueIdsTooltip}
                          >
                            {overdueCommissions.length} comissões faturadas pendentes.
                          </p>
                      </div>
                  </div>
              </div>
          )}

          {churnRisks.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-4 animate-in slide-in-from-top-4">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg">
                          <UserMinus size={20}/>
                      </div>
                      <div className="flex-1 overflow-hidden">
                          <p className="font-black text-amber-500 uppercase text-[9px] tracking-widest">Radar de Churn (VIPs)</p>
                          <p className={`text-xs font-bold truncate ${darkMode ? 'text-amber-200' : 'text-amber-800'}`}>
                             {churnRisks[0].name} e outros {churnRisks.length - 1} clientes Classe A inativos.
                          </p>
                      </div>
                  </div>
                  <button onClick={() => { /* Navigate */ }} className="shrink-0 p-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all">
                    <ArrowRight size={14}/>
                  </button>
              </div>
          )}

          {pendingTasks.length > 0 && (
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col gap-3 animate-in slide-in-from-top-4">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
                          <Clock size={20}/>
                      </div>
                      <div>
                          <p className="font-black text-indigo-500 uppercase text-[9px] tracking-widest">Pendências em Aberto</p>
                          <p className={`text-xs font-bold ${darkMode ? 'text-indigo-200' : 'text-indigo-800'}`}>
                            {pendingTasks.length} pendência(s) com prazo próximo.
                          </p>
                      </div>
                  </div>
                  <div className="space-y-2">
                      {pendingTasks.map(task => {
                        const sale = salesById.get(task.saleId);
                        return (
                          <div key={task.id} className="flex items-center justify-between text-xs">
                              <div>
                                  <p className={`font-bold ${darkMode ? 'text-indigo-100' : 'text-indigo-900'}`}>{sale?.client || task.saleClient || 'Cliente'}</p>
                                  <p className={`${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>{SALES_TASK_LABELS[task.type]}</p>
                              </div>
                              <span className={`font-black ${darkMode ? 'text-indigo-100' : 'text-indigo-800'}`}>{new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
                          </div>
                        );
                      })}
                  </div>
              </div>
          )}
      </div>

      {config.showStats && (
          <div className={`grid grid-cols-1 ${showNatalCard ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'} gap-6`}>
            <StatCard title={`Comissão Estimada (${capitalizedMonth})`} value={formatCurrency(totalCommissionMonth, hideValues)} sub="Previsão de recebimento mensal" icon={<DollarSign size={24} />} color="bg-indigo-600" darkMode={darkMode} />
            <StatCard title={`Cesta Básica (${capitalizedMonth})`} value={formatCurrency(basicCommissionMonth, hideValues)} sub={`${basicQtyMonth} cestas vendidas no mês`} icon={<ShoppingBasket size={24} />} color="bg-emerald-500" darkMode={darkMode} />
            {showNatalCard && <StatCard title={`Natal (${natalYear})`} value={formatCurrency(natalCommissionYear, hideValues)} sub={`${natalQtyYear} cestas (Acumulado Ano)`} icon={<Gift size={24} />} color="bg-red-500" darkMode={darkMode} />}
          </div>
      )}

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4`}>
        <StatCard title="Receita Total (Histórico)" value={formatCurrency(advancedIndicators.totalRevenue, hideValues)} sub="Base completa de vendas" icon={<ShoppingBag size={20} />} color="bg-slate-700" darkMode={darkMode} />
        <StatCard title="Ticket Médio" value={formatCurrency(advancedIndicators.avgTicket, hideValues)} sub="Valor médio por venda" icon={<Sparkles size={20} />} color="bg-emerald-500" darkMode={darkMode} />
        <StatCard title="Margem Média" value={`${advancedIndicators.avgMargin.toFixed(1)}%`} sub="Eficiência comercial" icon={<Edit3 size={20} />} color="bg-indigo-600" darkMode={darkMode} />
        <StatCard title="Taxa de Faturamento" value={`${advancedIndicators.billingRate.toFixed(1)}%`} sub="Vendas faturadas" icon={<CheckCircle2 size={20} />} color="bg-amber-500" darkMode={darkMode} />
        <StatCard title="Carteira Ativa" value={`${advancedIndicators.uniqueClients}`} sub="Clientes únicos" icon={<Users size={20} />} color="bg-purple-600" darkMode={darkMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {config.showCharts && (
            <div className={`lg:col-span-2 ${containerClass} p-6 rounded-[2.5rem] border min-w-0 min-h-[400px]`}>
              <h3 className={`text-lg font-black mb-6 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                <Calendar className="text-gray-400" size={20}/> Evolução de Performance
              </h3>
              <div className="h-[300px] w-full">
                {hideValues ? <div className="h-full flex items-center justify-center text-slate-500"><EyeOff size={32} /></div> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#f0f0f0'} />
                        <XAxis dataKey="name" fontSize={12} tick={{fill: '#6b7280'}} axisLine={false} tickLine={false} />
                        <YAxis fontSize={12} tickFormatter={(val) => `R$${val}`} tick={{fill: '#6b7280'}} axisLine={false} tickLine={false} width={60} />
                        <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', backgroundColor: darkMode ? '#1e293b' : '#fff' }} />
                        <Legend />
                        <Line type="monotone" dataKey="basica" name="Básica" stroke="#10b981" strokeWidth={4} dot={{r: 4}} activeDot={{r: 6}} />
                        <Line type="monotone" dataKey="natal" name="Natal" stroke="#ef4444" strokeWidth={4} dot={{r: 4}} activeDot={{r: 6}} />
                      </LineChart>
                    </ResponsiveContainer>
                )}
              </div>
            </div>
        )}

        {config.showRecents && (
            <div className={`${containerClass} p-8 rounded-[2.5rem] border overflow-hidden`}>
              <h3 className={`text-lg font-black mb-6 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Últimos Lançamentos</h3>
              <div className="space-y-4">
                {recentSales.map(sale => (
                  <div key={sale.id} className={`flex flex-col p-4 rounded-2xl border-l-4 transition-all hover:translate-x-1 ${!sale.date ? 'border-orange-500 bg-orange-500/5' : 'border-emerald-500 bg-emerald-500/5'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className={`font-black text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{sale.client}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-1">
                            {sale.type === ProductType.BASICA ? 'Básica' : 'Natal'} • {sale.quantity} und
                        </div>
                      </div>
                      <div className={`text-right font-black ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        {hideValues ? '••••••' : `+ ${formatCurrency(sale.commissionValueTotal, false)}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
