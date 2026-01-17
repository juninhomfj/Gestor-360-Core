
import React, { useEffect, useMemo, useState } from 'react';
import { Client, User as AppUser } from '../types';
import { getMyClients } from '../services/clientSelectors';
import { handleSoftDelete, getClients } from '../services/logic';
import { listUsers } from '../services/auth';
import { User, Clock, Trash2, History, Loader2 } from 'lucide-react';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import ClientDetailsModal from './ClientDetailsModal';

interface ClientListProps {
    currentUser: { id: string };
    darkMode: boolean;
}

const ClientList: React.FC<ClientListProps> = ({ currentUser, darkMode }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [users, setUsers] = useState<AppUser[]>([]);

    useEffect(() => {
        loadClients();
    }, [currentUser.id]);

    useEffect(() => {
        listUsers().then(setUsers).catch(() => setUsers([]));
    }, []);

    const loadClients = async () => {
        setLoading(true);
        try {
            await getClients();
            const data = await getMyClients(currentUser.id);
            // Ordenação amigável para iOS/Safari
            setClients(data.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        } catch (error) {
            console.error("Erro ao carregar clientes", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClient = async (client: Client) => {
        if (!confirm(`Deseja mover o cliente "${client.name}" para a lixeira?`)) return;
        setLoading(true);
        try {
            await handleSoftDelete('clients', client.id);
            await loadClients();
        } catch (e) {
            alert("Erro ao excluir cliente.");
        } finally {
            setLoading(false);
        }
    };

    const cardClass = darkMode ? 'bg-slate-800 border-slate-700 hover:border-indigo-500/50' : 'bg-white border-gray-200 hover:border-indigo-500';
    const textClass = darkMode ? 'text-white' : 'text-gray-900';
    const ownerLookup = useMemo(() => new Map(users.map(user => [user.id, user.name])), [users]);
    const getOwnerName = (client: Client) => ownerLookup.get(client.userId) || 'Usuário desconhecido';

    if (loading && clients.length === 0) {
        return (
            <div className="p-20 text-center flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-indigo-500" size={32}/>
                <p className="text-xs font-black uppercase tracking-widest opacity-50">Sincronizando Carteira...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className={`text-lg font-bold flex items-center gap-2 ${textClass}`}>
                    <ShieldCheckIcon className="text-emerald-500" size={20}/> 
                    Minha Carteira ({clients.length})
                </h3>
            </div>
            
            {clients.length === 0 ? (
                <div className={`p-12 text-center rounded-[2rem] border-2 border-dashed ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}>
                    <User size={48} className="mx-auto mb-4 opacity-10"/>
                    <p className="text-sm font-bold opacity-50">Sua carteira de clientes está vazia.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clients.map(client => (
                        <div key={client.id} className={`p-5 rounded-3xl border transition-all group relative overflow-hidden ${cardClass}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className={`font-black text-lg ${textClass}`}>{client.name}</p>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mt-1 flex items-center gap-1">
                                        <Clock size={10}/> Ativo desde {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all">
                                    <button 
                                        onClick={() => setSelectedClient(client)}
                                        className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                                        title="Ver Histórico"
                                    >
                                        <History size={16}/>
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteClient(client)}
                                        className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all"
                                        title="Excluir"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t dark:border-slate-700 flex justify-between items-center">
                                <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">
                                    Proprietário: {getOwnerName(client)}
                                </span>
                                <button onClick={() => setSelectedClient(client)} className="text-[10px] font-black text-indigo-500 uppercase hover:underline">Ver LTV →</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedClient && (
                <ClientDetailsModal 
                    client={selectedClient} 
                    ownerName={getOwnerName(selectedClient)}
                    isOpen={!!selectedClient} 
                    onClose={() => setSelectedClient(null)} 
                    darkMode={darkMode}
                />
            )}
        </div>
    );
};

export default ClientList;