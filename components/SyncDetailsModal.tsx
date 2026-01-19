
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {X, RefreshCw, CheckCircle, Clock, Zap, Globe, Database, Loader2} from 'lucide-react';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import { getPendingSyncs } from '../storage/db';
import { SyncEntry } from '../types';
import { SystemPerformance, SessionTraffic } from '../services/logic';
import { checkBackendHealth } from '../services/healthService';

interface SyncDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SyncDetailsModal: React.FC<SyncDetailsModalProps> = ({ isOpen, onClose }) => {
    const [queue, setQueue] = useState<SyncEntry[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [backendHealth, setBackendHealth] = useState<'ONLINE' | 'OFFLINE' | 'CHECKING'>('CHECKING');
    
    const loadQueue = async () => {
        const pending = await getPendingSyncs();
        setQueue(pending);
    };

    const checkHealth = async () => {
        setBackendHealth('CHECKING');
        const ok = await checkBackendHealth();
        setBackendHealth(ok ? 'ONLINE' : 'OFFLINE');
    };

    useEffect(() => {
        if (isOpen) {
            loadQueue();
            checkHealth();
            const interval = setInterval(loadQueue, 5000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const handleForceSync = async () => {
        setIsSyncing(true);
        await SystemPerformance.measureFirebase();
        await checkHealth();
        await loadQueue();
        setTimeout(() => setIsSyncing(false), 1000);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh] dark:text-slate-100">
                
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-950 dark:text-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                            <ShieldCheckIcon size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-800 dark:text-white uppercase text-xs tracking-widest">Auditoria de Ecossistema</h3>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Integridade e Latência v2.9</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    {/* Monitor de Saúde */}
                    <div className="grid grid-cols-2 gap-4">
                        <HealthCard 
                            icon={<Zap size={16}/>} 
                            label="Google Firebase" 
                            status={SystemPerformance.firebaseLatency > 0 ? `${SystemPerformance.firebaseLatency}ms` : 'Offline'} 
                            color={SystemPerformance.firebaseLatency < 200 ? 'green' : 'amber'}
                        />
                        <HealthCard 
                            icon={<Globe size={16}/>} 
                            label="Backend (Ping)" 
                            status={backendHealth} 
                            color={backendHealth === 'ONLINE' ? 'green' : 'red'}
                        />
                    </div>

                    {/* Stats Card */}
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 dark:text-slate-100">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Database size={12}/> Tráfego da Sessão
                        </h4>
                        <div className="flex justify-between items-center text-sm font-bold">
                            <div className="text-center flex-1 border-r dark:border-slate-800">
                                <p className="text-emerald-500">{SessionTraffic.writes}</p>
                                <p className="text-[9px] text-gray-500 uppercase">Gravações Cloud</p>
                            </div>
                            <div className="text-center flex-1">
                                <p className="text-blue-500">{SessionTraffic.reads}</p>
                                <p className="text-[9px] text-gray-500 uppercase">Consultas Cloud</p>
                            </div>
                        </div>
                    </div>

                    {/* Queue List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            <span>Fila de Persistência ({queue.length})</span>
                            <span className="flex items-center gap-1"><Clock size={10}/> Sincronia Real-time</span>
                        </div>
                        {queue.length === 0 ? (
                            <div className="p-6 text-center rounded-2xl border border-dashed dark:border-slate-800">
                                <CheckCircle size={32} className="mx-auto text-emerald-500/20 mb-2" />
                                <p className="text-xs text-gray-500 font-bold uppercase">Nenhuma pendência na nuvem</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {queue.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 dark:text-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                            <span className="text-[10px] font-black uppercase text-gray-500">{item.table}</span>
                                        </div>
                                        <span className="text-[9px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded uppercase">Pendente</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 dark:text-slate-100">
                    <button 
                        onClick={handleForceSync}
                        disabled={isSyncing}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-900/20 disabled:opacity-70 active:scale-95"
                    >
                        {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16}/>}
                        Reavaliar Conectividade
                    </button>
                    <p className="text-[9px] text-center text-gray-400 mt-4 uppercase font-bold tracking-tighter opacity-50">Firebase Native Resilience Protocol Enabled</p>
                </div>

            </div>
        </div>,
        document.body
    );
};

const HealthCard = ({ icon, label, status, color }: any) => (
    <div className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${color === 'green' ? 'bg-emerald-500/5 border-emerald-500/20' : color === 'red' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        <div className={`p-2 rounded-lg ${color === 'green' ? 'text-emerald-500 bg-emerald-500/10' : color === 'red' ? 'text-red-500 bg-red-500/10' : 'text-amber-500 bg-amber-500/10'}`}>
            {icon}
        </div>
        <div className="overflow-hidden">
            <p className="text-[9px] font-black text-gray-500 uppercase truncate">{label}</p>
            <p className={`text-xs font-black uppercase truncate ${color === 'green' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : 'text-amber-600'}`}>{status}</p>
        </div>
    </div>
);

export default SyncDetailsModal;