
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Client, Sale } from '../types';
import { getSalesByClient, formatCurrency } from '../services/logic';
import { X, ShoppingBag, TrendingUp, User, Award, BarChart3, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface ClientDetailsModalProps {
    client: Client;
    ownerName?: string;
    isOpen: boolean;
    onClose: () => void;
    darkMode: boolean;
}

const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({ client, ownerName, isOpen, onClose, darkMode }) => {
    const [sales, setSales] = useState<Sale[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadHistory();
        }
    }, [client.id, isOpen]);

    const loadHistory = async () => {
        try {
            const data = await getSalesByClient(client.name, client.id);
            setSales(data);
        } catch (e) {
            console.error("Erro ao carregar histórico", e);
        } finally {
        }
    };

    if (!isOpen) return null;

    const totalLTV = sales.reduce((acc, s) => acc + s.valueSold, 0);
    const totalComm = sales.reduce((acc, s) => acc + s.commissionValueTotal, 0);
    const avgMargin = sales.length > 0 ? (sales.reduce((acc, s) => acc + s.marginPercent, 0) / sales.length) : 0;

    const marginData = [...sales].reverse().map((s, idx) => ({
        name: `P${idx + 1}`,
        margin: s.marginPercent,
        fullDate: new Date(s.date || s.completionDate || '').toLocaleDateString()
    }));

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className={`w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'} flex flex-col h-[90vh]`}>
                
                {/* Header Dossiê */}
                <div className="p-8 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 dark:text-slate-100">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-900/30">
                            <User size={40} />
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{client.name}</h3>
                            <div className="flex gap-2 mt-1">
                                <p className="text-xs text-slate-500 dark:text-slate-300 font-bold uppercase tracking-widest">Dossiê 360</p>
                                <div className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full my-auto"></div>
                                {ownerName ? (
                                    <>
                                        <div className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full my-auto"></div>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest">Proprietário: {ownerName}</p>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="p-3 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors" aria-label="Fechar" title="Fechar">
                            <X size={24} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Body Conteúdo */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                            <div className="space-y-10 animate-in fade-in slide-in-from-left-4">
                            {/* KPIs de LTV */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <KPICard label="LTV Total" value={formatCurrency(totalLTV)} icon={<TrendingUp size={20}/>} color="blue" />
                                <KPICard label="Comissões" value={formatCurrency(totalComm)} icon={<Award size={20}/>} color="emerald" />
                                <KPICard label="Pedidos" value={sales.length.toString()} icon={<ShoppingBag size={20}/>} color="purple" />
                                <KPICard label="Margem Média" value={`${avgMargin.toFixed(1)}%`} icon={<BarChart3 size={20}/>} color="amber" />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-4">
                                    <h4 className="text-sm font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
                                        <BarChart3 size={16}/> Comportamento de Margem
                                    </h4>
                                    <div className="h-64 w-full p-4 rounded-3xl bg-gray-50 dark:bg-slate-950 border dark:border-slate-800 dark:text-slate-100">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={marginData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                                                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                    formatter={(val: number) => [`${val}%`, 'Margem']}
                                                />
                                                <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="3 3" />
                                                <Bar dataKey="margin" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
                                        <FileText size={16}/> Notas do Parceiro
                                    </h4>
                                    <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 min-h-[150px]">
                                        <p className="text-sm text-amber-900 dark:text-amber-100 italic leading-relaxed">
                                            {client.notes || "Nenhuma observação estratégica registrada."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex justify-between items-center px-10 dark:text-slate-100">
                    <p className="text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">Dossiê Gerado em {new Date().toLocaleDateString()}</p>
                    <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white font-black rounded-2xl active:scale-95 transition-all text-[10px] uppercase tracking-widest border border-white/10">Fechar Dossiê</button>
                </div>

            </div>
        </div>,
        document.body
    );
};

const KPICard = ({ label, value, icon, color }: any) => (
    <div className={`p-6 rounded-3xl border flex items-center gap-5 transition-all hover:translate-y-[-2px] ${color === 'blue' ? 'bg-blue-500/5 border-blue-500/20' : color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/20' : color === 'purple' ? 'bg-purple-500/5 border-purple-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        <div className={`p-3 rounded-2xl ${color === 'blue' ? 'text-blue-500 bg-blue-500/10' : color === 'emerald' ? 'text-emerald-500 bg-emerald-500/10' : color === 'purple' ? 'text-purple-500 bg-purple-500/10' : 'text-amber-500 bg-amber-500/10'}`}>
            {icon}
        </div>
        <div className="overflow-hidden">
            <p className="text-[9px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest mb-1 truncate">{label}</p>
            <p className="text-xl font-black text-gray-900 dark:text-white truncate">{value}</p>
        </div>
    </div>
);

const SummaryItem = ({ label, value, icon, helper }: { label: string; value: string; icon: React.ReactNode; helper?: string }) => (
    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 flex items-center gap-4 dark:text-slate-100">
        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
            {icon}
        </div>
        <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300">{label}</p>
            <p className="text-lg font-black text-gray-900 dark:text-white">{value}</p>
            {helper ? <p className="text-[11px] text-gray-600 dark:text-gray-400">{helper}</p> : null}
        </div>
    </div>
);

export default ClientDetailsModal;
