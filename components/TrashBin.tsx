
import React, { useState, useEffect } from 'react';
import { Sale, Transaction, Client } from '../types';
import { getTrashItems, restoreItem, permanentlyDeleteItem, getDeletedClients, restoreClient, permanentlyDeleteClient } from '../services/logic';
import { Trash2, RotateCcw, AlertTriangle, CheckCircle, Search, RefreshCw, X, User } from 'lucide-react';

// TODO: Lixeira de clientes será reativada na Etapa X

interface TrashBinProps {
    darkMode: boolean;
}

const TrashBin: React.FC<TrashBinProps> = ({ darkMode }) => {
    const [deletedSales, setDeletedSales] = useState<Sale[]>([]);
    const [deletedTransactions, setDeletedTransactions] = useState<Transaction[]>([]);
    const [deletedClients, setDeletedClients] = useState<Client[]>([]);
    
    const [activeTab, setActiveTab] = useState<'SALES' | 'FINANCE' | 'CLIENTS'>('SALES');
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const { sales, transactions } = await getTrashItems();
        const clients = await getDeletedClients();
        
        setDeletedSales(sales.sort((a,b) => new Date(b.deletedAt || '').getTime() - new Date(a.deletedAt || '').getTime()));
        setDeletedTransactions(transactions.sort((a,b) => new Date(b.deletedAt || '').getTime() - new Date(a.deletedAt || '').getTime()));
        setDeletedClients(clients.sort((a,b) => new Date(b.deletedAt || '').getTime() - new Date(a.deletedAt || '').getTime()));
        
        setIsLoading(false);
    };

    const handleRestore = async (id: string, type: 'SALE' | 'TRANSACTION' | 'CLIENT') => {
        if (!confirm('Deseja restaurar este item? Ele voltará para as listagens principais.')) return;
        
        setIsLoading(true);
        if (type === 'SALE') {
            const item = deletedSales.find(s => s.id === id);
            if (item) await restoreItem('SALE', item);
        } else if (type === 'TRANSACTION') {
            const item = deletedTransactions.find(t => t.id === id);
            if (item) await restoreItem('TRANSACTION', item);
        } else if (type === 'CLIENT') {
            await restoreClient(id);
        }
        
        await loadData();
        setFeedback({ type: 'success', msg: 'Item restaurado com sucesso!' });
        setTimeout(() => setFeedback(null), 3000);
    };

    const handlePermanentDelete = async (id: string, type: 'SALE' | 'TRANSACTION' | 'CLIENT') => {
        if (!confirm('ATENÇÃO: Exclusão permanente! Esta ação não pode ser desfeita. Continuar?')) return;

        setIsLoading(true);
        if (type === 'CLIENT') {
            await permanentlyDeleteClient(id);
        } else {
            await permanentlyDeleteItem(type as 'SALE'|'TRANSACTION', id);
        }
        await loadData();
        setFeedback({ type: 'success', msg: 'Item excluído permanentemente.' });
        setTimeout(() => setFeedback(null), 3000);
    };

    const bgClass = darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900';
    const cardClass = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100 shadow-sm';

    const getDaysRemaining = (deletedAt?: string) => {
        if (!deletedAt) return 0;
        const deletedDate = new Date(deletedAt);
        const expireDate = new Date(deletedDate);
        expireDate.setDate(deletedDate.getDate() + 60);
        const diffTime = expireDate.getTime() - new Date().getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    return (
        <div className={`rounded-xl border ${bgClass} h-[600px] flex flex-col overflow-hidden shadow-xl animate-in fade-in`}>
            
            {/* Header */}
            <div className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'} flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                    <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full text-red-600 dark:text-red-400">
                        <Trash2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Lixeira</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Itens são excluídos após 60 dias.</p>
                    </div>
                </div>
                <button onClick={loadData} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Tabs */}
            <div className={`flex border-b ${darkMode ? 'border-slate-700 bg-slate-950' : 'border-gray-200 bg-gray-50'}`}>
                <button 
                    onClick={() => setActiveTab('SALES')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'SALES' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Vendas ({deletedSales.length})
                </button>
                <button 
                    onClick={() => setActiveTab('FINANCE')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'FINANCE' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Financeiro ({deletedTransactions.length})
                </button>
                <button 
                    onClick={() => setActiveTab('CLIENTS')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'CLIENTS' ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Clientes ({deletedClients.length})
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-slate-950/50 custom-scrollbar">
                
                {feedback && (
                    <div className={`p-3 rounded-lg text-sm font-bold flex items-center gap-2 mb-4 animate-in slide-in-from-top-2 ${feedback.type === 'success' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                        {feedback.type === 'success' ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
                        {feedback.msg}
                    </div>
                )}

                {activeTab === 'SALES' && (
                    deletedSales.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <Trash2 size={48} className="mx-auto mb-2 opacity-20"/>
                            <p>Lixeira de vendas vazia.</p>
                        </div>
                    ) : (
                        deletedSales.map(sale => (
                            <div key={sale.id} className={`p-4 rounded-xl border flex justify-between items-center group transition-all hover:shadow-md ${cardClass}`}>
                                <div>
                                    <h4 className="font-bold text-sm truncate max-w-[200px]">{sale.client}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        R$ {sale.valueSold.toFixed(2)} • {new Date(sale.date || sale.completionDate || '').toLocaleDateString()}
                                    </p>
                                    <span className="text-[10px] text-red-400 font-mono mt-1 block">
                                        Excluído em: {new Date(sale.deletedAt || '').toLocaleDateString()}
                                        <span className="ml-2 font-bold">• Expira em {getDaysRemaining(sale.deletedAt)} dias</span>
                                    </span>
                                </div>
                                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleRestore(sale.id, 'SALE')}
                                        className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                                        title="Restaurar"
                                    >
                                        <RotateCcw size={18}/>
                                    </button>
                                    <button 
                                        onClick={() => handlePermanentDelete(sale.id, 'SALE')}
                                        className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                        title="Excluir Definitivamente"
                                    >
                                        <X size={18}/>
                                    </button>
                                </div>
                            </div>
                        ))
                    )
                )}

                {activeTab === 'FINANCE' && (
                    deletedTransactions.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <Trash2 size={48} className="mx-auto mb-2 opacity-20"/>
                            <p>Lixeira financeira vazia.</p>
                        </div>
                    ) : (
                        deletedTransactions.map(tx => (
                            <div key={tx.id} className={`p-4 rounded-xl border flex justify-between items-center group transition-all hover:shadow-md ${cardClass}`}>
                                <div>
                                    <h4 className="font-bold text-sm truncate max-w-[200px]">{tx.description}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        R$ {tx.amount.toFixed(2)} • {tx.type === 'INCOME' ? 'Receita' : 'Despesa'}
                                    </p>
                                    <span className="text-[10px] text-red-400 font-mono mt-1 block">
                                        Excluído em: {new Date(tx.deletedAt || '').toLocaleDateString()}
                                        <span className="ml-2 font-bold">• Expira em {getDaysRemaining(tx.deletedAt)} dias</span>
                                    </span>
                                </div>
                                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleRestore(tx.id, 'TRANSACTION')}
                                        className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                        title="Restaurar"
                                    >
                                        <RotateCcw size={18}/>
                                    </button>
                                    <button 
                                        onClick={() => handlePermanentDelete(tx.id, 'TRANSACTION')}
                                        className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                        title="Excluir Definitivamente"
                                    >
                                        <X size={18}/>
                                    </button>
                                </div>
                            </div>
                        ))
                    )
                )}

                {activeTab === 'CLIENTS' && (
                    deletedClients.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <Trash2 size={48} className="mx-auto mb-2 opacity-20"/>
                            <p>Lixeira de clientes vazia.</p>
                        </div>
                    ) : (
                        deletedClients.map(client => (
                            <div key={client.id} className={`p-4 rounded-xl border flex justify-between items-center group transition-all hover:shadow-md ${cardClass}`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <User size={16} className="text-gray-400"/>
                                        <h4 className="font-bold text-sm truncate max-w-[200px]">{client.name}</h4>
                                    </div>
                                    <span className="text-[10px] text-red-400 font-mono mt-1 block">
                                        Excluído em: {new Date(client.deletedAt || '').toLocaleDateString()}
                                        <span className="ml-2 font-bold">• Expira em {getDaysRemaining(client.deletedAt)} dias</span>
                                    </span>
                                </div>
                                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleRestore(client.id, 'CLIENT')}
                                        className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                                        title="Restaurar"
                                    >
                                        <RotateCcw size={18}/>
                                    </button>
                                    <button 
                                        onClick={() => handlePermanentDelete(client.id, 'CLIENT')}
                                        className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                        title="Excluir Definitivamente"
                                    >
                                        <X size={18}/>
                                    </button>
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>
        </div>
    );
};

export default TrashBin;
