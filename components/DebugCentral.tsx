import React, { useState, useEffect, useMemo } from 'react';
import { Logger } from '../services/logger';
import { LogEntry, LogLevel } from '../types';
import { X, Download, Trash2, Filter, RefreshCw } from 'lucide-react';

/**
 * ETAPA 4: Central de Depuração
 * Visualiza e filtra logs em tempo real
 * Acesso: /debug ou admin only
 */

type FilterLevel = LogLevel | 'ALL';
type FilterDevice = 'ALL' | 'Mobile-Android' | 'Mobile-iOS' | 'Desktop-Mac' | 'Desktop-Windows' | 'Web-Generic';

interface LogFilter {
  level: FilterLevel;
  device: FilterDevice;
  screen: string;
  action: string;
  searchText: string;
}

interface DebugCentralProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

const DebugCentral: React.FC<DebugCentralProps> = ({ isOpen, onClose, isDarkMode = true }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>({
    level: 'ALL',
    device: 'ALL',
    screen: '',
    action: '',
    searchText: ''
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Carrega logs inicialmente e em auto-refresh
  useEffect(() => {
    if (!isOpen) return;

    const loadLogs = async () => {
      try {
        const allLogs = await Logger.getLogs(500);
        setLogs(allLogs);
      } catch (error) {
        console.error('Erro ao carregar logs:', error);
      }
    };

    loadLogs();

    if (!autoRefresh) return;

    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh]);

  // Filtra logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filter.level !== 'ALL' && log.level !== filter.level) return false;
      if (filter.device !== 'ALL' && log.details?.platform !== filter.device) return false;
      if (filter.screen && log.details?.screen !== filter.screen) return false;
      if (filter.action && !log.message.toLowerCase().includes(filter.action.toLowerCase())) return false;
      if (filter.searchText) {
        const searchLower = filter.searchText.toLowerCase();
        const messageMatch = log.message.toLowerCase().includes(searchLower);
        const detailsMatch = JSON.stringify(log.details).toLowerCase().includes(searchLower);
        if (!messageMatch && !detailsMatch) return false;
      }
      return true;
    });
  }, [logs, filter]);

  // Estatísticas
  const stats = useMemo(() => {
    const byLevel: Record<LogLevel, number> = {
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      CRASH: 0
    };
    logs.forEach(log => {
      byLevel[log.level]++;
    });
    return byLevel;
  }, [logs]);

  const handleDownload = async () => {
    try {
      await Logger.downloadLogs();
    } catch (error) {
      console.error('Erro ao baixar logs:', error);
    }
  };

  const handleClear = async () => {
    if (window.confirm('Limpar todos os logs locais?')) {
      try {
        await Logger.softDeleteLogsGlobal();
        setLogs([]);
        alert('Logs limpos com sucesso');
      } catch (error) {
        console.error('Erro ao limpar logs:', error);
      }
    }
  };

  if (!isOpen) return null;

  const levelColors: Record<LogLevel, string> = {
    INFO: isDarkMode ? 'text-blue-400' : 'text-blue-600',
    WARN: isDarkMode ? 'text-yellow-400' : 'text-yellow-600',
    ERROR: isDarkMode ? 'text-red-400' : 'text-red-600',
    CRASH: isDarkMode ? 'text-red-600' : 'text-red-700'
  };

  const bgColors: Record<LogLevel, string> = {
    INFO: isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50',
    WARN: isDarkMode ? 'bg-yellow-500/10' : 'bg-yellow-50',
    ERROR: isDarkMode ? 'bg-red-500/10' : 'bg-red-50',
    CRASH: isDarkMode ? 'bg-red-700/10' : 'bg-red-100'
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      <div className={`rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col ${
        isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-slate-700' : 'border-gray-200'
        }`}>
          <div>
            <h2 className={`text-2xl font-black uppercase tracking-tighter ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>Central de Depuração</h2>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              Total: {filteredLogs.length} logs | INFO: {stats.INFO} | WARN: {stats.WARN} | ERROR: {stats.ERROR} | CRASH: {stats.CRASH}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 hover:rounded-lg transition ${
              isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-100'
            }`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Controls */}
        <div className={`flex flex-wrap gap-3 p-4 border-b ${
          isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'
        }`}>
          <select
            value={filter.level}
            onChange={(e) => setFilter({ ...filter, level: e.target.value as FilterLevel })}
            className={`px-3 py-2 rounded-lg text-sm font-semibold ${
              isDarkMode 
                ? 'bg-slate-700 text-white' 
                : 'bg-white text-gray-900 border border-gray-300'
            }`}
          >
            <option value="ALL">Todos os Níveis</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="CRASH">CRASH</option>
          </select>

          <select
            value={filter.device}
            onChange={(e) => setFilter({ ...filter, device: e.target.value as FilterDevice })}
            className={`px-3 py-2 rounded-lg text-sm font-semibold ${
              isDarkMode 
                ? 'bg-slate-700 text-white' 
                : 'bg-white text-gray-900 border border-gray-300'
            }`}
          >
            <option value="ALL">Todos os Dispositivos</option>
            <option value="Mobile-Android">Mobile Android</option>
            <option value="Mobile-iOS">Mobile iOS</option>
            <option value="Desktop-Mac">Desktop Mac</option>
            <option value="Desktop-Windows">Desktop Windows</option>
            <option value="Web-Generic">Web Generic</option>
          </select>

          <input
            type="text"
            placeholder="Buscar..."
            value={filter.searchText}
            onChange={(e) => setFilter({ ...filter, searchText: e.target.value })}
            className={`px-3 py-2 rounded-lg text-sm flex-1 ${
              isDarkMode 
                ? 'bg-slate-700 text-white placeholder-slate-500' 
                : 'bg-white text-gray-900 border border-gray-300'
            }`}
          />

          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            Auto-refresh (5s)
          </label>

          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setLogs([])}
              className={`p-2 rounded-lg flex items-center gap-1 text-sm font-semibold transition ${
                isDarkMode
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              <RefreshCw size={16} /> Recarregar
            </button>
            <button
              onClick={handleDownload}
              className={`p-2 rounded-lg flex items-center gap-1 text-sm font-semibold transition ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              <Download size={16} /> Baixar
            </button>
            <button
              onClick={handleClear}
              className={`p-2 rounded-lg flex items-center gap-1 text-sm font-semibold transition ${
                isDarkMode
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              <Trash2 size={16} /> Limpar
            </button>
          </div>
        </div>

        {/* Logs List */}
        <div className={`flex-1 overflow-y-auto ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
          {filteredLogs.length === 0 ? (
            <div className={`p-8 text-center ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              <p className="text-sm font-semibold">Nenhum log encontrado</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`p-4 ${bgColors[log.level]} cursor-pointer hover:opacity-75 transition`}
                  onClick={() => setExpandedLogId(expandedLogId === `${idx}` ? null : `${idx}`)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`text-xs font-black uppercase tracking-widest min-w-fit ${levelColors[log.level]}`}>
                      {log.level}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {log.message}
                      </p>
                      <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                        {new Date(log.timestamp).toLocaleTimeString()} | {log.details?.platform}
                      </p>
                    </div>
                  </div>

                  {expandedLogId === `${idx}` && (
                    <div className={`mt-4 p-3 rounded-lg text-xs font-mono ${
                      isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-700'
                    }`}>
                      <pre className="overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebugCentral;
