
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Search, Terminal, Filter, Calendar, RefreshCw, AlertTriangle, Info, ShieldAlert, Download, User } from 'lucide-react';
import { LogEntry, LogLevel } from '../types';
import { exportReportToCSV, SessionTraffic } from '../services/logic';

interface AuditLogExplorerProps {
    darkMode: boolean;
}

const AuditLogExplorer: React.FC<AuditLogExplorerProps> = ({ darkMode }) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [recordLimit, setRecordLimit] = useState(100);

    useEffect(() => {
        loadLogs();
    }, [filterLevel, recordLimit]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            let q = query(collection(db, 'audit_log'), orderBy('timestamp', 'desc'), limit(recordLimit));
            
            if (filterLevel !== 'ALL') {
                q = query(collection(db, 'audit_log'), where('level', '==', filterLevel), orderBy('timestamp', 'desc'), limit(recordLimit));
            }

            const snap = await getDocs(q);
            SessionTraffic.trackRead(snap.size);
            const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as any));
            setLogs(data);
        } catch (e) {
            console.error("Erro ao carregar logs cloud:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        const data = logs.map(l => ({
            Data: new Date(l.timestamp).toLocaleString(),
            Nível: l.level,
            Usuário: l.userName || l.userId || 'Sistema',
            UID: l.userId || 'Sistema',
            Mensagem: l.message,
            Browser: l.userAgent.substring(0, 30) + '...'
        }));
        exportReportToCSV(data, `audit_log_global_${Date.now()}`);
    };

    const getLevelBadge = (level: LogLevel) => {
        switch(level) {
            case 'ERROR': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'CRASH': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 animate-pulse';
            case 'WARN': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        }
    };

    const filteredLogs = logs.filter(l => 
        l.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.userId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.userName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const bgClass = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200';

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className={`text-2xl font-black flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        <Terminal className="text-indigo-500" /> Explorador de Auditoria Global
                    </h2>
                    <p className="text-sm text-gray-500">Monitoramento transacional de infraestrutura cloud.</p>
                </div>
                <div className="flex w-full flex-wrap gap-2 md:w-auto">
                    <button onClick={handleExport} className="flex-1 p-3 bg-gray-100 dark:bg-slate-800 rounded-xl hover:bg-gray-200 transition-colors md:flex-none dark:text-slate-100">
                        <Download size={20}/>
                    </button>
                    <button onClick={loadLogs} className="flex-1 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors md:flex-none">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>
            </div>

            <div className={`p-6 rounded-3xl border ${bgClass} grid grid-cols-1 md:grid-cols-12 gap-4 items-end`}>
                <div className="md:col-span-5">
                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Pesquisar em Logs</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                        <input 
                            className={`w-full pl-10 pr-4 py-2 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`} 
                            placeholder="Mensagem ou UID..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                </div>
                <div className="md:col-span-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Nível</label>
                    <select 
                        className={`w-full p-2 rounded-xl border text-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50'}`}
                        value={filterLevel}
                        onChange={e => setFilterLevel(e.target.value as any)}
                    >
                        <option value="ALL">Todos os Níveis</option>
                        <option value="INFO">Informação</option>
                        <option value="WARN">Aviso</option>
                        <option value="ERROR">Erro</option>
                        <option value="CRASH">Crash Crítico</option>
                    </select>
                </div>
                <div className="md:col-span-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Quantidade de Registros</label>
                    <div className="flex flex-wrap gap-2">
                        {[100, 500, 1000].map(lim => (
                            <button 
                                key={lim}
                                onClick={() => setRecordLimit(lim)}
                                className={`flex-1 min-w-[90px] py-2 rounded-xl text-[10px] font-bold border transition-all ${recordLimit === lim ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-gray-500'}`}
                            >
                                {lim} DOCS
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className={`rounded-3xl border overflow-hidden ${bgClass} shadow-sm`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className={`text-[10px] font-black uppercase tracking-widest border-b ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-50 text-gray-500'}`}>
                            <tr>
                                <th className="p-5">Timestamp</th>
                                <th className="p-5">Nível</th>
                                <th className="p-5">Usuário</th>
                                <th className="p-5">UID</th>
                                <th className="p-5">Mensagem / Evento</th>
                                <th className="p-5 text-center">Data</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y font-mono text-[11px] ${darkMode ? 'divide-slate-700' : 'divide-gray-100'}`}>
                            {filteredLogs.map(log => (
                                <tr key={(log as any).id} className="hover:bg-indigo-500/5 transition-colors">
                                    <td className="p-5 text-gray-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                    <td className="p-5">
                                        <span className={`px-2 py-0.5 rounded font-black ${getLevelBadge(log.level)}`}>{log.level}</span>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 dark:text-slate-100">
                                                <User size={12}/>
                                            </div>
                                            <span className="truncate max-w-[120px]" title={log.userName || log.userId || 'System'}>{log.userName || 'SYSTEM'}</span>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span className="truncate max-w-[120px]" title={log.userId || 'System'}>{log.userId?.substring(0,8) || 'SYSTEM'}</span>
                                    </td>
                                    <td className="p-5 max-w-md">
                                        <p className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{log.message}</p>
                                        {log.details && <pre className="text-[9px] mt-1 opacity-50 truncate">{JSON.stringify(log.details)}</pre>}
                                    </td>
                                    <td className="p-5 text-center whitespace-nowrap">{new Date(log.timestamp).toLocaleDateString('pt-BR')}</td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center text-gray-500 italic">Nenhum evento encontrado para os filtros aplicados.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AuditLogExplorer;
