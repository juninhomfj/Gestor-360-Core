
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getPossibleDuplicates, ClientDuplicateSuggestion } from '../services/clientMergeSelectors';
import ClientMergeModal from './ClientMergeModal';
import { GitMerge, RefreshCw, AlertCircle, Check } from 'lucide-react';

interface ClientMergeListProps {
    currentUser: User;
    darkMode: boolean;
}

const ClientMergeList: React.FC<ClientMergeListProps> = ({ currentUser, darkMode }) => {
    const [suggestions, setSuggestions] = useState<ClientDuplicateSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeSuggestion, setActiveSuggestion] = useState<ClientDuplicateSuggestion | null>(null);

    const loadSuggestions = async () => {
        setLoading(true);
        // Pequeno delay para não travar a UI na montagem inicial se tiver muitos clientes
        setTimeout(async () => {
            try {
                const data = await getPossibleDuplicates(currentUser.id);
                setSuggestions(data);
            } finally {
                setLoading(false);
            }
        }, 500);
    };

    useEffect(() => {
        loadSuggestions();
    }, [currentUser.id]);

    const handleSuccess = () => {
        setActiveSuggestion(null);
        loadSuggestions(); // Recarrega para remover o grupo processado
    };

    const bgClass = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200';
    const textClass = darkMode ? 'text-white' : 'text-gray-800';

    return (
        <div className={`space-y-4 rounded-xl border p-4 ${bgClass}`}>
            
            {activeSuggestion && (
                <ClientMergeModal 
                    isOpen={true}
                    onClose={() => setActiveSuggestion(null)}
                    onSuccess={handleSuccess}
                    masterCandidate={activeSuggestion.masterCandidate}
                    duplicates={activeSuggestion.possibles}
                    currentUser={currentUser}
                    darkMode={darkMode}
                />
            )}

            <div className="flex justify-between items-center">
                <h3 className={`font-bold flex items-center gap-2 ${textClass}`}>
                    <GitMerge className="text-purple-500" size={20} />
                    Sugestões de Unificação
                </h3>
                <button 
                    onClick={loadSuggestions}
                    disabled={loading}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    title="Recalcular duplicatas"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin text-purple-500' : 'text-gray-500'} />
                </button>
            </div>

            {loading ? (
                <div className="py-8 text-center text-gray-500 text-sm animate-pulse">
                    Analisando base de clientes...
                </div>
            ) : suggestions.length === 0 ? (
                <div className="py-6 text-center">
                    <div className="inline-flex p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 mb-2">
                        <Check size={24}/>
                    </div>
                    <p className={`text-sm ${textClass}`}>Nenhuma duplicidade encontrada.</p>
                    <p className="text-xs text-gray-500">Sua base de clientes está higienizada.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                        <AlertCircle size={16} className="shrink-0 mt-0.5"/>
                        <p>Encontramos {suggestions.length} grupos de clientes similares. Unifique-os para corrigir relatórios de vendas fragmentados.</p>
                    </div>

                    {suggestions.map(sug => (
                        <div key={sug.id} className={`p-4 rounded-lg border transition-all hover:shadow-md ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className={`font-bold text-sm ${textClass}`}>{sug.masterCandidate.name}</h4>
                                    <p className="text-xs text-gray-500">Possível duplicidade com:</p>
                                </div>
                                <button 
                                    onClick={() => setActiveSuggestion(sug)}
                                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    Revisar
                                </button>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                {sug.possibles.map(dup => (
                                    <span key={dup.id} className="px-2 py-1 rounded border text-xs bg-white dark:bg-slate-800 dark:border-slate-600 text-gray-600 dark:text-gray-300 flex items-center gap-1">
                                        {dup.name}
                                        <span className="text-[9px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-1 rounded">
                                            {sug.scoreMap[dup.id]}%
                                        </span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClientMergeList;
