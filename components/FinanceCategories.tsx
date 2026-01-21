
import React, { useState, useMemo } from 'react';
import { TransactionCategory, PersonType } from '../types';
import { Tag, Plus, Trash2, Check, X, Search, User, Building2 } from 'lucide-react';
// Added auth import to get the current user ID
import { auth } from '../services/firebase';

interface FinanceCategoriesProps {
  categories: TransactionCategory[];
  onUpdate: (cats: TransactionCategory[]) => void;
  darkMode?: boolean;
}

const FinanceCategories: React.FC<FinanceCategoriesProps> = ({ categories, onUpdate, darkMode }) => {
  const [activeTab, setActiveTab] = useState<PersonType>('PF');
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Subcategory Editing
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [editingBudget, setEditingBudget] = useState<{id: string, value: string} | null>(null);

  const handleAdd = () => {
      if (newCatName) {
          // Fix: Included missing required property userId for TransactionCategory
          const newCat: TransactionCategory = {
              id: crypto.randomUUID(),
              name: newCatName,
              type: newCatType,
              personType: activeTab, 
              subcategories: [],
              monthlyBudget: 0,
              isActive: true,
              deleted: false,
              userId: auth.currentUser?.uid || ''
          };
          onUpdate([...categories, newCat]);
          setNewCatName('');
      }
  };

  const handleDelete = (id: string) => {
      if (confirm("Excluir categoria?")) {
          onUpdate(categories.filter(c => c.id !== id));
      }
  };

  const handleAddSubcategory = (catId: string) => {
      if (!newSubName) return;
      onUpdate(categories.map(c => {
          if (c.id === catId) {
              return { ...c, subcategories: [...(c.subcategories || []), newSubName] };
          }
          return c;
      }));
      setNewSubName('');
  };

  const handleRemoveSubcategory = (catId: string, sub: string) => {
      onUpdate(categories.map(c => {
          if (c.id === catId) {
              return { ...c, subcategories: c.subcategories.filter(s => s !== sub) };
          }
          return c;
      }));
  };

  const handleSaveBudget = () => {
      if(editingBudget) {
          onUpdate(categories.map(c => {
              if (c.id === editingBudget.id) {
                  return { ...c, monthlyBudget: parseFloat(editingBudget.value) || 0 };
              }
              return c;
          }));
          setEditingBudget(null);
      }
  };

  // --- OPTIMIZED FILTERING ---
  const filteredCategories = useMemo(() => {
      let filtered = categories.filter(c => c.personType === activeTab); // Filter by Tab (PF/PJ)

      if (searchTerm) {
          const lowerSearch = searchTerm.toLowerCase();
          filtered = filtered.filter(c => 
              c.name.toLowerCase().includes(lowerSearch) || 
              c.subcategories?.some(s => s.toLowerCase().includes(lowerSearch))
          );
      }
      return filtered;
  }, [categories, searchTerm, activeTab]);

  const incomeCats = filteredCategories.filter(c => c.type === 'INCOME');
  const expenseCats = filteredCategories.filter(c => c.type === 'EXPENSE');

  const bgClass = darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm';
  const textClass = darkMode ? 'text-white' : 'text-gray-800';
  const subTextClass = darkMode ? 'text-gray-400' : 'text-gray-600';
  const inputBg = darkMode ? 'bg-black border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900';

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
           <div>
               <h1 className={`text-3xl font-bold mb-2 ${textClass}`}>Categorias e Orçamentos</h1>
               <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Organize transações e defina tetos de gastos.</p>
           </div>
           
           {/* SEARCH BAR */}
           <div className="relative w-full md:w-64">
               <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
               <input 
                 type="text"
                 placeholder="Buscar categoria..." aria-label="Buscar categoria..."
                 className={`w-full pl-9 pr-4 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none ${inputBg}`}
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
           </div>
       </div>

       {/* TABS (PF/PJ) */}
       <div className="flex p-1 rounded-xl bg-gray-100 dark:bg-slate-800 w-full md:w-fit dark:text-slate-100">
            <button 
                onClick={() => setActiveTab('PF')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'PF' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500'}`}
            >
                <User size={16}/> Pessoal
            </button>
            <button 
                onClick={() => setActiveTab('PJ')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'PJ' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500'}`}
            >
                <Building2 size={16}/> Empresarial
            </button>
       </div>

       {/* Add Form */}
       <div className={`${bgClass} border p-4 rounded-xl flex flex-col md:flex-row gap-4 items-end animate-in fade-in slide-in-from-top-2`}>
           <div className="flex-1 w-full">
               <label className={`text-xs mb-1 block ${subTextClass} font-bold`}>
                   Nova Categoria ({activeTab === 'PF' ? 'Pessoal' : 'Empresarial'})
               </label>
               <input 
                 className={`w-full border rounded p-2 ${inputBg}`}
                 placeholder={activeTab === 'PF' ? "Ex: Lazer" : "Ex: Escritório"}
                 value={newCatName}
                 onChange={e => setNewCatName(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleAdd()}
               />
           </div>
           <div className="w-full md:w-auto">
                <label className={`text-xs mb-1 block ${subTextClass} font-bold`}>Tipo</label>
                <div className={`flex rounded p-1 border ${darkMode ? 'bg-black border-slate-700' : 'bg-gray-100 border-gray-200'}`}>
                    <button 
                        onClick={() => setNewCatType('INCOME')}
                        className={`px-3 py-1 text-sm rounded ${newCatType === 'INCOME' ? 'bg-emerald-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
                    >Entrada</button>
                    <button 
                        onClick={() => setNewCatType('EXPENSE')}
                        className={`px-3 py-1 text-sm rounded ${newCatType === 'EXPENSE' ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
                    >Saída</button>
                </div>
           </div>
           <button onClick={handleAdd} className="bg-blue-600 text-white p-2 rounded h-10 w-full md:w-10 flex items-center justify-center hover:bg-blue-700 shadow-md" aria-label="Adicionar" title="Adicionar">
               <Plus size={20} />
           </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* INCOME */}
           <div className={`rounded-xl p-6 border ${darkMode ? 'bg-gradient-to-br from-emerald-900/20 to-black border-emerald-500/20' : 'bg-white border-emerald-100 shadow-md'}`}>
               <h2 className="text-xl font-bold text-emerald-500 mb-4 flex items-center gap-2"><Tag size={20}/> Entradas ({activeTab})</h2>
               <div className="space-y-3">
                   {incomeCats.map(c => (
                       <div key={c.id} className={`rounded border overflow-hidden ${darkMode ? 'bg-slate-900/50 border-emerald-500/10' : 'bg-emerald-50 border-emerald-200'}`}>
                           <div className="flex justify-between items-center p-3">
                               <span className={`${textClass} font-medium`}>{c.name}</span>
                               <div className="flex gap-2">
                                   <button 
                                     onClick={() => setExpandedCatId(expandedCatId === c.id ? null : c.id)}
                                     className={`text-xs px-2 py-1 rounded border ${darkMode ? 'border-slate-600 hover:bg-slate-700' : 'border-emerald-300 hover:bg-emerald-200'} transition-colors`}
                                   >
                                       {expandedCatId === c.id ? 'Fechar' : 'Subcategorias'}
                                   </button>
                                   <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                               </div>
                           </div>
                           
                           {/* Subcategories Panel */}
                           {expandedCatId === c.id && (
                               <div className={`p-3 border-t text-sm ${darkMode ? 'bg-black/30 border-slate-700' : 'bg-white/50 border-emerald-200'}`}>
                                   <div className="flex flex-wrap gap-2 mb-3">
                                       {c.subcategories?.map(sub => (
                                           <span key={sub} className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-white border border-gray-200 text-gray-700'}`}>
                                               {sub}
                                               <button onClick={() => handleRemoveSubcategory(c.id, sub)} className="hover:text-red-500"><X size={12}/></button>
                                           </span>
                                       ))}
                                   </div>
                                   <div className="flex gap-2">
                                       <input 
                                         className={`flex-1 text-xs p-1 rounded border ${darkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-gray-300'}`}
                                         placeholder="Nova subcategoria..." aria-label="Nova subcategoria..."
                                         value={newSubName}
                                         onChange={e => setNewSubName(e.target.value)}
                                         onKeyDown={e => e.key === 'Enter' && handleAddSubcategory(c.id)}
                                       />
                                       <button onClick={() => handleAddSubcategory(c.id)} className="bg-emerald-600 text-white px-2 rounded text-xs"><Plus size={14}/></button>
                                   </div>
                               </div>
                           )}
                       </div>
                   ))}
                   {incomeCats.length === 0 && <p className="text-gray-500 italic text-sm">Nenhuma categoria encontrada.</p>}
               </div>
           </div>

           {/* EXPENSE */}
           <div className={`rounded-xl p-6 border ${darkMode ? 'bg-gradient-to-br from-red-900/20 to-black border-red-500/20' : 'bg-white border-red-100 shadow-md'}`}>
               <h2 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2"><Tag size={20}/> Saídas e Orçamentos ({activeTab})</h2>
               <div className="space-y-3">
                   {expenseCats.map(c => (
                       <div key={c.id} className={`rounded border overflow-hidden ${darkMode ? 'bg-slate-900/50 border-red-500/10' : 'bg-red-50 border-red-200'}`}>
                           <div className="flex justify-between items-center p-3">
                               <div>
                                   <span className={`${textClass} font-medium`}>{c.name}</span>
                                   <div className="flex items-center gap-1 mt-1 text-xs">
                                       {editingBudget?.id === c.id ? (
                                           <div className="flex items-center gap-1">
                                               <span>Max: R$</span>
                                               <input 
                                                    autoFocus
                                                    className={`w-16 p-0.5 rounded border ${inputBg}`}
                                                    value={editingBudget.value}
                                                    onChange={e => setEditingBudget({...editingBudget, value: e.target.value})}
                                                    onKeyDown={e => e.key === 'Enter' && handleSaveBudget()}
                                                    onBlur={handleSaveBudget}
                                               />
                                           </div>
                                       ) : (
                                           <button onClick={() => setEditingBudget({id: c.id, value: c.monthlyBudget?.toString() || ''})} className="flex items-center gap-1 text-gray-500 hover:text-blue-500 border border-transparent hover:border-blue-500/30 px-1 rounded transition-colors">
                                               <Tag size={12}/> 
                                               {c.monthlyBudget ? `Teto: R$ ${c.monthlyBudget}` : 'Definir Orçamento'}
                                           </button>
                                       )}
                                   </div>
                               </div>
                               <div className="flex gap-2">
                                   <button 
                                     onClick={() => setExpandedCatId(expandedCatId === c.id ? null : c.id)}
                                     className={`text-xs px-2 py-1 rounded border ${darkMode ? 'border-slate-600 hover:bg-slate-700' : 'border-red-300 hover:bg-red-200'} transition-colors`}
                                   >
                                       {expandedCatId === c.id ? 'Fechar' : 'Subs'}
                                   </button>
                                   <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                               </div>
                           </div>

                           {/* Subcategories Panel */}
                           {expandedCatId === c.id && (
                               <div className={`p-3 border-t text-sm ${darkMode ? 'bg-black/30 border-slate-700' : 'bg-white/50 border-red-200'}`}>
                                   <div className="flex flex-wrap gap-2 mb-3">
                                       {c.subcategories?.map(sub => (
                                           <span key={sub} className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-white border border-gray-200 text-gray-700'}`}>
                                               {sub}
                                               <button onClick={() => handleRemoveSubcategory(c.id, sub)} className="hover:text-red-500"><X size={12}/></button>
                                           </span>
                                       ))}
                                   </div>
                                   <div className="flex gap-2">
                                       <input 
                                         className={`flex-1 text-xs p-1 rounded border ${darkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-gray-300'}`}
                                         placeholder="Nova subcategoria..." aria-label="Nova subcategoria..."
                                         value={newSubName}
                                         onChange={e => setNewSubName(e.target.value)}
                                         onKeyDown={e => e.key === 'Enter' && handleAddSubcategory(c.id)}
                                       />
                                       <button onClick={() => handleAddSubcategory(c.id)} className="bg-red-600 text-white px-2 rounded text-xs"><Plus size={14}/></button>
                                   </div>
                               </div>
                           )}
                       </div>
                   ))}
                    {expenseCats.length === 0 && <p className="text-gray-500 italic text-sm">Nenhuma categoria encontrada.</p>}
               </div>
           </div>
       </div>
    </div>
  );
};

export default FinanceCategories;
