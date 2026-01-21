
import React, { useMemo, useState } from 'react';
import { Sale, ProductType, SalesTask, SalesTaskStatus, SalesTaskType } from '../types';
import { CheckCircle, Clock, Search, ClipboardList, AlertCircle, Calendar, ListTodo } from 'lucide-react';
import { AudioService } from '../services/audioService';
import { SALES_TASK_LABELS, SALES_TASK_OPTIONS } from '../utils/salesTasks';

interface BoletoControlProps {
  sales: Sale[];
  tasks: SalesTask[];
  onUpdateTask: (updatedTask: SalesTask) => void;
  isLocked?: boolean;
}

const BoletoControl: React.FC<BoletoControlProps> = ({ sales, tasks, onUpdateTask, isLocked }) => {
  const [filterType, setFilterType] = useState<'ALL' | SalesTaskType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SalesTaskStatus>('OPEN');
  const [searchTerm, setSearchTerm] = useState('');
  const isReadOnly = Boolean(isLocked);

  const salesById = useMemo(() => new Map(sales.map(sale => [sale.id, sale])), [sales]);

  const filteredTasks = tasks.filter(task => {
    if (filterType !== 'ALL' && task.type !== filterType) return false;
    if (statusFilter !== 'ALL' && task.status !== statusFilter) return false;
    const sale = salesById.get(task.saleId);
    const clientName = sale?.client || task.saleClient || '';
    if (searchTerm && !clientName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleStatusChange = (task: SalesTask, newStatus: SalesTaskStatus) => {
    if (isReadOnly) return;
    if (newStatus === 'DONE') {
        AudioService.play('SUCCESS');
    }
    const updatedTask: SalesTask = {
      ...task,
      status: newStatus,
      completedAt: newStatus === 'DONE' ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    };
    onUpdateTask(updatedTask);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                <ClipboardList className="mr-2 text-indigo-600" />
                Pendências
            </h1>
            <p className="text-gray-500 text-sm mt-1">
                Acompanhe pendências vinculadas às vendas para não perder prazos importantes.
            </p>
          </div>
      </div>

      {isReadOnly && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="text-amber-600 mt-0.5" size={20} />
              <div>
                  <h4 className="font-bold text-amber-800 text-sm">Módulo de Vendas Bloqueado</h4>
                  <p className="text-xs text-amber-700">
                      Alterações de status e rastreio estão temporariamente desativadas.
                  </p>
              </div>
          </div>
      )}

      {/* Info Banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-indigo-500 mt-0.5" size={20} />
          <div>
              <h4 className="font-bold text-indigo-800 text-sm">Painel de Pendências</h4>
              <p className="text-xs text-indigo-700">
                  Registre pendências como cobrança, envio de boleto ou avisos de entrega e acompanhe a execução.
              </p>
          </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:flex-1 min-w-[200px]">
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Buscar cliente..." aria-label="Buscar cliente..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            </div>
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
            <select 
                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm bg-white text-gray-900"
                value={filterType}
                onChange={e => setFilterType(e.target.value as any)}
            >
                <option value="ALL">Todos os Tipos</option>
                {SALES_TASK_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>

            <select 
                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm bg-white text-gray-900 font-bold text-gray-700"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
            >
                <option value="ALL">Todos os Status</option>
                <option value="OPEN">⏳ Em aberto</option>
                <option value="DONE">✅ Concluído</option>
            </select>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.map(task => {
          const sale = salesById.get(task.saleId);
          const clientName = sale?.client || task.saleClient || 'Cliente não encontrado';
          return (
          <div key={task.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                
                {/* Info Column */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide bg-indigo-100 text-indigo-700">
                      {SALES_TASK_LABELS[task.type]}
                    </span>
                    {sale && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${sale.type === ProductType.BASICA ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {sale.type === ProductType.BASICA ? 'Básica' : 'Natal'}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar size={10}/>
                        Prazo: {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem data'}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg leading-tight">{clientName}</h3>
                  {sale && (
                    <div className="text-sm text-gray-500">
                        <span className="font-medium text-gray-700">{sale.quantity} un.</span> • Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.valueSold * sale.quantity)}
                    </div>
                  )}
                </div>

                {/* Action Column */}
                <div className="flex flex-col items-center gap-2 min-w-[200px]">
                    <span className="text-xs font-bold text-gray-400 uppercase">Status da Pendência</span>
                    <div className="flex items-center bg-gray-100 rounded-lg p-1 w-full">
                        <button 
                          onClick={() => handleStatusChange(task, 'OPEN')}
                          title="Em aberto"
                          disabled={isReadOnly}
                          className={`flex-1 p-2 rounded-md flex justify-center transition-all ${task.status === 'OPEN' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                           <Clock size={18} />
                        </button>
                        <button 
                          onClick={() => handleStatusChange(task, 'DONE')}
                          title="Concluído"
                          disabled={isReadOnly}
                          className={`flex-1 p-2 rounded-md flex justify-center transition-all ${task.status === 'DONE' ? 'bg-emerald-500 shadow text-white' : 'text-gray-400 hover:text-gray-600'} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                           <CheckCircle size={18} />
                        </button>
                    </div>
                    <div className="text-xs font-medium text-gray-500">
                        {task.status === 'OPEN' && 'Em aberto'}
                        {task.status === 'DONE' && 'Concluído'}
                    </div>
                </div>
            </div>
          </div>
        );
        })}
        {filteredTasks.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <ListTodo size={40} className="mx-auto text-gray-300 mb-2"/>
                <p className="text-gray-500 font-medium">Nenhuma pendência encontrada com este filtro.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default BoletoControl;
