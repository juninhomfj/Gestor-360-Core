
import React, { useState } from 'react';
import { FinanceGoal } from '../types';
import { Plus, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { auth } from '../services/firebase';

interface FinanceGoalsProps {
  goals: FinanceGoal[];
  onUpdate: (goals: FinanceGoal[]) => void;
  darkMode?: boolean;
}

const FinanceGoals: React.FC<FinanceGoalsProps> = ({ goals, onUpdate, darkMode }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinanceGoal | null>(null);
  
  // Use strings for inputs to allow decimals
  const [name, setName] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [description, setDescription] = useState('');
  
  // Aportes
  const [addingAmountId, setAddingAmountId] = useState<string | null>(null);
  const [amountToAdd, setAmountToAdd] = useState('');

  const openForm = (goal?: FinanceGoal) => {
      if (goal) {
          setEditingGoal(goal);
          setName(goal.name);
          setTargetValue(goal.targetValue.toString());
          setCurrentValue(goal.currentValue.toString());
          setDescription(goal.description || '');
      } else {
          setEditingGoal(null);
          setName('');
          setTargetValue('');
          setCurrentValue('');
          setDescription('');
      }
      setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetValue) return;

    const targetNum = parseFloat(targetValue);
    const currentNum = parseFloat(currentValue) || 0;

    let newGoals = [...goals];
    if (editingGoal) {
        newGoals = goals.map(g => g.id === editingGoal.id ? { ...g, name, targetValue: targetNum, currentValue: currentNum, description } as FinanceGoal : g);
    } else {
        // Fix: Included missing required properties for FinanceGoal
        const newGoal: FinanceGoal = {
            id: crypto.randomUUID(),
            name,
            description,
            targetValue: targetNum,
            currentValue: currentNum,
            status: 'ACTIVE',
            userId: auth.currentUser?.uid || '',
            deleted: false
        };
        newGoals.push(newGoal);
    }
    onUpdate(newGoals);
    setIsFormOpen(false);
  };

  const handleDelete = (id: string) => {
      if(confirm("Excluir meta?")) {
          onUpdate(goals.filter(g => g.id !== id));
      }
  };

  const handleAddAmount = (goal: FinanceGoal) => {
      const val = parseFloat(amountToAdd);
      if (val > 0) {
          const updated = goals.map(g => g.id === goal.id ? { ...g, currentValue: g.currentValue + val } : g);
          onUpdate(updated);
          setAddingAmountId(null);
          setAmountToAdd('');
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Metas Financeiras</h1>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Acompanhe seus objetivos</p>
        </div>
        <button 
            onClick={() => openForm()}
            className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/20 flex items-center font-medium"
        >
            <Plus size={20} className="mr-2" /> Nova Meta
        </button>
      </div>

      {isFormOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} border rounded-xl p-6 w-full max-w-md shadow-2xl`}>
                  <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>{editingGoal ? 'Editar Meta' : 'Nova Meta'}</h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                          <label className={`text-sm mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Nome</label>
                          <input 
                            className={`w-full border rounded p-2 ${darkMode ? 'bg-black border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} 
                            value={name}
                            onChange={e => setName(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className={`text-sm mb-1 block ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Valor Alvo (R$)</label>
                          <input 
                            type="number"
                            step="0.01"
                            className={`w-full border rounded p-2 ${darkMode ? 'bg-black border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} 
                            value={targetValue}
                            onChange={e => setTargetValue(e.target.value)}
                          />
                      </div>
                      <div className="flex gap-2 pt-4">
                          <button type="button" onClick={() => setIsFormOpen(false)} className={`flex-1 py-2 rounded font-medium ${darkMode ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Cancelar</button>
                          <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700">Salvar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map(goal => {
              const progress = Math.min((goal.currentValue / goal.targetValue) * 100, 100);
              const isCompleted = progress >= 100;
              
              const cardClass = darkMode 
                ? `bg-gradient-to-br ${isCompleted ? 'from-green-900/40' : 'from-blue-900/40'} to-black border ${isCompleted ? 'border-green-500/30' : 'border-blue-500/30'}`
                : `bg-white border-2 ${isCompleted ? 'border-emerald-200 shadow-emerald-50' : 'border-blue-100 shadow-blue-50'} shadow-md`;

              const textClass = darkMode ? 'text-white' : 'text-gray-800';
              const subTextClass = darkMode ? 'text-gray-400' : 'text-gray-500';

              return (
                  <div key={goal.id} className={`${cardClass} p-6 rounded-xl hover:shadow-lg transition-all`}>
                      <div className="flex justify-between items-start mb-4">
                          <div>
                              <h3 className={`text-xl font-bold ${textClass}`}>{goal.name}</h3>
                              <p className={`text-sm ${subTextClass}`}>{goal.description}</p>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => openForm(goal)} className="text-blue-400 hover:bg-blue-50 p-1 rounded transition-colors"><Pencil size={16}/></button>
                              <button onClick={() => handleDelete(goal.id)} className="text-red-400 hover:bg-red-50 p-1 rounded transition-colors"><Trash2 size={16}/></button>
                          </div>
                      </div>

                      <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                              <span className={subTextClass}>Progresso</span>
                              <span className={isCompleted ? 'text-green-500 font-bold' : 'text-blue-500 font-bold'}>{progress.toFixed(1)}%</span>
                          </div>
                          <div className={`h-3 w-full rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-gray-200'}`}>
                              <div className={`h-full ${isCompleted ? 'bg-green-500' : 'bg-blue-500'} transition-all duration-500`} style={{ width: `${progress}%` }}></div>
                          </div>
                      </div>

                      <div className="flex justify-between items-center mb-4">
                          <div>
                              <p className={`text-xs ${subTextClass}`}>Atual</p>
                              <p className={`text-lg font-bold ${textClass}`}>R$ {goal.currentValue.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                              <p className={`text-xs ${subTextClass}`}>Meta</p>
                              <p className={`text-lg font-bold ${textClass}`}>R$ {goal.targetValue.toFixed(2)}</p>
                          </div>
                      </div>

                      {!isCompleted && (
                          <div className={`pt-4 border-t ${darkMode ? 'border-slate-800' : 'border-gray-100'}`}>
                              {addingAmountId === goal.id ? (
                                  <div className="flex gap-2">
                                      <input 
                                        type="number" 
                                        placeholder="Valor" aria-label="Valor" 
                                        className={`border rounded px-2 w-full ${darkMode ? 'bg-black border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                        value={amountToAdd}
                                        onChange={e => setAmountToAdd(e.target.value)}
                                      />
                                      <button onClick={() => handleAddAmount(goal)} className="bg-blue-600 text-white px-3 rounded font-bold">OK</button>
                                      <button onClick={() => setAddingAmountId(null)} className={`px-3 rounded font-bold ${darkMode ? 'bg-slate-700 text-white' : 'bg-gray-200 text-gray-700'}`}>X</button>
                                  </div>
                              ) : (
                                  <button onClick={() => setAddingAmountId(goal.id)} className={`w-full flex items-center justify-center gap-2 py-2 rounded transition-colors ${darkMode ? 'text-blue-400 hover:bg-blue-500/10' : 'text-blue-600 hover:bg-blue-50'}`}>
                                      <TrendingUp size={16} /> Adicionar Aporte
                                  </button>
                              )}
                          </div>
                      )}
                  </div>
              );
          })}
          {goals.length === 0 && (
              <div className={`col-span-full p-12 text-center rounded-xl border ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <TrendingUp size={48} className={`mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-gray-400'}`} />
                  <p className={darkMode ? 'text-slate-500' : 'text-gray-500'}>Nenhuma meta cadastrada.</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default FinanceGoals;
