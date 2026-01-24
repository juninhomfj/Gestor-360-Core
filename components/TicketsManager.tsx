import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ticket, TicketPriority, TicketStatus, User } from '../types';
import { getTickets, updateTicketAssignee, updateTicketStatus } from '../services/tickets';
import { listUsers } from '../services/auth';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, UserCheck, Copy, Sparkles, Loader2, Download } from 'lucide-react';
import { networkFetch } from '../services/networkControl';

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
    const [showLogDetails, setShowLogDetails] = useState(false);
    const [copyStatus, setCopyStatus] = useState<string | null>(null);
    const aiAbortRef = useRef<AbortController | null>(null);
    const [aiOutput, setAiOutput] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiCopyStatus, setAiCopyStatus] = useState<string | null>(null);

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
        } catch (error: any) {
            console.error('[Tickets] Falha ao carregar tickets', { code: error?.code, message: error?.message });
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
    const formatLogDetail = (details: any) => {
        if (!details) return '';
        if (typeof details === 'string') return details;
        try {
            return JSON.stringify(details, null, 2);
        } catch {
            return String(details);
        }
    };
    const getLogMeta = (details: any) => {
        if (!details || typeof details !== 'object') return '';
        const code = (details.code || details.status || details.error?.code || details.error?.status || details.name) as string | undefined;
        return code ? `Codigo: ${code}` : '';
    };
    const getAiSettings = () => {
        const envProvider = (import.meta as any).env?.VITE_AI_PROVIDER as string | undefined;
        const envLimit = Number((import.meta as any).env?.VITE_AI_DAILY_LIMIT || 20);
        try {
            const raw = localStorage.getItem('sys_ai_settings_v1');
            const parsed = raw ? JSON.parse(raw) : null;
            return {
                provider: (parsed?.provider || envProvider || 'OPENAI') as 'OPENAI' | 'GEMINI',
                apiKey: parsed?.apiKey as string | undefined,
                aiEnabled: typeof parsed?.aiEnabled === 'boolean' ? parsed.aiEnabled : true,
                dailyLimit: Number.isFinite(parsed?.aiDailyLimit) ? parsed.aiDailyLimit : envLimit
            };
        } catch {
            return { provider: (envProvider || 'OPENAI') as 'OPENAI' | 'GEMINI', apiKey: undefined, aiEnabled: true, dailyLimit: envLimit };
        }
    };
    const getApiKey = (provider: 'OPENAI' | 'GEMINI', settings: any) => {
        if (settings?.apiKey) return settings.apiKey;
        if (provider === 'OPENAI') return (import.meta as any).env?.VITE_OPENAI_API_KEY as string | undefined;
        return (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
    };
    const getUsageKey = () => `ai_usage_${currentUser.id || currentUser.uid}`;
    const canUseAi = (limit: number) => {
        const key = getUsageKey();
        const today = new Date().toISOString().slice(0, 10);
        try {
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : null;
            if (!parsed || parsed.date !== today) return { ok: true, count: 0, today };
            return { ok: parsed.count < limit, count: parsed.count, today };
        } catch {
            return { ok: true, count: 0, today };
        }
    };
    const bumpUsage = (today: string, count: number) => {
        const key = getUsageKey();
        localStorage.setItem(key, JSON.stringify({ date: today, count: count + 1 }));
    };
    const buildAiPrompt = (ticket: Ticket) => {
        const summary = {
            id: ticket.id,
            title: ticket.title,
            module: ticket.module,
            priority: ticket.priority,
            status: ticket.status,
            createdAt: ticket.createdAt,
            createdBy: ticket.createdByName,
            description: ticket.description
        };
        const logs = (ticket.logs || []).map((log) => ({
            timestamp: log.timestamp,
            level: log.level,
            message: log.message,
            details: log.details,
            userAgent: log.userAgent
        }));
        return `Analise o ticket e responda com:\nTL;DR: resumo em 1-2 linhas no topo.\n1) causa provavel\n2) passos de reproduzir\n3) sugestao tecnica de correcoes\n\nTicket:\n${JSON.stringify(summary, null, 2)}\n\nLogs:\n${JSON.stringify(logs, null, 2)}`;
    };
    const callOpenAi = async (apiKey: string, prompt: string, signal?: AbortSignal) => {
        const response = await networkFetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                max_tokens: 600
            })
        }, { lockKey: `openai:${currentUser.id}`, signal, timeoutMs: 15000 });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Falha ao chamar OpenAI');
        }
        const data = await response.json();
        return data?.choices?.[0]?.message?.content || 'Sem resposta.';
    };
    const callGemini = async (apiKey: string, prompt: string, signal?: AbortSignal) => {
        const response = await networkFetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
            })
        }, { lockKey: `gemini:${currentUser.id}`, signal, timeoutMs: 15000 });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Falha ao chamar Gemini');
        }
        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';
    };
    const handleAiDebug = async () => {
        if (!selectedTicket) return;
        setAiOutput(null);
        setAiError(null);
        const settings = getAiSettings();
        if (!settings.aiEnabled) {
            setAiError('IA desativada nas configuracoes.');
            return;
        }
        const apiKey = getApiKey(settings.provider, settings);
        if (!apiKey) {
            setAiError('Chave de IA nao configurada.');
            return;
        }
        const limit = Number(settings.dailyLimit || 20);
        const usage = canUseAi(limit);
        if (!usage.ok) {
            setAiError('Limite diario de IA atingido.');
            return;
        }
        const prompt = buildAiPrompt(selectedTicket);
        setAiLoading(true);
        aiAbortRef.current?.abort();
        const controller = new AbortController();
        aiAbortRef.current = controller;
        try {
            const text = settings.provider === 'GEMINI'
                ? await callGemini(apiKey, prompt, controller.signal)
                : await callOpenAi(apiKey, prompt, controller.signal);
            let normalized = (text || '').trim();
            if (!/^TL;DR:/i.test(normalized)) {
                const firstLine = normalized.split('\n').find((line) => line.trim()) || 'Resumo indisponivel.';
                const trimmed = firstLine.length > 200 ? `${firstLine.slice(0, 200)}...` : firstLine;
                normalized = `TL;DR: ${trimmed}\n\n${normalized}`;
            }
            const maxLen = 1200;
            if (normalized.length > maxLen) {
                normalized = `${normalized.slice(0, maxLen)}...\n\n(Resumo truncado para manter leitura facil)`;
            }
            setAiOutput(normalized);
            bumpUsage(usage.today, usage.count);
        } catch (err: any) {
            setAiError(err?.message || 'Falha ao consultar IA.');
        } finally {
            setAiLoading(false);
        }
    };
    useEffect(() => {
        return () => {
            aiAbortRef.current?.abort();
        };
    }, []);
    const handleCopyAi = async () => {
        if (!aiOutput || !selectedTicket) return;
        const payload = JSON.stringify({
            ticketId: selectedTicket.id,
            output: aiOutput
        }, null, 2);
        try {
            await navigator.clipboard.writeText(payload);
            setAiCopyStatus('Copiado!');
            setTimeout(() => setAiCopyStatus(null), 2000);
        } catch {
            setAiCopyStatus('Falha ao copiar.');
            setTimeout(() => setAiCopyStatus(null), 2000);
        }
    };
    const handleDownloadAi = () => {
        if (!aiOutput || !selectedTicket) return;
        const payload = JSON.stringify({
            ticketId: selectedTicket.id,
            output: aiOutput
        }, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ticket_ai_${selectedTicket.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    const buildLogExport = (ticket: Ticket) => {
        const payload = {
            id: ticket.id,
            title: ticket.title,
            module: ticket.module,
            priority: ticket.priority,
            status: ticket.status,
            createdBy: {
                id: ticket.createdById,
                name: ticket.createdByName,
                email: ticket.createdByEmail
            },
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
            closedAt: ticket.closedAt,
            description: ticket.description,
            logs: (ticket.logs || []).map((log) => ({
                timestamp: log.timestamp,
                level: log.level,
                message: log.message,
                details: log.details,
                userAgent: log.userAgent,
                userId: log.userId,
                userName: log.userName
            }))
        };
        return JSON.stringify(payload, null, 2);
    };
    const handleCopyLogs = async () => {
        if (!selectedTicket) return;
        const payload = buildLogExport(selectedTicket);
        try {
            await navigator.clipboard.writeText(payload);
            setCopyStatus('Copiado!');
            setTimeout(() => setCopyStatus(null), 2000);
        } catch {
            setCopyStatus('Falha ao copiar.');
            setTimeout(() => setCopyStatus(null), 2000);
        }
    };

    const handleAssign = async (assigneeId?: string) => {
        if (!selectedTicket) return;
        try {
            const user = users.find(u => u.id === assigneeId) || (assigneeId === currentUser.id ? currentUser : undefined);
            await updateTicketAssignee(selectedTicket.id, assigneeId, user?.name);
            await refreshTickets();
        } catch (error: any) {
            console.error('[Tickets] Falha ao atualizar responsável', { code: error?.code, message: error?.message });
            setErrorMessage('Não foi possível atualizar o responsável. Tente novamente.');
        }
    };

    const handleStatusChange = async (status: TicketStatus) => {
        if (!selectedTicket) return;
        try {
            await updateTicketStatus(selectedTicket.id, status);
            await refreshTickets();
        } catch (error: any) {
            console.error('[Tickets] Falha ao atualizar status', { code: error?.code, message: error?.message });
            setErrorMessage('Não foi possível atualizar o status. Tente novamente.');
        }
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
                                            className={`mt-3 w-full px-3 py-2 rounded-xl border text-xs font-bold ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-100 border-gray-300 text-gray-900'}`}
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
                                    {selectedTicket.logs && selectedTicket.logs.length > 0 && (
                                        <div className="mt-2 flex flex-wrap items-center gap-3">
                                            <button
                                                onClick={() => setShowLogDetails(!showLogDetails)}
                                                className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300"
                                            >
                                                {showLogDetails ? 'Ocultar detalhes' : 'Mostrar detalhes completos'}
                                            </button>
                                            <button
                                                onClick={handleCopyLogs}
                                                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300"
                                            >
                                                <Copy size={12} /> Copiar detalhes
                                            </button>
                                            {copyStatus && <span className="text-[10px] text-slate-400">{copyStatus}</span>}
                                        </div>
                                    )}
                                    {selectedTicket.logs && selectedTicket.logs.length > 0 ? (
                                        <ul className="mt-3 space-y-3 text-xs">
                                            {selectedTicket.logs.map(log => (
                                                <li key={log.timestamp} className="flex flex-col gap-1 border-b border-slate-800/40 pb-2">
                                                    <span className="font-bold">[{log.level}] {log.message}</span>
                                                    <span className={`${mutedText}`}>{new Date(log.timestamp).toLocaleString()}</span>
                                                    {getLogMeta(log.details) && (
                                                        <span className={`${mutedText}`}>{getLogMeta(log.details)}</span>
                                                    )}
                                                    {showLogDetails && (
                                                        <pre className="mt-2 p-2 rounded-lg bg-black/30 text-[10px] text-slate-200 whitespace-pre-wrap break-words">
                                                            {formatLogDetail({
                                                                details: log.details,
                                                                userAgent: log.userAgent,
                                                                userId: log.userId,
                                                                userName: log.userName
                                                            })}
                                                        </pre>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className={`mt-2 text-xs ${mutedText}`}>Nenhum log anexado.</p>
                                    )}
                                </div>
                                <div className={`p-4 rounded-2xl border ${darkMode ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-gray-50'}`}>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Depurar na IA</p>
                                    <p className={`mt-2 text-xs ${mutedText}`}>Gera um diagnostico com base no ticket e nos logs.</p>
                                    <button
                                        onClick={handleAiDebug}
                                        disabled={aiLoading}
                                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-60"
                                    >
                                        {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        Depurar na IA
                                    </button>
                                    {aiError && <p className="mt-3 text-[11px] text-rose-400 font-semibold">{aiError}</p>}
                                    {aiOutput && (
                                        <>
                                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                                <button
                                                    onClick={handleCopyAi}
                                                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300"
                                                >
                                                    <Copy size={12} /> Copiar IA
                                                </button>
                                                <button
                                                    onClick={handleDownloadAi}
                                                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300"
                                                >
                                                    <Download size={12} /> Baixar IA
                                                </button>
                                                {aiCopyStatus && <span className="text-[10px] text-slate-400">{aiCopyStatus}</span>}
                                            </div>
                                            <pre className="mt-2 p-3 rounded-xl bg-black/40 text-[11px] text-slate-200 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                                                {aiOutput}
                                            </pre>
                                        </>
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
