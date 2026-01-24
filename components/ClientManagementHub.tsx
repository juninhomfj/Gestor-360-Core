
import React, { useState, useEffect } from 'react';
import { User, Client, ClientTransferRequest } from '../types';
import ClientList from './ClientList';
import ClientSearch from './ClientSearch';
import ClientTransferInbox from './ClientTransferInbox';
import ClientMergeList from './ClientMergeList';
import { Users, Search, ArrowRightLeft, GitMerge } from 'lucide-react';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import { getClientsSharedWithMe } from '../services/clientSelectors';
import { subscribeToClientTransferRequests } from '../services/clientTransferService';

interface ClientManagementHubProps {
    currentUser: User;
    darkMode: boolean;
}

const ClientManagementHub: React.FC<ClientManagementHubProps> = ({ currentUser, darkMode }) => {
    const [activeSubTab, setActiveSubTab] = useState<'MY_CLIENTS' | 'SEARCH' | 'TRANSFERS' | 'HYGIENE'>('MY_CLIENTS');
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        let active = true;
        const loadCounts = async () => {
            const incoming = await getClientsSharedWithMe(currentUser.id);
            if (active) setPendingCount(incoming.length);
        };
        loadCounts();
        const unsubscribe = subscribeToClientTransferRequests(currentUser.id, (requests) => {
            if (active) setPendingCount(requests.length);
        });
        return () => {
            active = false;
            unsubscribe();
        };
    }, [currentUser.id]);

    const tabs = [
        { id: 'MY_CLIENTS', label: 'Minha Carteira', icon: ShieldCheckIcon },
        { id: 'SEARCH', label: 'Busca Global', icon: Search },
        { id: 'TRANSFERS', label: 'Transferências', icon: ArrowRightLeft, count: pendingCount },
        { id: 'HYGIENE', label: 'Limpeza de Base', icon: GitMerge },
    ];

    const bgClass = darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-200';
    const textClass = darkMode ? 'text-white' : 'text-gray-900';

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 px-4 sm:px-0">
            <div className="flex flex-col gap-4">
                <div>
                    <h2 className={`text-2xl sm:text-3xl font-black flex items-center gap-2 ${textClass}`}>
                        <Users className="text-indigo-500 flex-shrink-0" /> <span>Inteligência de Clientes</span>
                    </h2>
                    <p className="text-sm text-gray-500">Gestão de propriedade e governança de dados.</p>
                </div>

                <div className="flex p-1 rounded-xl bg-gray-100 dark:bg-slate-800 w-full overflow-x-auto no-scrollbar dark:text-slate-100">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id as any)}
                            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg text-[9px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap touch-target ${activeSubTab === tab.id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            <tab.icon size={14} className="flex-shrink-0" />
                            <span className="hidden sm:inline">{tab.label}</span>
                            {tab.count ? (
                                <span className="bg-red-500 text-white text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                                    {tab.count}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>
            </div>

            <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border min-h-[400px] sm:min-h-[500px] ${bgClass}`}>
                {activeSubTab === 'MY_CLIENTS' && <ClientList currentUser={currentUser} darkMode={darkMode} />}
                {activeSubTab === 'SEARCH' && <ClientSearch currentUser={currentUser} darkMode={darkMode} />}
                {activeSubTab === 'TRANSFERS' && <ClientTransferInbox currentUser={currentUser} darkMode={darkMode} />}
                {activeSubTab === 'HYGIENE' && <ClientMergeList currentUser={currentUser} darkMode={darkMode} />}
            </div>
        </div>
    );
};

export default ClientManagementHub;