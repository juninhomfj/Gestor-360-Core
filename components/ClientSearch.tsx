
import React, { useState, useEffect } from 'react';
import { User, ClientTransferRequest, Client } from '../types';
import { searchClientsByName, getMySentTransferRequests } from '../services/clientSelectors';
import { canUserRequestTransfer } from '../services/clientRules';
import { requestClientTransfer } from '../services/clientTransferService';
import { Search, ArrowRightLeft, Lock, Loader2, CheckCircle } from 'lucide-react';

interface ClientSearchProps {
    currentUser: User;
    darkMode: boolean;
}

// Tipo parcial retornado pela busca segura
type SearchResult = Pick<Client, 'id' | 'name' | 'userId'>;

const ClientSearch: React.FC<ClientSearchProps> = ({ currentUser, darkMode }) => {
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [myRequests, setMyRequests] = useState<ClientTransferRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        // Carrega solicitações pendentes para validar regras de UI
        loadRequests();
    }, []);

    const loadRequests = async () => {
        const reqs = await getMySentTransferRequests(currentUser.id);
        setMyRequests(reqs);
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!term.trim()) return;
        
        setLoading(true);
        try {
            const data = await searchClientsByName(term, currentUser.id);
            setResults(data);
        } catch (error) {
            console.error("Erro na busca", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestTransfer = async (client: SearchResult) => {
        if (!confirm(`Solicitar transferência do cliente "${client.name}" para sua carteira?`)) return;

        setProcessingId(client.id);
        try {
            await requestClientTransfer(
                client.id, 
                client.userId, // Dono atual (Origem)
                currentUser.id, // Eu (Destino)
                "Solicitação via Busca Global"
            );
            alert("Solicitação enviada com sucesso!");
            await loadRequests(); // Atualiza estado local para refletir bloqueio do botão
        } catch (error: any) {
            alert("Erro ao solicitar: " + error.message);
        } finally {
            setProcessingId(null);
        }
    };

    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900';
    const resultClass = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200';

    return (
        <div className={`mt-8 p-6 rounded-xl border ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-white'}`}>
            <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'} flex items-center gap-2`}>
                <Search className="text-blue-500" size={20}/> Buscar na Base Global
            </h3>

            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <input 
                    type="text" 
                    className={`flex-1 p-3 rounded-lg border outline-none ${inputClass}`}
                    placeholder="Digite o nome do cliente..." aria-label="Digite o nome do cliente..."
                    value={term}
                    onChange={e = /> setTerm(e.target.value)}
                />
                <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? <Loader2 size={18} className="animate-spin"/> : <Search size={18}/>}
                    Buscar
                </button>
            </form>

            <div className="space-y-2">
                {results.map(client => {
                    // Simula objeto Client completo apenas com os campos necessários para a regra
                    const clientObjForCheck = { ...client } as Client; 
                    const canRequest = canUserRequestTransfer(clientObjForCheck, currentUser.id, myRequests);
                    const isPending = myRequests.some(r => r.clientId === client.id && r.status === 'PENDING');

                    return (
                        <div key={client.id} className={`p-4 rounded-lg border flex items-center justify-between ${resultClass}`}>
                            <div>
                                <p className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{client.name}</p>
                                <p className="text-xs opacity-50 flex items-center gap-1">
                                    <Lock size={10}/> Pertence a outro usuário
                                </p>
                            </div>
                            
                            <div>
                                {isPending ? (
                                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 rounded-full">
                                        <Loader2 size={12} className="animate-spin"/> Aguardando Aprovação
                                    </span>
                                ) : canRequest ? (
                                    <button 
                                        onClick={() => handleRequestTransfer(client)}
                                        disabled={processingId === client.id}
                                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {processingId === client.id ? <Loader2 size={12} className="animate-spin"/> : <ArrowRightLeft size={12}/>}
                                        Solicitar Transferência
                                    </button>
                                ) : (
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <CheckCircle size={12}/> Indisponível
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
                
                {results.length === 0 && !loading && term && (
                    <p className="text-center text-sm opacity-50 py-4">Nenhum cliente encontrado na base global.</p>
                )}
            </div>
        </div>
    );
};

export default ClientSearch;
