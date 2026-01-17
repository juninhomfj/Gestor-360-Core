import React, { useState, useEffect } from 'react';
import { Client } from '../types';
import { MergePreviewResult, previewClientMerge, executeClientMerge } from '../services/clientMergeService';
import { AlertTriangle, CheckCircle, ArrowRight, Loader2, Users, X } from 'lucide-react';

interface ClientMergeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    masterCandidate: Client;
    duplicates: Client[];
    currentUser: { id: string, name: string };
    darkMode: boolean;
}

const ClientMergeModal: React.FC<ClientMergeModalProps> = ({
    isOpen, onClose, onSuccess, masterCandidate, duplicates, currentUser, darkMode
}) => {
    const [selectedMasterId, setSelectedMasterId] = useState(masterCandidate.id);
    const [finalName, setFinalName] = useState(masterCandidate.name);
    const [preview, setPreview] = useState<MergePreviewResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);

    const allInvolved = [masterCandidate, ...duplicates];
    const selectedMaster = allInvolved.find(c => c.id === selectedMasterId) || masterCandidate;
    const itemsToMerge = allInvolved.filter(c => c.id !== selectedMasterId);

    // Atualiza preview quando mudar o master
    useEffect(() => {
        if (isOpen) {
            setFinalName(selectedMaster.name);
            loadPreview();
        }
    }, [selectedMasterId, isOpen]);

    const loadPreview = async () => {
        setLoading(true);
        try {
            const duplicateIds = itemsToMerge.map(c => c.id);
            const res = await previewClientMerge(selectedMasterId, duplicateIds);
            setPreview(res);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!confirm("Esta ação não pode ser desfeita automaticamente. Confirma a unificação?")) return;
        
        setProcessing(true);
        try {
            const duplicateIds = itemsToMerge.map(c => c.id);
            await executeClientMerge(selectedMasterId, duplicateIds, finalName, currentUser);
            onSuccess();
            onClose();
        } catch (e: any) {
            alert("Erro ao mesclar: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    const bgClass = darkMode ? 'bg-slate-900 text-white' : 'bg-white text-gray-900';
    const borderClass = darkMode ? 'border-slate-700' : 'border-gray-200';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border ${borderClass} ${bgClass} flex flex-col max-h-[90vh]`}>
                
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Users size={24} className="text-indigo-200"/>
                        <div>
                            <h3 className="text-xl font-bold">Unificar Clientes</h3>
                            <p className="text-xs text-indigo-100 opacity-80">Mesclar duplicatas em um único registro.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={20}/></button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    
                    {/* 1. Select Master */}
                    <div>
                        <h4 className="text-sm font-bold uppercase text-gray-500 mb-3">1. Escolha o Cadastro Principal (Master)</h4>
                        <div className="space-y-2">
                            {allInvolved.map(client => (
                                <label 
                                    key={client.id}
                                    className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedMasterId === client.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                >
                                    <input 
                                        type="radio" 
                                        name="masterSelect" 
                                        value={client.id} 
                                        checked={selectedMasterId === client.id}
                                        onChange={() => setSelectedMasterId(client.id)}
                                        className="w-5 h-5 text-indigo-600 mr-3"
                                    />
                                    <div className="flex-1">
                                        <div className="font-bold text-sm">{client.name}</div>
                                        <div className="text-xs text-gray-500">ID: {(client?.id || "").substring(0, 8)}...</div>
                                    </div>
                                    {selectedMasterId === client.id && <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">MASTER</span>}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 2. Final Name */}
                    <div>
                        <h4 className="text-sm font-bold uppercase text-gray-500 mb-2">2. Nome Final do Cliente</h4>
                        <input 
                            type="text" 
                            className={`w-full p-3 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'}`}
                            value={finalName}
                            onChange={e => setFinalName(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">Este nome será aplicado a todas as vendas.</p>
                    </div>

                    {/* 3. Impact Preview */}
                    <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                        <h4 className="text-sm font-bold uppercase text-gray-500 mb-3 flex items-center gap-2">
                            3. Impacto da Mescla {loading && <Loader2 size={14} className="animate-spin"/>}
                        </h4>
                        
                        {preview && (
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span>Cadastros a remover:</span>
                                    <span className="font-bold text-red-500">{itemsToMerge.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Vendas a atualizar:</span>
                                    <span className="font-bold text-blue-500">{preview.salesAffected}</span>
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
                                    <p>
                                        Atenção: Os cadastros removidos serão movidos para a Lixeira (Soft Delete).
                                        O histórico de vendas será preservado, mas vinculado ao novo nome "{finalName}".
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className={`p-6 border-t ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-gray-50'} flex justify-end gap-3`}>
                    <button onClick={onClose} disabled={processing} className="px-4 py-2 text-gray-500 font-bold hover:text-gray-700 transition-colors">Cancelar</button>
                    <button 
                        onClick={handleConfirm}
                        disabled={processing || loading || !finalName}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 disabled:opacity-50"
                    >
                        {processing ? <Loader2 size={18} className="animate-spin"/> : <CheckCircle size={18}/>}
                        Confirmar Mescla
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ClientMergeModal;