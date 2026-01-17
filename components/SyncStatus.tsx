import React, { useEffect, useState } from 'react';
import { Cloud, Loader2, Database, WifiOff, Activity, Zap } from 'lucide-react';
import { getPendingSyncs } from '../storage/db';
import { auth } from '../services/firebase';
import { SessionTraffic, SystemPerformance } from '../services/logic';
import SyncDetailsModal from './SyncDetailsModal';

const SyncStatus: React.FC = () => {
    const [pendingCount, setPendingCount] = useState(0);
    const [status, setStatus] = useState<'LOCAL_SAVED' | 'SYNCING' | 'OFFLINE' | 'CLOUD_SAVED' | 'QUERYING'>('LOCAL_SAVED');
    const [latency, setLatency] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [lastTraffic, setLastTraffic] = useState(0);
    
    useEffect(() => {
        const check = async () => {
            const pending = await getPendingSyncs();
            setPendingCount(pending.length);

            const isOnline = navigator.onLine;
            const isCloudEnabled = !!auth.currentUser;
            
            // Monitora latência real se estiver online
            if (isOnline && isCloudEnabled) {
                const lat = await SystemPerformance.measureFirebase();
                setLatency(lat);
            }

            const currentTotal = SessionTraffic.reads + SessionTraffic.writes;
            if (currentTotal > lastTraffic) {
                setStatus('QUERYING');
                setLastTraffic(currentTotal);
                setTimeout(() => setStatus(isOnline && isCloudEnabled ? 'CLOUD_SAVED' : 'LOCAL_SAVED'), 800);
            } else if (pending.length > 0 && isOnline && isCloudEnabled) {
                setStatus('SYNCING');
            } else if (isOnline && isCloudEnabled) {
                setStatus('CLOUD_SAVED');
            } else if (!isOnline) {
                setStatus('OFFLINE');
            } else {
                setStatus('LOCAL_SAVED');
            }
        };

        const interval = setInterval(check, 5000); 
        check();
        return () => clearInterval(interval);
    }, [lastTraffic]);

    const getLatencyColor = () => {
        if (latency < 150) return 'text-emerald-500';
        if (latency < 400) return 'text-amber-500';
        return 'text-red-500';
    };

    const renderButton = () => {
        if (status === 'QUERYING') {
            return (
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-indigo-500 text-white rounded-xl text-[10px] font-black border border-indigo-400 animate-pulse transition-all">
                    <Activity size={14} className="animate-bounce" />
                    <span className="hidden sm:inline">CONSULTANDO...</span>
                </button>
            );
        }

        if (status === 'SYNCING') {
            return (
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-600 rounded-xl text-[10px] font-black border border-blue-200 animate-pulse transition-all">
                    <Loader2 size={14} className="animate-spin" />
                    <span>SINC {pendingCount}</span>
                </button>
            );
        }

        if (status === 'OFFLINE') {
            return (
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-600 rounded-xl text-[10px] font-black border border-red-200 transition-all">
                    <WifiOff size={14} />
                    <span>OFFLINE</span>
                </button>
            );
        }

        return (
            <button onClick={() => setIsModalOpen(true)} className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-black border shadow-sm transition-all ${status === 'CLOUD_SAVED' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                <div className="flex items-center gap-1.5">
                    <Cloud size={14} className={status === 'CLOUD_SAVED' ? 'fill-emerald-500' : ''} />
                    <span className="hidden sm:inline">{status === 'CLOUD_SAVED' ? 'CLOUD OK' : 'LOCAL OK'}</span>
                </div>
                {latency > 0 && (
                    <div className={`flex items-center gap-1 border-l pl-2 dark:border-white/10 ${getLatencyColor()}`}>
                        <Zap size={12} fill="currentColor"/>
                        <span>{latency}ms</span>
                    </div>
                )}
            </button>
        );
    };

    return (
        <>
            {renderButton()}
            <SyncDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
};

export default SyncStatus;
