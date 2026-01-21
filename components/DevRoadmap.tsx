
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Code2, Terminal, Database, Server, Cpu, RefreshCw, 
    CheckCircle2, Cloud, Activity, 
    Shield, Download, FileJson, Copy, AlertTriangle, Trash2, ArrowUpRight, ArrowDownLeft, Eraser, Heart, Globe, AlertCircle
} from 'lucide-react';
import { db } from '../services/firebase';
import { Logger } from '../services/logger';
import { SessionTraffic } from '../services/logic';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { dbGetAll } from '../storage/db';
import { checkBackendHealth } from '../services/healthService';

const DevRoadmap: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CLOUD' | 'DATABASE' | 'LOGS' | 'ROADMAP'>('CLOUD');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [traffic, setTraffic] = useState({ reads: 0, writes: 0, last: 'Nunca' });
  const [workerStatus, setWorkerStatus] = useState<'ONLINE' | 'OFFLINE' | 'CHECKING'>('CHECKING');

  const [selectedStore, setSelectedStore] = useState('sales');
  const [tableData, setTableData] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [dbFilter, setDbFilter] = useState('');
  const [systemLogs, setSystemLogs] = useState<any[]>([]);

  const STORES = ['profiles', 'sales', 'sales_tasks', 'clients', 'config', 'accounts', 'transactions', 'sync_queue'];

  useEffect(() => {
    const interval = setInterval(() => {
        setTraffic({
            reads: SessionTraffic.reads,
            writes: SessionTraffic.writes,
            last: SessionTraffic.lastActivity ? SessionTraffic.lastActivity.toLocaleTimeString() : 'Nenhuma'
        });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
      if (activeTab === 'DATABASE') loadTable();
      if (activeTab === 'LOGS') loadLogs();
      if (activeTab === 'CLOUD') checkHealth();
  }, [selectedStore, activeTab]);

  const checkHealth = async () => {
      setWorkerStatus('CHECKING');
      const isOnline = await checkBackendHealth();
      setWorkerStatus(isOnline ? 'ONLINE' : 'OFFLINE');
  };

  const loadLogs = async () => {
      setIsRefreshing(true);
      const logs = await Logger.getLogs(100);
      setSystemLogs(logs);
      setIsRefreshing(false);
  };

  const handleSoftDeleteLogs = async () => {
      if (confirm("Arquivar logs locais e da nuvem? (soft delete)")) {
          await Logger.softDeleteLogsGlobal();
          await loadLogs();
      }
  };

  const loadTable = async () => {
      setIsRefreshing(true);
      try {
          const data = await dbGetAll(selectedStore as any);
          setTableData(data);
          setSelectedRow(null);
      } catch (e) {}
      setIsRefreshing(false);
  };

  const handleExportCSV = () => {
      if (!tableData.length) return;
      const headers = Object.keys(tableData[0]).join(',');
      const rows = tableData.map(row => Object.values(row).map(v => JSON.stringify(v)).join(',')).join('\n');
      const csv = `${headers}\n${rows}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `db_${selectedStore}.csv`);
      link.click();
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Copiado!");
  };

  const filteredData = useMemo(() => {
      if (!dbFilter) return tableData;
      const lower = dbFilter.toLowerCase();
      return tableData.filter(row => JSON.stringify(row).toLowerCase().includes(lower));
  }, [tableData, dbFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20 overflow-x-hidden">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-slate-300 relative overflow-hidden shadow-2xl">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <Cpu className="text-emerald-500 animate-pulse" /> Engenharia Root
                    </h2>
                    <p className="text-slate-400 mt-2 text-xs font-mono uppercase tracking-widest">Painel de Diagnostico & Auditoria</p>
                </div>
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black border border-emerald-500/30">v2.5.5 STABLE</span>
                </div>
            </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
            <TabBtn id="CLOUD" label="Nuvem & Saude" icon={<Cloud size={14}/>} active={activeTab} onClick={setActiveTab} />
            <TabBtn id="DATABASE" label="Tabelas Local" icon={<Database size={14}/>} active={activeTab} onClick={setActiveTab} />
            <TabBtn id="LOGS" label="Logs de Auditoria" icon={<Terminal size={14}/>} active={activeTab} onClick={setActiveTab} />
            <TabBtn id="ROADMAP" label="Versao" icon={<CheckCircle2 size={14}/>} active={activeTab} onClick={setActiveTab} />
        </div>

        {activeTab === 'CLOUD' && (
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-bottom-4">
                    <StatusCard icon={<Cloud/>} title="Status API" value="CONECTADO" sub="Firestore Direct" color="blue" />
                    <StatusCard icon={<ArrowDownLeft/>} title="Reads (Sessao)" value={traffic.reads} sub={`Last: ${traffic.last}`} color="emerald" />
                    <StatusCard icon={<ArrowUpRight/>} title="Writes (Sessao)" value={traffic.writes} sub="Atomic Sync" color="amber" />
                    <StatusCard icon={<Shield/>} title="Seguranca" value="App Check" sub="ReCaptcha Active" color="purple" />
                </div>

                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
                    <h3 className="text-sm font-black uppercase text-slate-400 mb-6 flex items-center gap-2">
                        <Heart size={16} className="text-red-500"/> Health Monitoring (Backend)
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${workerStatus === 'ONLINE' ? 'bg-emerald-500/10 border-emerald-500/30' : workerStatus === 'OFFLINE' ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800 border-slate-700'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${workerStatus === 'ONLINE' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                    <Globe size={20}/>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400">Cloud Health (Firestore)</p>
                                    <p className={`font-black ${workerStatus === 'ONLINE' ? 'text-emerald-400' : 'text-slate-300'}`}>
                                        {workerStatus === 'ONLINE' ? 'OPERACIONAL' : workerStatus === 'OFFLINE' ? 'INACESSIVEL' : 'VERIFICANDO...'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={checkHealth} className="p-2 hover:bg-white/10 rounded-lg transition-colors" aria-label="Atualizar" title="Atualizar">
                                <RefreshCw size={16} className={workerStatus === 'CHECKING' ? 'animate-spin' : ''}/>
                            </button>
                        </div>

                        <div className="p-4 rounded-xl border border-slate-800 bg-slate-800/30 flex items-start gap-4">
                            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                                <AlertCircle size={20}/>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400">Tempo de Resposta</p>
                                <p className="font-black text-white">~ 240ms</p>
                                <p className="text-[10px] text-slate-500 mt-1">Latencia media do Firestore.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'LOGS' && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Terminal className="text-indigo-400" size={20}/>
                        <h3 className="font-bold text-white">Eventos de Sistema</h3>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={handleSoftDeleteLogs} className="flex-1 sm:flex-none px-4 py-2 bg-red-600/20 text-red-500 border border-red-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-all">
                            <Eraser size={14}/> Arquivar Logs
                        </button>
                        <button onClick={() => Logger.downloadLogs()} className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                            <Download size={14}/> Exportar Diagnostico
                        </button>
                        <button onClick={loadLogs} className="p-2 bg-slate-800 rounded-lg" aria-label="Atualizar" title="Atualizar"><RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''}/></button>
                    </div>
                </div>

                <div className="bg-black rounded-xl border border-slate-800 h-[500px] overflow-y-auto custom-scrollbar p-2">
                    {systemLogs.map((log, i) => (
                        <div key={i} className="py-2 px-3 border-b border-white/5 font-mono text-[11px] hover:bg-white/5 transition-colors">
                            <span className="text-slate-500 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className={`font-bold mr-2 ${log.level === 'ERROR' ? 'text-red-500' : log.level === 'WARN' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {log.level}
                            </span>
                            <span className="text-slate-300">{log.message}</span>
                            {log.details && (
                                <div className="mt-1 text-slate-500 pl-4 bg-white/5 rounded p-1">
                                    {JSON.stringify(log.details)}
                                </div>
                            )}
                        </div>
                    ))}
                    {systemLogs.length === 0 && <div className="p-10 text-center text-gray-600 font-mono text-xs">Nenhum evento registrado no IndexedDB.</div>}
                </div>
            </div>
        )}

        {activeTab === 'DATABASE' && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
                <div className="flex flex-col gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select 
                            value={selectedStore} onChange={e = aria-label="Selecionar"> setSelectedStore(e.target.value)}
                            className="bg-slate-800 rounded-lg px-4 py-2 font-bold text-sm text-white"
                        >
                            {STORES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                        </select>
                        <input 
                            placeholder="Filtrar localmente..." aria-label="Filtrar localmente..." value={dbFilter} onChange={e = /> setDbFilter(e.target.value)}
                            className="flex-1 px-4 py-2 bg-slate-800 rounded-lg text-xs text-white"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleExportCSV} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase">Exportar Tabela</button>
                        <button onClick={loadTable} className="p-2 bg-slate-800 rounded-lg" aria-label="Atualizar" title="Atualizar"><RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''}/></button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 h-[500px]">
                    <div className="w-full md:w-1/3 bg-slate-900 rounded-xl border border-slate-800 overflow-y-auto">
                        {filteredData.map((row, idx) => (
                            <button 
                                key={idx} onClick={() => setSelectedRow(row)}
                                className={`w-full text-left p-3 border-b border-slate-800 text-xs truncate transition-all ${selectedRow?.id === row.id ? 'bg-indigo-900/20 border-l-4 border-l-indigo-500' : 'hover:bg-white/5'}`}
                            >
                                <div className="font-bold text-slate-200">{row.name || row.client || row.id || `Row ${idx}`}</div>
                                <div className="text-[10px] opacity-40 font-mono mt-1">{row.id?.substring(0, 12) || idx}</div>
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-4 relative overflow-hidden flex flex-col">
                        <div className="absolute top-4 right-4 z-20">
                            <button onClick={() => copyToClipboard(JSON.stringify(selectedRow, null, 2))} className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20"><Copy size={16}/></button>
                        </div>
                        <pre className="flex-1 text-[10px] text-emerald-400 font-mono overflow-auto custom-scrollbar">
                            {selectedRow ? JSON.stringify(selectedRow, null, 2) : "// Selecione um registro  esquerda..."}
                        </pre>
                    </div>
                </div>
            </div>
        )}
        
        {activeTab === 'ROADMAP' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
                <RoadmapItem done title="PWA Assets Optimization" desc="cones mascarveis e manifest expandido para conformidade total Android/iOS." />
                <RoadmapItem done title="Firebase App Check" desc="Proteo da camada de dados via ReCaptcha V3 contra requisies externas." />
                <RoadmapItem done title="Backend Health Check" desc="Monitoramento em tempo real do Worker de mensagens no Render.com." />
                <RoadmapItem done title="Firestore Direct Sync" desc="Persistncia atmica garantindo que nenhuma venda seja perdida em conexes instveis." />
            </div>
        )}
    </div>
  );
};

const TabBtn = ({id, label, icon, active, onClick}: any) => (
    <button onClick={() => onClick(id)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${active === id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
        {icon} {label}
    </button>
);

const StatusCard = ({icon, title, value, sub, color}: any) => (
    <div className={`bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center gap-4 border-l-4 border-l-${color}-500 shadow-xl`}>
        <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-500`}>{icon}</div>
        <div>
            <p className="text-[10px] font-black uppercase opacity-40 text-slate-400">{title}</p>
            <p className="text-lg font-black text-white">{value}</p>
            <p className="text-[10px] opacity-60 truncate text-slate-500">{sub}</p>
        </div>
    </div>
);

const RoadmapItem = ({done, title, desc}: any) => (
    <div className={`flex gap-4 p-4 rounded-xl border ${done ? 'bg-emerald-500/5 dark:bg-emerald-950/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
        {done ? <CheckCircle2 className="text-emerald-500" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-600" />}
        <div>
            <h4 className={`font-bold text-sm ${done ? 'text-emerald-400' : 'text-slate-300'}`}>{title}</h4>
            <p className="text-xs text-slate-500">{desc}</p>
        </div>
    </div>
);

export default DevRoadmap;
