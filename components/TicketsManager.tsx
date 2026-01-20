import React, { useEffect, useMemo, useState } from 'react';
import { Ticket, TicketPriority, TicketStatus, User } from '../types';
import { getTickets, updateTicketAssignee, updateTicketStatus } from '../services/tickets';
import { listUsers } from '../services/auth';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, UserCheck } from 'lucide-react';

interface TicketsManagerProps {
    currentUser: User;
    darkMode: boolean;
    isAdmin: boolean;
}

const statusLabels: Record<TicketStatus, string> = {
    OPEN: 'Aberto',
    IN_PROGRESS: 'Em andamento',
    CLOSED: 'Fechado'
};

const priorityLabels: Record<TicketPriority, string> = {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    URGENT: 'Crítica'
};

const TicketsManager: React.FC<TicketsManagerProps> = ({ currentUser, darkMode, isAdmin }) => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'ALL' | TicketStatus>('ALL');
    const [priorityFilter, setPriorityFilter] = useState<'ALL' | TicketPriority>('ALL');
    const [sortBy, setSortBy] = useState<'DATE' | 'PRIORITY'>('DATE');
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
    const [showList, setShowList] = useState(true);

    useEffect(() => {
        refreshTickets();
    }, []);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isAdmin) {
            listUsers().then(setUsers).catch(() => setUsers([]));
        }
    }, [isAdmin]);

    const refreshTickets = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const data = await getTickets();
            setTickets(data);
            if (!selectedTicketId && data.length > 0) {
                setSelectedTicketId(data[0].id);
                setShowList(false);
            }
        } catch (error) {
            console.error('[Tickets] Falha ao carregar tickets', error);
            setErrorMessage('Não foi possível carregar os tickets. Tente novamente.');
        } finally {
            setIsLoading(false);
            setHasLoaded(true);
        }
    };

    const filteredTickets = useMemo(() => {
        const filtered = tickets.filter(ticket => {
            if (statusFilter !== 'ALL' && ticket.status !== statusFilter) return false;
            if (priorityFilter !== 'ALL' && ticket.priority !== priorityFilter) return false;
            if (search.trim()) {
                const term = search.toLowerCase();
                return (
                    ticket.title.toLowerCase().includes(term) ||
                    ticket.description.toLowerCase().includes(term) ||
                    ticket.module.toLowerCase().includes(term) ||
                    ticket.createdByName.toLowerCase().includes(term)
                );
            }
            return true;
        });

        const priorityRank: Record<TicketPriority, number> = {
            URGENT: 4,
            HIGH: 3,
            MEDIUM: 2,
            LOW: 1
        };

        return filtered.sort((a, b) => {
            if (sortBy === 'PRIORITY') {
                const diff = priorityRank[b.priority] - priorityRank[a.priority];
                if (diff !== 0) return diff;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [tickets, statusFilter, priorityFilter, search, sortBy]);

    const selectedTicket = filteredTickets.find(t => t.id === selectedTicketId) || tickets.find(t => t.id === selectedTicketId) || null;
    const mobileCanClose = isMobile && selectedTicket && selectedTicket.status !== 'CLOSED';

    const handleAssign = async (assigneeId?: string) => {
        if (!selectedTicket) return;
        const user = users.find(u => u.id === assigneeId) || (assigneeId === currentUser.id ? currentUser : undefined);
        await updateTicketAssignee(selectedTicket.id, assigneeId, user?.name);
        await refreshTickets();
    };

    const handleStatusChange = async (status: TicketStatus) => {
        if (!selectedTicket) return;
        await updateTicketStatus(selectedTicket.id, status);
        await refreshTickets();
    };

    const themeCard = darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200 text-gray-900';
    const mutedText = darkMode ? 'text-slate-400' : 'text-gray-500';

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight">Gestão de Tickets</h2>
                    <p className={`text-sm ${mutedText}`}>Centralize tickets, atribuições e resoluções do time.</p>
                </div>
                <button
                    onClick={refreshTickets}
                    className={`flex items-center gap-2 px-4 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-lg ${isLoading ? 'opacity-80' : ''}`}
                    disabled={isLoading}
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    {isLoading ? 'Atualizando...' : 'Atualizar'}
                </button>
            </div>

            <div className={`p-5 rounded-3xl border ${themeCard}`}>
                <div className="flex flex-col lg:flex-row gap-4">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por módulo, título ou autor"
                        className={`flex-1 px-4 py-3 rounded-2xl border ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-gray-50 border-gray-200'}`}
                    />
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className={`px-4 py-3 rounded-2xl border font-bold ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-gray-50 border-gray-200'}`}
                    >
                        <option value="ALL">Todos os status</option>
                        <option value="OPEN">Aberto</option>
                        <option value="IN_PROGRESS">Em andamento</option>
                        <option value="CLOSED">Fechado</option>
                    </select>
                    <select
                        value={priorityFilter}
                        onChange={e => setPriorityFilter(e.target.value as any)}
                        className={`px-4 py-3 rounded-2xl border font-bold ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-gray-50 border-gray-200'}`}
                    >
                        <option value="ALL">Todas prioridades</option>
                        <option value="LOW">Baixa</option>
                        <option value="MEDIUM">Média</option>
                        <option value="HIGH">Alta</option>
                        <option value="URGENT">Crítica</option>
                    </select>
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as any)}
                        className={`px-4 py-3 rounded-2xl border font-bold ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-gray-50 border-gray-200'}`}
                    >
                        <option value="DATE">Ordenar por data</option>
                        <option value="PRIORITY">Ordenar por prioridade</option>
                    </select>
                </div>
            </div>

            <div className={`grid grid-cols-1 xl:grid-cols-3 gap-6 ${isMobile ? 'min-h-[60vh]' : ''}`}>
                <div className={`xl:col-span-1 border rounded-3xl ${themeCard} overflow-hidden ${isMobile && !showList ? 'hidden' : ''}`}>
                    <div className="p-4 border-b border-slate-800/40">
                        <h3 className="text-sm font-black uppercase tracking-widest">Tickets</h3>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto">
                        {isLoading ? (
                            <div className="p-6 flex items-center justify-center gap-2 text-sm text-gray-500">
                                <RefreshCw size={16} className="animate-spin" />
                                Carregando tickets...
                            </div>
                        ) : errorMessage ? (
                            <div className="p-6 text-center text-sm text-rose-500">{errorMessage}</div>
                        ) : !hasLoaded ? (
                            <div className="p-6 flex items-center justify-center gap-2 text-sm text-gray-500">
                                <RefreshCw size={16} className="animate-spin" />
                                Carregando tickets...
                            </div>
                        ) : filteredTickets.length === 0 ? (
                            <div className="p-6 text-center text-sm text-gray-500">Nenhum ticket encontrado.</div>
                        ) : (
                            filteredTickets.map(ticket => (
                                <button
                                    key={ticket.id}
                                    onClick={() => {
                                        setSelectedTicketId(ticket.id);
                                        if (isMobile) setShowList(false);
                                    }}
                                    className={`w-full text-left px-5 py-4 border-b border-slate-800/30 transition-colors ${selectedTicketId === ticket.id ? 'bg-indigo-500/10' : ''}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase tracking-widest text-indigo-400">{ticket.module}</span>
                                        <span className="text-[10px] font-black uppercase text-gray-400">{priorityLabels[ticket.priority]}</span>
                                    </div>
                                    <p className="mt-2 font-bold text-sm line-clamp-1">{ticket.title}</p>
                                    <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase text-gray-400">
                                        <span>{statusLabels[ticket.status]}</span>
                                        <span>•</span>
                                        <span>{ticket.createdByName}</span>
                                    </div>
                                    <div className="mt-1 text-[10px] text-gray-400">
                                        {new Date(ticket.createdAt).toLocaleString()}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className={`xl:col-span-2 border rounded-3xl ${themeCard} p-6 space-y-6 ${isMobile && showList ? 'hidden' : ''}`}>
                    {errorMessage ? (
                        <div className="text-center text-sm text-rose-500">{errorMessage}</div>
                    ) : !selectedTicket ? (
                        <div className="text-center text-sm text-gray-500">
                            {hasLoaded ? 'Selecione um ticket para ver detalhes.' : 'Carregando detalhes...'}
                        </div>
                    ) : (
                        <>
                            {isMobile && (
                                <button
                                    onClick={() => setShowList(true)}
                                    className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-500"
                                >
                                    Voltar para lista
                                </button>
                            )}
                            <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-black uppercase">{statusLabels[selectedTicket.status]}</span>
                                    <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-black uppercase">{priorityLabels[selectedTicket.priority]}</span>
                                    <span className={`text-xs ${mutedText}`}>Criado em {new Date(selectedTicket.createdAt).toLocaleString()}</span>
                                </div>
                                <h3 className="text-2xl font-black">{selectedTicket.title}</h3>
                                <p className={`${mutedText} text-sm leading-relaxed`}>{selectedTicket.description}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className={`p-4 rounded-2xl border ${darkMode ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-gray-50'}`}>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Responsável</p>
                                    <p className="mt-2 font-bold">{selectedTicket.assigneeName || 'Não atribuído'}</p>
                                    {isAdmin && (
                                        <select
                                            value={selectedTicket.assigneeId || ''}
                                            onChange={e => handleAssign(e.target.value || undefined)}
                                            className={`mt-3 w-full px-3 py-2 rounded-xl border text-xs font-bold ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-gray-200'}`}
                                        >
                                            <option value="">Sem responsável</option>
                                            {users.map(user => (
                                                <option key={user.id} value={user.id}>{user.name}</option>
                                            ))}
                                        </select>
                                    )}
                                    {!isAdmin && (
                                        <button
                                            onClick={() => handleAssign(currentUser.id)}
                                            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase"
                                        >
                                            <UserCheck size={14} /> Assumir
                                        </button>
                                    )}
                                </div>
                                <div className={`p-4 rounded-2xl border ${darkMode ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-gray-50'}`}>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ações</p>
                                    <div className="mt-3 flex flex-col gap-2">
                                        <button
                                            onClick={() => handleStatusChange('IN_PROGRESS')}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-500 text-xs font-black uppercase"
                                        >
                                            <Clock size={14} /> Em andamento
                                        </button>
                                        {selectedTicket.status !== 'CLOSED' ? (
                                            <button
                                                onClick={() => handleStatusChange('CLOSED')}
                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-xs font-black uppercase"
                                            >
                                                <CheckCircle2 size={14} /> Fechar ticket
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleStatusChange('OPEN')}
                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-black uppercase"
                                            >
                                                <AlertTriangle size={14} /> Reabrir ticket
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className={`p-4 rounded-2xl border ${darkMode ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-gray-50'}`}>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Logs anexados</p>
                                    {selectedTicket.logs && selectedTicket.logs.length > 0 ? (
                                        <ul className="mt-3 space-y-2 text-xs">
                                            {selectedTicket.logs.slice(0, 6).map(log => (
                                                <li key={log.timestamp} className="flex flex-col gap-1 border-b border-slate-800/40 pb-2">
                                                    <span className="font-bold">[{log.level}] {log.message}</span>
                                                    <span className={`${mutedText}`}>{new Date(log.timestamp).toLocaleString()}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className={`mt-2 text-xs ${mutedText}`}>Nenhum log anexado.</p>
                                    )}
                                </div>
                                <div className={`p-4 rounded-2xl border ${darkMode ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-gray-50'}`}>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Anexos</p>
                                    {selectedTicket.attachments && selectedTicket.attachments.length > 0 ? (
                                        <ul className="mt-3 space-y-2 text-xs">
                                            {selectedTicket.attachments.map(att => (
                                                <li key={att.id} className="flex items-center justify-between border-b border-slate-800/40 pb-2">
                                                    <a href={att.dataUrl} download={att.name} className="font-bold hover:underline">{att.name}</a>
                                                    <span className={`${mutedText}`}>{Math.ceil(att.size / 1024)}kb</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className={`mt-2 text-xs ${mutedText}`}>Nenhum anexo recebido.</p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {mobileCanClose && (
                <div className="fixed bottom-20 left-0 right-0 px-4 z-[120]">
                    <button
                        onClick={() => handleStatusChange('CLOSED')}
                        className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-lg"
                    >
                        Concluir Ticket
                    </button>
                </div>
            )}
        </div>
    );
};

export default TicketsManager;
