
import React, { useState, useMemo } from 'react';
import { Sale } from '../types';
import { findPotentialDuplicates } from '../services/logic';
import { AlertCircle, CheckCircle, Merge, Users, ArrowRight } from 'lucide-react';

interface ClientUnificationProps {
  sales: Sale[];
  onMergeClients: (master: string, duplicates: string[]) => void;
  darkMode?: boolean;
}

const ClientUnification: React.FC<ClientUnificationProps> = ({ sales, onMergeClients, darkMode }) => {
  // Memoize duplicates calculation to avoid running Levenshtein on every render
  const potentialDuplicates = useMemo(() => findPotentialDuplicates(sales), [sales]);
  const [resolvedGroups, setResolvedGroups] = useState<string[]>([]); // Track merged groups locally

  // Filter out groups already handled in this session
  const activeDuplicates = potentialDuplicates.filter(g => !resolvedGroups.includes(g.master));

  const handleMerge = (group: { master: string, similar: string[] }, chosenMaster: string) => {
      // The list of all names in this cluster
      const allNames = [group.master, ...group.similar];
      // The names to be replaced (everyone except the chosen master)
      const toReplace = allNames.filter(n => n !== chosenMaster);
      
      onMergeClients(chosenMaster, toReplace);
      setResolvedGroups([...resolvedGroups, group.master]);
  };

  const bgClass = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100';
  const textClass = darkMode ? 'text-white' : 'text-gray-800';
  const subTextClass = darkMode ? 'text-gray-400' : 'text-gray-500';

  if (activeDuplicates.length === 0) {
      return (
          <div className={`p-8 text-center rounded-xl border ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-green-50 border-green-100'}`}>
              <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500" />
              <h3 className={`font-bold ${textClass}`}>Tudo Limpo!</h3>
              <p className={`text-sm ${subTextClass}`}>Não encontramos nomes de clientes duplicados ou similares.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6">
        <div className={`p-4 rounded-xl border ${darkMode ? 'bg-indigo-900/20 border-indigo-800' : 'bg-indigo-50 border-indigo-100'}`}>
            <div className="flex items-start gap-3">
                <AlertCircle className="text-indigo-500 shrink-0 mt-1" />
                <div>
                    <h3 className={`font-bold text-indigo-600 dark:text-indigo-400`}>Higienização de Base</h3>
                    <p className={`text-sm ${darkMode ? 'text-indigo-200' : 'text-indigo-800'}`}>
                        Detectamos nomes de clientes muito parecidos. Isso geralmente acontece por erros de digitação (ex: "Silva LTDA" vs "Silva Ltda").
                        Unifique-os para melhorar seus relatórios.
                    </p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
            {activeDuplicates.map((group, idx) => (
                <div key={idx} className={`p-6 rounded-xl border shadow-sm ${bgClass}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <Users size={20} className="text-amber-500" />
                        <h4 className={`font-bold ${textClass}`}>Grupo #{idx + 1}</h4>
                    </div>
                    
                    <div className="space-y-4">
                        <p className={`text-sm ${subTextClass}`}>
                            Selecione qual é o <strong>nome correto</strong>. Todas as vendas dos outros nomes serão transferidas para ele.
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[group.master, ...group.similar].map(name => (
                                <button
                                    key={name}
                                    onClick={() => handleMerge(group, name)}
                                    className={`relative p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${darkMode ? 'border-slate-600 hover:border-emerald-500 hover:bg-slate-700' : 'border-gray-200 hover:border-emerald-500 hover:bg-emerald-50'}`}
                                >
                                    <span className={`block font-bold mb-1 ${textClass}`}>{name}</span>
                                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                                        <Merge size={12}/> Usar este nome
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

export default ClientUnification;
