
import React, { useState, useEffect } from 'react';
import { dbGetAll, dbPut, getPendingSyncs } from '../storage/db';
import { Database, RefreshCw, Save, Activity, Trash2 } from 'lucide-react';

interface DatabaseInspectorProps {
    darkMode: boolean;
}

const STORES = ['users', 'sales', 'sales_tasks', 'config', 'accounts', 'transactions', 'sync_queue'];

const DatabaseInspector: React.FC<DatabaseInspectorProps> = ({ darkMode }) => {
    const [selectedStore, setSelectedStore] = useState('sync_queue');
    const [localData, setLocalData] = useState<any[]>([]);
    const [selectedRecordId, setSelectedRecordId] = useState<string | number | null>(null);
    const [jsonContent, setJsonContent] = useState('');
    const [filter, setFilter] = useState('');

    useEffect(() => {
        loadStoreData();
    }, [selectedStore]);

    const loadStoreData = async () => {
        try {
            let data = [];
            if (selectedStore === 'sync_queue') {
                data = await dbGetAll('sync_queue');
            } else {
                data = await dbGetAll(selectedStore as any);
            }
            // Sort by recent if possible
            if (selectedStore === 'sync_queue') {
                data.sort((a,b) => b.id - a.id);
            }
            setLocalData(data || []);
            setSelectedRecordId(null);
            setJsonContent('');
        } catch (e) {
            console.error(e);
        }
    };

    const handleSelectRecord = (record: any) => {
        // Try to find an ID or key
        const id = record.id !== undefined ? record.id : (record.key || 'unknown');
        setSelectedRecordId(id);
        setJsonContent(JSON.stringify(record, null, 2));
    };

    const handleSaveLocal = async () => {
        try {
            const obj = JSON.parse(jsonContent);
            await dbPut(selectedStore as any, obj);
            alert("Registro salvo localmente.");
            loadStoreData();
        } catch (e: any) {
            alert("Erro no JSON: " + e.message);
        }
    };

    const handleDeleteRecord = async () => {
        if (!selectedRecordId) return;
        if (!confirm('Deletar este registro?')) return;
        
        // Logic to delete based on store type would be needed here, 
        // but for safety/inspector, maybe just alert not implemented or do generic delete
        // Implementing generic delete:
        const { dbDelete } = await import('../storage/db');
        await dbDelete(selectedStore as any, selectedRecordId as any);
        loadStoreData();
    };

    const filteredData = localData.filter(item => 
        JSON.stringify(item).toLowerCase().includes(filter.toLowerCase())
    );

    const inputClass = darkMode ? 'bg-slate-900 border-slate-700 text-emerald-400 font-mono text-xs' : 'bg-gray-50 border-gray-300 text-blue-800 font-mono text-xs';

    return (
        <div className={`h-[600px] flex flex-col rounded-xl border overflow-hidden shadow-xl ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
            
            {/* Header */}
            <div className={`flex border-b p-3 items-center justify-between ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3">
                    <Database size={20} className="text-purple-500" />
                    <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Inspetor de Dados</h3>
                </div>
                <button onClick={loadStoreData} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full" aria-label="Atualizar" title="Atualizar">
                    <RefreshCw size={16} />
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar: Stores & List */}
                <div className={`w-1/3 border-r flex flex-col ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="p-2 border-b border-gray-200 dark:border-slate-700 space-y-2">
                        <select 
                            value={selectedStore} 
                            onChange={e => setSelectedStore(e.target.value)}
                            className={`w-full p-2 rounded text-sm font-bold ${darkMode ? 'bg-slate-800 text-white border-slate-600' : 'bg-white text-gray-800 border-gray-300'}`}
                        >
                            {STORES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                        </select>
                        <input 
                            placeholder="Filtrar..." aria-label="Filtrar..."
                            className={`w-full p-2 rounded text-xs ${darkMode ? 'bg-slate-800 text-white border-slate-600' : 'bg-white border-gray-300'}`}
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {filteredData.map((item, idx) => {
                            const label = item.table ? `[${item.type}] ${item.table}` : (item.name || item.username || item.description || item.client || item.id || `Item ${idx}`);
                            const isSel = (item.id !== undefined ? item.id : item.key) === selectedRecordId;
                            
                            return (
                                <button 
                                    key={idx}
                                    onClick={() => handleSelectRecord(item)}
                                    className={`w-full text-left px-3 py-2 rounded text-xs truncate transition-colors flex justify-between ${isSel ? 'bg-indigo-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300'}`}
                                >
                                    <span className="truncate">{label}</span>
                                    {selectedStore === 'sync_queue' && (
                                        <span className={`text-[9px] px-1 rounded ${item.status === 'FAILED' ? 'bg-red-500 text-white' : 'bg-gray-500 text-gray-200'}`}>
                                            {item.status}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col p-4 bg-gray-100 dark:bg-slate-950 dark:text-slate-100">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className={`text-xs font-bold uppercase ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {selectedRecordId !== null ? `ID: ${selectedRecordId}` : 'Selecione um registro'}
                        </h4>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleDeleteRecord}
                                disabled={selectedRecordId === null}
                                className="bg-red-600 text-white px-3 py-1.5 rounded flex items-center gap-2 text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                             aria-label="Excluir" title="Excluir">
                                <Trash2 size={14}/>
                            </button>
                            <button 
                                onClick={handleSaveLocal}
                                disabled={selectedRecordId === null}
                                className="bg-emerald-600 text-white px-3 py-1.5 rounded flex items-center gap-2 text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <Save size={14}/> Salvar
                            </button>
                        </div>
                    </div>
                    <textarea 
                        className={`flex-1 w-full p-4 rounded-lg border resize-none outline-none ${inputClass}`}
                        value={jsonContent}
                        onChange={e => setJsonContent(e.target.value)}
                        spellCheck={false}
                    />
                </div>
            </div>
        </div>
    );
};

export default DatabaseInspector;
