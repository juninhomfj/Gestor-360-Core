
import React, { useState, useEffect } from 'react';
import { User, ClientTransferRequest } from '../types';
import { getClientsSharedWithMe, getMySentTransferRequests } from '../services/clientSelectors';
import { approveClientTransfer, rejectClientTransfer, subscribeToClientTransferRequests } from '../services/clientTransferService';
import { ArrowRightLeft, Check, X, Clock, Loader2, Inbox, Send, AlertCircle } from 'lucide-react';

interface ClientTransferInboxProps {
    currentUser: User;
    darkMode: boolean;
}

const ClientTransferInbox: React.FC<ClientTransferInboxProps> = ({ currentUser, darkMode }) => {
    const [view, setView] = useState<'INCOMING' | 'OUTGOING'>('INCOMING');
    const [requests, setRequests] = useState<ClientTransferRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [lastPayloadCount, setLastPayloadCount] = useState<number | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        let unsubscribe: (() => void) | null = null;
        let timeoutId: number | null = null;
        const loadRequests = async () => {
            setLoading(true);
            setSyncError(null);
            try {
                if (view === 'INCOMING') {
                    const data = await getClientsSharedWithMe(currentUser.id);
                    if (active) {
                        setRequests(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                        setLastPayloadCount(data.length);
                    }
                    let initialized = false;
                    timeoutId = window.setTimeout(() => {
                        if (!initialized && active) {
                            const message = 'Não foi possível receber o payload do Firestore.';
                            console.warn('[ClientTransferInbox] Payload inexistente ou sem retorno do snapshot.');
                            setSyncError(message);
                            setLoading(false);
                        }
                    }, 8000);
                    unsubscribe = subscribeToClientTransferRequests(currentUser.id, (incoming) => {
                        if (!active) return;
                        setRequests(incoming.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                        setLastPayloadCount(incoming.length);
                        setSyncError(null);
                        if (!initialized) {
                            setLoading(false);
                            initialized = true;
                            if (timeoutId) window.clearTimeout(timeoutId);
                        }
                    });
                } else {
                    const data = await getMySentTransferRequests(currentUser.id);
                    if (active) {
                        setRequests(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                        setLastPayloadCount(data.length);
                        setLoading(false);
                    }
                }
            } catch (error) {
                if (active) {
                    const message = error instanceof Error ? error.message : 'Erro ao sincronizar transferências.';
                    setSyncError(message);
                    setLoading(false);
                }
            }
        };
        loadRequests();
        return () => {
            active = false;
            unsubscribe?.();
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [view, currentUser.id]);

    const handleAction = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
        setProcessingId(requestId);
        try {
            if (action === 'APPROVE') {
                await approveClientTransfer(requestId, currentUser.id);
            } else {
                await rejectClientTransfer(requestId, currentUser.id);
            }
            if (view === 'INCOMING') {
                setRequests(prev => prev.filter(req => req.id !== requestId));
            } else {
                const data = await getMySentTransferRequests(currentUser.id);
                setRequests(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            }
        } catch (e: any) {
            const message = e?.message || 'Erro ao atualizar solicitação.';
            setSyncError(message);
        } finally {
            setProcessingId(null);
        }
    };

    const textClass = darkMode ? 'text-white' : 'text-gray-900';
    const emptyStateLabel = view === 'INCOMING'
        ? 'Nenhuma solicitação pendente para você.'
        : 'Nenhuma solicitação pendente enviada por você.';
    const showDebugInfo = currentUser.role === 'DEV' || currentUser.permissions?.dev;
    const payloadStatusLabel = lastPayloadCount === 0 ? 'Payload vazio' : 'Payload recebido';

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b dark:border-slate-800 pb-4">
                <button 
                    onClick={() => setView('INCOMING')}
                    className={`text-sm font-bold flex items-center gap-2 transition-all ${view === 'INCOMING' ? 'text-indigo-500' : 'text-gray-400'}`}
                >
                    <Inbox size={16}/> Recebidos
                </button>
                <button 
                    onClick={() => setView('OUTGOING')}
                    className={`text-sm font-bold flex items-center gap-2 transition-all ${view === 'OUTGOING' ? 'text-indigo-500' : 'text-gray-400'}`}
                >
                    <Send size={16}/> Enviados
                </button>
            </div>
            {syncError && (
                <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${darkMode ? 'border-red-900/60 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    <AlertCircle size={14} />
                    <span>{syncError}</span>
                </div>
            )}

            {loading ? (
                <div className="py-20 text-center flex flex-col items-center">
                    <Loader2 className="animate-spin text-indigo-500 mb-2" size={32}/>
                    <p className="text-sm text-gray-500">Sincronizando com a Nuvem...</p>
                </div>
            ) : requests.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                    <div className="opacity-30">
                        <ArrowRightLeft size={48} className="mx-auto mb-2"/>
                        <p>{emptyStateLabel}</p>
                    </div>
                    <div className={`mx-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${darkMode ? 'bg-slate-800 text-slate-200' : 'bg-gray-100 text-gray-600'}`}>
                        <AlertCircle size={14}/>
                        {payloadStatusLabel}: nenhuma solicitação pendente.
                    </div>
                    {showDebugInfo && (
                        <div className={`mx-auto max-w-md rounded-lg border px-4 py-3 text-xs ${darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                            <p className="font-semibold">Debug (DEV)</p>
                            <p>Filtro ativo: {view === 'INCOMING' ? 'toUserId' : 'fromUserId'} = {currentUser.id}</p>
                            <p>Coleção/Store: client_transfer_requests (Firestore + IndexedDB)</p>
                            <p>Payload recebido: {lastPayloadCount ?? 0}</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map(req => (
                        <div key={req.id} className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-black ${textClass}`}>Solicitação de Transferência</span>
                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase">PENDENTE</span>
                                </div>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock size={12}/> Enviado em {new Date(req.createdAt).toLocaleDateString()}
                                </p>
                                {req.message && (
                                    <div className="mt-2 text-sm italic text-gray-500 dark:text-gray-400 bg-white/5 p-2 rounded border dark:border-white/5">
                                        "{req.message}"
                                    </div>
                                )}
                            </div>

                            {view === 'INCOMING' && (
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button 
                                        onClick={() => handleAction(req.id, 'REJECT')}
                                        disabled={!!processingId}
                                        className="flex-1 sm:flex-none px-4 py-2 bg-red-100 text-red-600 rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-200 transition-colors"
                                    >
                                        <X size={14}/> Rejeitar
                                    </button>
                                    <button 
                                        onClick={() => handleAction(req.id, 'APPROVE')}
                                        disabled={!!processingId}
                                        className="flex-1 sm:flex-none px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:bg-emerald-700 transition-colors"
                                    >
                                        {processingId === req.id ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
                                        Aceitar Cliente
                                    </button>
                                </div>
                            )}

                            {view === 'OUTGOING' && (
                                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                                    <AlertCircle size={14}/>
                                    Aguardando decisão do destinatário.
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClientTransferInbox;
