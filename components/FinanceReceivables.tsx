
import React, { useState } from 'react';
import { Receivable, Sale, FinanceAccount, CommissionDeduction } from '../types';
import { Plus, CheckCircle, Clock, Trash2, Download, AlertTriangle, Edit2, X, DollarSign, Calendar, FileText, AlertCircle } from 'lucide-react';
import ImportCommissionsModal from './ImportCommissionsModal';
import { auth } from '../services/firebase';
import { ensureNumber } from '../services/logic';

interface FinanceReceivablesProps {
  receivables: Receivable[]; 
  onUpdate: (items: Receivable[]) => void; 
  sales?: Sale[];
  accounts?: FinanceAccount[];
  darkMode?: boolean;
  allowImport?: boolean; // Modular control
}

const FinanceReceivables: React.FC<FinanceReceivablesProps> = ({ 
    receivables = [], onUpdate, sales = [], accounts = [], darkMode, allowImport = true 
}) => {
  const parseNumericInput = (value: string) => (value === '' ? 0 : parseFloat(value));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<Receivable | null>(null);
  const [editDedDesc, setEditDedDesc] = useState('');
  const [editDedAmount, setEditDedAmount] = useState('');

  const [formData, setFormData] = useState({ description: '', value: '', date: '', status: 'PENDING' });

  // EFFECTIVE MODAL STATE
  const [effectiveModal, setEffectiveModal] = useState<{ isOpen: boolean, item: Receivable | null }>({ isOpen: false, item: null });
  const [effDate, setEffDate] = useState(new Date().toISOString().split('T')[0]);
  const [effMode, setEffMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [effAmountPaid, setEffAmountPaid] = useState('');

  const sortedReceivables = [...receivables].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getStatusBadge = (r: Receivable) => {
      if (r.distributed) return { label: 'Distribuído', class: 'bg-purple-100 text-purple-700' };
      if (r.status === 'EFFECTIVE') return { label: 'Efetivado', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      
      const now = new Date().toISOString().split('T')[0];
      if (r.date === now) return { label: 'Vence Hoje', class: 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' };
      if (r.date < now) return { label: 'Atrasado', class: 'bg-red-100 text-red-700 border-red-200' };
      
      return { label: 'Pendente', class: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  };

  const handleSaveNew = () => {
      if (!formData.description || !formData.value) return;
      const parsedValue = ensureNumber(formData.value);
      if (parsedValue <= 0) return;
      const newItem: Receivable = {
          id: crypto.randomUUID(),
          description: formData.description,
          value: parsedValue,
          date: formData.date || new Date().toISOString().split('T')[0],
          status: formData.status as 'PENDING' | 'EFFECTIVE',
          distributed: false,
          deductions: [],
          userId: auth.currentUser?.uid || '',
          deleted: false
      };
      onUpdate([...receivables, newItem]);
      setIsFormOpen(false);
      setFormData({ description: '', value: '', date: '', status: 'PENDING' });
  };

  const handleImport = (description: string, totalValue: number, deductions: CommissionDeduction[]) => {
      const dateStr = new Date().toISOString().split('T')[0];
      if (totalValue > 0) {
          const newRec: Receivable = {
              id: crypto.randomUUID(),
              description: description,
              value: totalValue,
              date: dateStr,
              status: 'PENDING',
              distributed: false,
              deductions: deductions,
              userId: auth.currentUser?.uid || '',
              deleted: false
          };
          onUpdate([...receivables, newRec]);
      }
  };

  const handleDelete = (id: string) => {
      if(confirm('Excluir este recebível?')) {
          onUpdate(receivables.filter(r => r.id !== id));
      }
  };

  const openEditModal = (item: Receivable) => {
      setEditingItem({ ...item, deductions: [...(item.deductions || [])] });
      setEditDedDesc('');
      setEditDedAmount('');
  };

  const openEffectiveModal = (item: Receivable) => {
      setEffectiveModal({ isOpen: true, item });
      setEffDate(new Date().toISOString().split('T')[0]);
      setEffMode('FULL');
      const net = calculateNet(item);
      setEffAmountPaid(net.toFixed(2));
  };

  const confirmEffective = () => {
      const item = effectiveModal.item;
      if (!item) return;

      const netTotal = calculateNet(item);
      const paidAmount = effMode === 'FULL' ? netTotal : parseFloat(effAmountPaid);

      if (isNaN(paidAmount) || paidAmount <= 0 || paidAmount > netTotal) {
          alert("Valor inválido.");
          return;
      }

      const remaining = netTotal - paidAmount;
      const updatedReceivables = [...receivables];

      const effectiveItemIndex = updatedReceivables.findIndex(r => r.id === item.id);
      if (effectiveItemIndex !== -1) {
          updatedReceivables[effectiveItemIndex] = {
              ...item,
              date: effDate,
              status: 'EFFECTIVE',
              value: paidAmount, 
              deductions: [], 
              description: item.description + (effMode === 'PARTIAL' ? ' (Parcial)' : '')
          };
      }

      if (remaining > 0.01) {
          updatedReceivables.push({
              id: crypto.randomUUID(),
              description: item.description + ' (Restante)',
              value: remaining,
              date: item.date, 
              status: 'PENDING',
              distributed: false,
              deductions: [],
              userId: auth.currentUser?.uid || '',
              deleted: false
          });
      }

      onUpdate(updatedReceivables);
      setEffectiveModal({ isOpen: false, item: null });
  };

  const handleAddDeductionToEdit = () => {
      if (!editingItem || !editDedDesc || !editDedAmount) return;
      const val = parseFloat(editDedAmount);
      if (val <= 0) return;
      const newDed: CommissionDeduction = { id: crypto.randomUUID(), description: editDedDesc, amount: val };
      setEditingItem({ ...editingItem, deductions: [...(editingItem.deductions || []), newDed] });
      setEditDedDesc('');
      setEditDedAmount('');
  };

  const handleRemoveDeductionFromEdit = (dedId: string) => {
      if (!editingItem) return;
      setEditingItem({ ...editingItem, deductions: editingItem.deductions?.filter(d => d.id !== dedId) || [] });
  };

  const handleSaveEdit = () => {
      if (!editingItem) return;
      onUpdate(receivables.map(r => r.id === editingItem.id ? editingItem : r));
      setEditingItem(null);
  };

  const calculateNet = (r: Receivable) => (r.value - (r.deductions?.reduce((acc, d) => acc + d.amount, 0) || 0));
  const totalPending = receivables.filter(r => r.status === 'PENDING').reduce((acc, r) => acc + calculateNet(r), 0);
  const totalEffective = receivables.filter(r => r.status === 'EFFECTIVE' && !r.distributed).reduce((acc, r) => acc + calculateNet(r), 0);

  const cardClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-800';
  const inputClass = darkMode ? 'bg-black border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>A Receber (Master)</h1>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Gerencie comissões brutas e descontos.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            {allowImport && (
                <button onClick={() => setIsImportOpen(true)} className="flex-1 md:flex-none bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center justify-center shadow-lg text-sm font-bold transition-all">
                    <Download size={18} className="mr-2"/> Importar
                </button>
            )}
            <button onClick={() => setIsFormOpen(true)} className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center shadow-lg text-sm font-bold transition-all">
                <Plus size={18} className="mr-2"/> Novo
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900 border-yellow-900/50' : 'bg-yellow-50 border-yellow-100'}`}>
              <div className="flex items-center gap-3 mb-2">
                  <Clock className="text-yellow-500" />
                  <span className={`font-bold ${darkMode ? 'text-yellow-500' : 'text-yellow-700'}`}>Pendente (Líquido)</span>
              </div>
              <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>R$ {totalPending.toFixed(2)}</p>
          </div>
          <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900 border-emerald-900/50' : 'bg-emerald-50 border-emerald-100'}`}>
              <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="text-emerald-500" />
                  <span className={`font-bold ${darkMode ? 'text-emerald-500' : 'text-emerald-700'}`}>Disponível p/ Distribuir</span>
              </div>
              <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>R$ {totalEffective.toFixed(2)}</p>
          </div>
      </div>

      {isFormOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className={`rounded-xl p-6 w-full max-w-md ${cardClass}`}>
                  <h3 className="text-xl font-bold mb-4">Novo Recebível Manual</h3>
                  <div className="space-y-4">
                      <input className={`w-full p-2 rounded border ${inputClass}`} placeholder="Descrição" aria-label="Descrição" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                      <input type="number" className={`w-full p-2 rounded border ${inputClass}`} placeholder="Valor Bruto (R$)" aria-label="Valor Bruto (R$)" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} />
                      <input type="date" className={`w-full p-2 rounded border ${inputClass}`} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                      <div className="flex justify-end gap-2">
                          <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-gray-500">Cancelar</button>
                          <button onClick={handleSaveNew} className="px-4 py-2 bg-blue-600 text-white rounded">Salvar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* EFFECTIVE CONFIRMATION MODAL */}
      {effectiveModal.isOpen && effectiveModal.item && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className={`rounded-xl w-full max-w-md shadow-2xl overflow-hidden ${cardClass} animate-in zoom-in-95`}>
                  <div className="p-5 border-b border-gray-200 dark:border-slate-700">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                          <CheckCircle className="text-emerald-500" /> Efetivar Recebimento
                      </h3>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <p className="text-sm font-bold opacity-70 mb-1">Item</p>
                          <p className="text-lg">{effectiveModal.item.description}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-xs font-bold uppercase block mb-1 opacity-70">Data Efetivação</label>
                              <input 
                                type="date" 
                                className={`w-full p-2 rounded border ${inputClass}`} 
                                value={effDate} onChange={e => setEffDate(e.target.value)} 
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold uppercase block mb-1 opacity-70">Tipo de Pagamento</label>
                              <select 
                                className={`w-full p-2 rounded border ${inputClass}`}
                                value={effMode} onChange={e => setEffMode(e.target.value as any)}
                              >
                                  <option value="FULL">Integral</option>
                                  <option value="PARTIAL">Parcelado / Parcial</option>
                              </select>
                          </div>
                      </div>

                      {effMode === 'PARTIAL' && (
                          <div className={`p-4 rounded-lg border border-dashed ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-300'}`}>
                              <label className="text-xs font-bold uppercase block mb-1 opacity-70">Valor Pago Agora (Líquido)</label>
                              <input 
                                type="number" 
                                className={`w-full p-2 rounded border text-lg font-bold ${inputClass} border-emerald-500`} 
                                value={effAmountPaid} onChange={e => setEffAmountPaid(e.target.value)} 
                              />
                              <div className="flex justify-between mt-2 text-xs">
                                  <span>Total Líquido: <strong>R$ {calculateNet(effectiveModal.item).toFixed(2)}</strong></span>
                                  <span className="text-orange-500">Restante: <strong>R$ {(calculateNet(effectiveModal.item) - (parseFloat(effAmountPaid)||0)).toFixed(2)}</strong></span>
                              </div>
                          </div>
                      )}

                      {effMode === 'FULL' && (
                          <div className="text-center p-3">
                              <p className="text-gray-500 text-sm">Valor Total Líquido</p>
                              <p className="text-2xl font-bold text-emerald-500">R$ {calculateNet(effectiveModal.item).toFixed(2)}</p>
                          </div>
                      )}
                  </div>
                  <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
                      <button onClick={() => setEffectiveModal({ isOpen: false, item: null })} className="px-4 py-2 text-sm font-bold text-gray-500">Cancelar</button>
                      <button onClick={confirmEffective} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg">Confirmar</button>
                  </div>
              </div>
          </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className={`rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh] shadow-2xl ${cardClass}`}>
                  {/* Modal Header */}
                  <div className={`p-5 border-b flex justify-between items-center ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-gray-50'}`}>
                      <div>
                        <h3 className="text-lg font-bold flex items-center gap-2"><Edit2 size={18} className="text-blue-500"/> Editar Recebimento</h3>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>ID: {editingItem.id.slice(0,8)}</p>
                      </div>
                      <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} className="text-gray-400"/></button>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-6">
                      {/* Main Info Grid */}
                      <div className="grid grid-cols-12 gap-4">
                          <div className="col-span-12">
                              <label className="text-xs font-bold mb-1 block opacity-70 flex items-center gap-1"><FileText size={12}/> Descrição</label>
                              <input type="text" className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${inputClass}`} value={editingItem.description} onChange={e => setEditingItem({...editingItem, description: e.target.value})} />
                          </div>
                          
                          <div className="col-span-6">
                              <label className="text-xs font-bold mb-1 block opacity-70 flex items-center gap-1"><DollarSign size={12}/> Valor Bruto</label>
                              <div className={`flex items-center px-3 py-2 rounded-lg border ${inputClass}`}>
                                  <span className="mr-2 opacity-50 font-bold">R$</span>
                                  <input type="number" className="bg-transparent outline-none w-full font-bold text-lg" value={editingItem.value === 0 ? '' : editingItem.value} onChange={e => setEditingItem({...editingItem, value: parseNumericInput(e.target.value)})} />
                              </div>
                          </div>
                          
                          <div className="col-span-6">
                              <label className="text-xs font-bold mb-1 block opacity-70 flex items-center gap-1"><Calendar size={12}/> Data</label>
                              <input type="date" className={`w-full px-3 py-2.5 rounded-lg border ${inputClass}`} value={editingItem.date} onChange={e => setEditingItem({...editingItem, date: e.target.value})} />
                          </div>
                      </div>

                      {/* Deductions Section */}
                      <div className={`rounded-xl border overflow-hidden ${darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                          <div className={`p-3 border-b flex justify-between items-center ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-100'}`}>
                             <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><AlertTriangle size={14} className="text-red-500" /> Descontos / Impostos</h4>
                             <span className="text-xs font-mono text-red-500">Total: -R$ {editingItem.deductions?.reduce((a,b) => a+b.amount, 0).toFixed(2) || '0.00'}</span>
                          </div>
                          
                          <div className="p-4 space-y-3">
                              {/* Add Deduction */}
                              <div className="flex gap-2">
                                  <input placeholder="Ex: IRRF, Taxa" aria-label="Ex: IRRF, Taxa" className={`flex-1 px-3 py-2 text-sm rounded-lg border ${inputClass}`} value={editDedDesc} onChange={e => setEditDedDesc(e.target.value)} />
                                  <input type="number" placeholder="R$" aria-label="R$" className={`w-24 px-3 py-2 text-sm rounded-lg border ${inputClass}`} value={editDedAmount} onChange={e => setEditDedAmount(e.target.value)} />
                                  <button onClick={handleAddDeductionToEdit} className="px-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm" aria-label="Adicionar" title="Adicionar"><Plus size={18} /></button>
                              </div>

                              {/* Deduction List */}
                              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                  {editingItem.deductions?.map(d => (
                                      <div key={d.id} className={`flex justify-between items-center text-sm p-2.5 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                                          <span className="truncate mr-2">{d.description}</span>
                                          <div className="flex items-center gap-3 shrink-0">
                                              <span className="text-red-500 font-bold font-mono">- R$ {d.amount.toFixed(2)}</span>
                                              <button onClick={() => handleRemoveDeductionFromEdit(d.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                                          </div>
                                      </div>
                                  ))}
                                  {(!editingItem.deductions || editingItem.deductions.length === 0) && (<p className="text-xs text-gray-500 text-center py-2">Nenhum desconto aplicado.</p>)}
                              </div>
                          </div>
                      </div>

                      {/* Total Net & Status */}
                      <div className={`p-4 rounded-xl flex items-center justify-between border ${darkMode ? 'bg-black border-emerald-900/30' : 'bg-blue-50 border-blue-100'}`}>
                          <div>
                              <p className="text-xs uppercase font-bold opacity-60">Valor Líquido Final</p>
                              <p className="text-3xl font-bold text-emerald-500 tracking-tight">R$ {calculateNet(editingItem).toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-xs uppercase font-bold opacity-60 mb-1">Status Atual</p>
                              <label className={`inline-flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border transition-all ${editingItem.status === 'EFFECTIVE' ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/20 shadow-lg' : 'bg-gray-200 border-gray-300 text-gray-600'}`}>
                                  <input type="checkbox" className="hidden" checked={editingItem.status === 'EFFECTIVE'} onChange={e => setEditingItem({...editingItem!, status: e.target.checked ? 'EFFECTIVE' : 'PENDING'})} />
                                  <span className="font-bold text-xs">{editingItem.status === 'EFFECTIVE' ? 'EFETIVADO' : 'PENDENTE'}</span>
                                  {editingItem.status === 'EFFECTIVE' && <CheckCircle size={14}/>}
                              </label>
                          </div>
                      </div>
                  </div>

                  <div className={`p-5 border-t flex justify-end gap-3 rounded-b-2xl ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-gray-50'}`}>
                      <button onClick={() => setEditingItem(null)} className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Cancelar</button>
                      <button onClick={handleSaveEdit} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700 transition-all transform hover:scale-105">Salvar Alterações</button>
                  </div>
              </div>
          </div>
      )}

      {/* LIST */}
      <div className={`rounded-xl border overflow-hidden ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
                <thead className={darkMode ? 'bg-slate-900 text-gray-400' : 'bg-gray-50 text-gray-600'}>
                    <tr>
                        <th className="px-4 py-3 text-left">Data/Desc</th>
                        <th className="px-4 py-3 text-right">Bruto</th>
                        <th className="px-4 py-3 text-right">Desc.</th>
                        <th className="px-4 py-3 text-right">Líquido</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-100'}`}>
                    {sortedReceivables.map(r => {
                        const net = calculateNet(r);
                        const badge = getStatusBadge(r);
                        return (
                            <tr key={r.id} className={darkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-50'}>
                                <td className={`px-4 py-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                    <div className="font-medium text-sm">{r.description}</div>
                                    <div className="text-xs opacity-70">{new Date(r.date).toLocaleDateString('pt-BR')}</div>
                                </td>
                                <td className={`px-4 py-3 text-right ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>R$ {r.value.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right text-red-400">-{ (r.value - net).toFixed(2) }</td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-500">R$ {net.toFixed(2)}</td>
                                <td className="px-4 py-3 text-center">
                                    <button 
                                        onClick={() => !r.distributed && openEditModal(r)} 
                                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${badge.class}`}
                                        disabled={r.distributed}
                                    >
                                        {badge.label}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex justify-center gap-2">
                                        {r.status === 'PENDING' && (
                                            <button onClick={() => openEffectiveModal(r)} className="text-emerald-500 hover:text-emerald-400 p-1.5 rounded hover:bg-emerald-500/10 transition-colors" title="Efetivar Rápido">
                                                <CheckCircle size={16} />
                                            </button>
                                        )}
                                        <button onClick={() => openEditModal(r)} className="text-blue-400 hover:text-blue-500 p-1.5 rounded hover:bg-blue-50/10 transition-colors" title="Editar">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(r.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50/10 transition-colors" title="Excluir">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
          </div>
          {/* MOBILE CARDS */}
          <div className="md:hidden p-3 space-y-3">
              {sortedReceivables.map(r => {
                  const net = calculateNet(r);
                  const badge = getStatusBadge(r);
                  return (
                      <div key={r.id} className={`p-3 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                          <div className="flex justify-between items-start">
                              <div>
                                  <p className={`font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{r.description}</p>
                                  <p className="text-xs text-gray-500">{new Date(r.date).toLocaleDateString('pt-BR')}</p>
                              </div>
                              <div className="text-right">
                                  <p className="font-bold text-lg text-emerald-500">R$ {net.toFixed(2)}</p>
                                  <p className="text-xs text-gray-500">Líquido</p>
                              </div>
                          </div>
                          <div className={`mt-2 pt-2 border-t flex justify-between items-center ${darkMode ? 'border-slate-700' : 'border-gray-100'}`}>
                              <button 
                                onClick={() => !r.distributed && openEditModal(r)} 
                                className={`px-2 py-1 rounded text-[10px] font-bold border ${badge.class}`}
                                disabled={r.distributed}
                              >
                                  {badge.label}
                              </button>
                              <div className="flex gap-2">
                                  {r.status === 'PENDING' && <button onClick={() => openEffectiveModal(r)} className="text-emerald-500"><CheckCircle size={16}/></button>}
                                  <button onClick={() => openEditModal(r)} className="text-blue-500"><Edit2 size={16}/></button>
                                  <button onClick={() => handleDelete(r.id)} className="text-red-500"><Trash2 size={16}/></button>
                              </div>
                          </div>
                      </div>
                  )
              })}
          </div>

        {sortedReceivables.length === 0 && (
            <p className="text-center py-8 text-gray-500">Nenhum recebível cadastrado.</p>
        )}
      </div>

      <ImportCommissionsModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} sales={sales} onImport={handleImport} darkMode={darkMode} />
    </div>
  );
};

export default FinanceReceivables;
