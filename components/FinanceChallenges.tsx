
import React, { useState, useEffect } from 'react';
import { Challenge, ChallengeCell, ChallengeModel } from '../types';
// Fix: Added 'generateChallengeCells' to imports as it is now correctly exported from services/logic
import { generateChallengeCells } from '../services/logic';
import { Plus, Trophy, Calendar, Grid, CheckCircle, HelpCircle, Shuffle, Clock, TrendingUp, DollarSign } from 'lucide-react';
import { auth } from '../services/firebase';

interface FinanceChallengesProps {
  challenges: Challenge[];
  cells: ChallengeCell[];
  onUpdate: (challenges: Challenge[], cells: ChallengeCell[]) => void;
  darkMode?: boolean;
}

const FinanceChallenges: React.FC<FinanceChallengesProps> = ({ challenges, cells, onUpdate, darkMode }) => {
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(challenges[0]?.id || null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const parseNumericInput = (value: string) => (value === '' ? 0 : Number(value));
  
  // Create Form State
  const [newChalData, setNewChalData] = useState({ name: '', target: 1000, count: 52, model: 'LINEAR' as ChallengeModel });

  // Deposit Modal State
  const [depositCell, setDepositCell] = useState<ChallengeCell | null>(null);

  useEffect(() => {
      if (challenges.length > 0 && !activeChallengeId) {
          setActiveChallengeId(challenges[0].id);
      }
  }, [challenges]);

  const activeChallenge = challenges.find(c => c.id === activeChallengeId);
  const activeCells = cells.filter(c => c.challengeId === activeChallengeId).sort((a,b) => a.number - b.number);
  const paidCells = activeCells.filter(c => c.status === 'PAID');
  const progress = activeChallenge ? (paidCells.length / activeCells.length) * 100 : 0;

  const handleCreate = () => {
      const id = crypto.randomUUID();
      // Fix: Included missing required properties for Challenge
      const newChallenge: Challenge = {
          id,
          name: newChalData.name,
          targetValue: Number(newChalData.target),
          depositCount: Number(newChalData.count),
          model: newChalData.model,
          createdAt: new Date().toISOString(),
          status: 'ACTIVE',
          userId: auth.currentUser?.uid || '',
          deleted: false
      };
      const newCells = generateChallengeCells(id, newChallenge.targetValue, newChallenge.depositCount, newChallenge.model);
      
      onUpdate([...challenges, newChallenge], [...cells, ...newCells]);
      setIsCreateOpen(false);
      setActiveChallengeId(id);
  };

  const handleDeposit = () => {
      if (depositCell) {
          const updatedCells = cells.map(c => c.id === depositCell.id ? { ...c, status: 'PAID' as const, paidDate: new Date().toISOString() } : c as ChallengeCell);
          onUpdate(challenges, updatedCells);
          setDepositCell(null);
      }
  };

  const handleLuckyDraw = () => {
      const pending = activeCells.filter(c => c.status === 'PENDING');
      if (pending.length > 0) {
          const random = pending[Math.floor(Math.random() * pending.length)];
          setDepositCell(random);
      } else {
          alert("Desafio concluído! Parabéns!");
      }
  };

  // --- DYNAMIC SIMULATOR LOGIC ---
  const calculateSimulation = () => {
      const target = Number(newChalData.target);
      const count = Number(newChalData.count);
      
      if (!target || !count) return null;

      const avgValue = target / count;

      const formatDuration = (totalMonths: number) => {
          if (totalMonths < 1) return '< 1 mês';
          if (totalMonths < 12) return `${Math.ceil(totalMonths)} meses`;
          const years = Math.floor(totalMonths / 12);
          const months = Math.ceil(totalMonths % 12);
          return months > 0 ? `${years} anos e ${months} meses` : `${years} anos`;
      };

      return [
          {
              label: 'Semanal',
              duration: formatDuration(count / 4.33),
              avgDeposit: avgValue,
              color: 'text-emerald-500',
              bg: darkMode ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
          },
          {
              label: 'Quinzenal',
              duration: formatDuration(count / 2.16),
              avgDeposit: avgValue,
              color: 'text-blue-500',
              bg: darkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
          },
          {
              label: 'Mensal',
              duration: formatDuration(count),
              avgDeposit: avgValue,
              color: 'text-purple-500',
              bg: darkMode ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'
          }
      ];
  };

  const simulation = calculateSimulation();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
          <div>
              <h1 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Desafios de Poupança</h1>
              <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Gamifique suas economias</p>
          </div>
          <button 
             onClick={() => setIsCreateOpen(true)}
             className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center shadow-lg"
          >
              <Plus size={20} className="mr-2"/> Novo Desafio
          </button>
      </div>

      {challenges.length === 0 && !isCreateOpen && (
          <div className={`p-12 text-center rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <Trophy size={48} className={`mx-auto mb-4 ${darkMode ? 'text-purple-500' : 'text-purple-600'}`} />
              <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Nenhum desafio ativo. Que tal começar um?</p>
              <button onClick={() => setIsCreateOpen(true)} className="text-purple-500 underline mt-4 font-medium">Criar meu primeiro desafio</button>
          </div>
      )}

      {/* TABS */}
      {challenges.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
              {challenges.map(c => (
                  <button 
                    key={c.id}
                    onClick={() => setActiveChallengeId(c.id)}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors border ${
                        activeChallengeId === c.id 
                        ? 'bg-purple-600 text-white border-purple-600 shadow' 
                        : (darkMode ? 'bg-slate-800 text-gray-400 border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')
                    }`}
                  >
                      {c.name}
                  </button>
              ))}
          </div>
      )}

      {/* DASHBOARD */}
      {activeChallenge && (
          <div className="space-y-6">
              {/* STATUS CARD */}
              <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gradient-to-r from-slate-900 to-slate-800 border-slate-700' : 'bg-white border-gray-200 shadow-md'}`}>
                  <div className="flex justify-between items-end mb-4">
                      <div>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Progresso Total</p>
                          <h2 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{progress.toFixed(1)}%</h2>
                      </div>
                      <div className="text-right">
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Meta</p>
                          <p className="text-xl font-bold text-emerald-500">R$ {activeChallenge.targetValue.toFixed(2)}</p>
                      </div>
                  </div>
                  <div className={`h-4 rounded-full overflow-hidden ${darkMode ? 'bg-slate-950' : 'bg-gray-100'}`}>
                      <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-700" style={{ width: `${progress}%` }}></div>
                  </div>
                  <div className="mt-4 flex gap-4">
                      <button onClick={handleLuckyDraw} className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm transition-colors shadow-sm">
                          <Shuffle size={16} /> Sortear Depósito
                      </button>
                  </div>
              </div>

              {/* GRID */}
              <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-2">
                  {activeCells.map(cell => (
                      <button 
                        key={cell.id}
                        onClick={() => cell.status === 'PENDING' && setDepositCell(cell)}
                        disabled={cell.status === 'PAID'}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center p-1 border transition-all shadow-sm ${
                            cell.status === 'PAID' 
                            ? (darkMode ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-500' : 'bg-emerald-100 border-emerald-200 text-emerald-700')
                            : (darkMode ? 'bg-slate-800 border-slate-700 text-gray-400 hover:border-purple-500 hover:text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-purple-500 hover:text-purple-600 hover:shadow-md')
                        }`}
                      >
                          <span className="text-[10px] opacity-50">#{cell.number}</span>
                          <span className="text-xs font-bold">R${Math.round(cell.value)}</span>
                      </button>
                  ))}
              </div>
          </div>
      )}

      {/* CREATE MODAL */}
      {isCreateOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'} border rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl`}>
                  
                  <div className={`p-6 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Novo Desafio</h2>
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Defina sua meta e veja a simulação.</p>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-6">
                      <div className="space-y-4">
                          <div>
                              <label className={`text-sm font-bold mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Nome do Desafio</label>
                              <input className={`w-full border rounded p-3 outline-none ${darkMode ? 'bg-black border-slate-700 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} 
                                    value={newChalData.name} onChange={e => setNewChalData({...newChalData, name: e.target.value})} placeholder="Ex: Viagem 2026"/>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                  <label className={`text-sm font-bold mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Valor Meta (R$)</label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-3 text-slate-500">R$</span>
                                    <input type="number" className={`w-full border rounded p-3 pl-10 outline-none font-bold ${darkMode ? 'bg-black border-slate-700 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} 
                                            value={newChalData.target === 0 ? "" : newChalData.target} onChange={e => setNewChalData({...newChalData, target: parseNumericInput(e.target.value)})}/>
                                  </div>
                              </div>
                              <div>
                                  <label className={`text-sm font-bold mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Quantidade de Depósitos</label>
                                  <input type="number" className={`w-full border rounded p-3 outline-none ${darkMode ? 'bg-black border-slate-700 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} 
                                        value={newChalData.count === 0 ? "" : newChalData.count} onChange={e => setNewChalData({...newChalData, count: parseNumericInput(e.target.value)})}/>
                              </div>
                          </div>

                          {/* SIMULATOR */}
                          {simulation && (
                              <div className="mt-6">
                                  <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                      <Clock size={16} className="text-purple-500"/> 
                                      Simulação de Tempo e Esforço
                                  </h3>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      {simulation.map((sim, idx) => (
                                          <div key={idx} className={`p-3 rounded-lg border ${sim.bg}`}>
                                              <p className={`text-xs font-bold uppercase mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{sim.label}</p>
                                              <p className={`text-lg font-bold mb-1 ${sim.color}`}>{sim.duration}</p>
                                              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                                  ~ R$ {sim.avgDeposit.toFixed(2)} / dep.
                                              </p>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}

                          <div className={`pt-4 border-t ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}>
                              <label className={`text-sm font-bold mb-3 block ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Modelo de Cálculo dos Valores</label>
                              <div className="grid grid-cols-3 gap-3">
                                  <button 
                                    onClick={() => setNewChalData({...newChalData, model: 'LINEAR'})}
                                    className={`p-3 rounded-lg border text-left transition-all ${newChalData.model === 'LINEAR' ? 'bg-purple-600 border-purple-500 text-white' : (darkMode ? 'bg-black border-slate-700 text-gray-400 hover:border-slate-500' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400')}`}
                                  >
                                      <span className="block text-xs font-bold uppercase mb-1">Linear</span>
                                      <span className="text-[10px] opacity-80 block">Valores crescentes (1, 2, 3...) ajustados à meta.</span>
                                  </button>
                                  <button 
                                    onClick={() => setNewChalData({...newChalData, model: 'PROPORTIONAL'})}
                                    className={`p-3 rounded-lg border text-left transition-all ${newChalData.model === 'PROPORTIONAL' ? 'bg-purple-600 border-purple-500 text-white' : (darkMode ? 'bg-black border-slate-700 text-gray-400 hover:border-slate-500' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400')}`}
                                  >
                                      <span className="block text-xs font-bold uppercase mb-1">Igual (Fixo)</span>
                                      <span className="text-[10px] opacity-80 block">Divide a meta igualmente entre os depósitos.</span>
                                  </button>
                                  <button 
                                    onClick={() => setNewChalData({...newChalData, model: 'CUSTOM'})}
                                    className={`p-3 rounded-lg border text-left transition-all ${newChalData.model === 'CUSTOM' ? 'bg-purple-600 border-purple-500 text-white' : (darkMode ? 'bg-black border-slate-700 text-gray-400 hover:border-slate-500' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400')}`}
                                  >
                                      <span className="block text-xs font-bold uppercase mb-1">Manual</span>
                                      <span className="text-[10px] opacity-80 block">Começa zerado para você preencher.</span>
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className={`p-6 border-t flex gap-4 rounded-b-xl ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-gray-50'}`}>
                      <button onClick={() => setIsCreateOpen(false)} className={`flex-1 py-3 rounded-lg font-medium transition-colors ${darkMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}>Cancelar</button>
                      <button onClick={handleCreate} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold hover:shadow-lg transition-all">Criar Desafio</button>
                  </div>
              </div>
          </div>
      )}

      {/* DEPOSIT MODAL */}
      {depositCell && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className={`${darkMode ? 'bg-slate-900 border-emerald-500/50' : 'bg-white border-emerald-200'} border rounded-xl p-8 w-full max-sm text-center shadow-2xl`}>
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={32} className="text-emerald-500" />
                  </div>
                  <h3 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Pagar Depósito #{depositCell.number}</h3>
                  <p className={`mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Valor: <strong className="text-emerald-500 text-xl">R$ {depositCell.value.toFixed(2)}</strong></p>
                  
                  <button onClick={handleDeposit} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 mb-3 shadow-md">
                      Confirmar Pagamento
                  </button>
                  <button onClick={() => setDepositCell(null)} className={`text-sm ${darkMode ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                      Cancelar
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default FinanceChallenges;
