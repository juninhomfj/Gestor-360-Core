import React, { useState, useEffect } from 'react';
import { CommissionRule, ProductType, User } from '../types';
import { Save, Plus, Trash2, Download, Upload, AlertCircle, Loader2, Database, ShieldAlert, RefreshCw } from 'lucide-react';
import { subscribeToCommissionRules, saveCommissionRules } from '../services/logic';
import { Logger } from '../services/logger';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Helper: parseNumericInput
const parseNumericInput = (value: string) => {
  if (value === '' || value === undefined) return 0;
  return Number(value);
};

interface CommissionEditorProps {
  type: ProductType;
  currentUser: User;
  readOnly?: boolean;
}

const CommissionEditor: React.FC<CommissionEditorProps> = ({ type, currentUser, readOnly = false }) => {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    setLoading(true);
    let unsubscribeFn: (() => void) | undefined;
    let unsubscribeAuth: (() => void) | undefined;
    let isMounted = true;

    const initSubscription = async () => {
        try {
            if (auth.currentUser) {
                await auth.currentUser.getIdToken(true);
            }
        } catch (error) {
            Logger.error("[CommissionEditor] Falha ao atualizar token", {
                message: (error as any)?.message,
                code: (error as any)?.code
            });
        }

        if (!isMounted) return;
        const formatRateForDisplay = (rate: number) => {
            if (Number.isNaN(rate)) return 0;
            return rate <= 1 ? rate * 100 : rate;
        };
        unsubscribeFn = subscribeToCommissionRules(type, (newRules) => {
            const normalized = (newRules || []).map(r => ({
                ...r,
                minPercent: r.minPercent === null ? null : Number(r.minPercent),
                maxPercent: r.maxPercent === null ? null : Number(r.maxPercent),
                commissionRate: formatRateForDisplay(Number(r.commissionRate))
            }));
            setRules(normalized);
            setLoading(false);
            setHasChanges(false);
        }, (error) => {
            if (error?.code === 'permission-denied') {
                setPermissionError(true);
            }
            setLoading(false);
        });
    };

    if (auth.currentUser) {
        initSubscription();
    } else {
        unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (!user || !isMounted) return;
            initSubscription();
            unsubscribeAuth?.();
        });
    }
    return () => {
        isMounted = false;
        unsubscribeFn?.();
        unsubscribeAuth?.();
    };
  }, [type]);

  const handleFieldChange = (id: string, field: keyof CommissionRule, value: any) => {
    if (readOnly) return;
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    setHasChanges(true);
  };

  const addRow = () => {
    if (readOnly) return;
    const newRule: CommissionRule = {
      id: `new_${Date.now()}`,
      minPercent: 0,
      maxPercent: null,
      commissionRate: 0,
      isActive: true
    };
    setRules([...rules, newRule]);
    setHasChanges(true);
  };

  const deactivateRow = async (id: string) => {
    if (readOnly) return;
    if (!confirm("Desativar esta faixa de comissão?")) return;
    const updatedRules = rules.filter(r => r.id !== id);
    setRules(updatedRules);
    setHasChanges(true);
  };

  const handleCommit = async () => {
    if (readOnly) return;
    setIsSaving(true);
    try {
      const normalized = rules.map(rule => ({
        ...rule,
        commissionRate: Number(rule.commissionRate) / 100
      }));
      await saveCommissionRules(type, normalized);
      setHasChanges(false);
      setPermissionError(false);
    } catch (e: any) {
      if (e.code === 'permission-denied') setPermissionError(true);
      Logger.error("[CommissionEditor] Erro ao gravar tabela de comissão", {
        code: e?.code,
        message: e?.message,
        type
      });
      alert("Erro ao gravar no Firestore: " + e.message);
    } finally { setIsSaving(false); }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formatRateForDisplay = (rate: number) => {
      if (Number.isNaN(rate)) return 0;
      return rate <= 1 ? rate * 100 : rate;
    };
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setRules(imported.map((r, i) => ({
            id: `imp_${Date.now()}_${i}`,
            minPercent: r.minPercent === null || r.minPercent === undefined ? null : Number(r.minPercent),
            maxPercent: r.maxPercent === null || r.maxPercent === undefined ? null : Number(r.maxPercent),
            commissionRate: formatRateForDisplay(Number(r.commissionRate || 0)),
            isActive: true
          })));
          setHasChanges(true);
        }
      } catch (err) { alert("JSON inválido."); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `comissao_${type.toLowerCase()}.json`; a.click();
  };

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center p-20 text-gray-500">
            <Loader2 className="animate-spin mb-4" size={32}/>
            <p className="text-xs font-black uppercase tracking-widest animate-pulse">Consultando Firestore...</p>
        </div>
    );
  }

  const isAdminOrDev = currentUser.role === 'ADMIN' || 
                       currentUser.role === 'DEV' || 
                       ['mint', 'soldev'].includes(currentUser.username?.toLowerCase() || '') ||
                       ['mint@gestor360.com', 'soldev@gestor360.com'].includes(currentUser.email?.toLowerCase() || '');

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 px-4 sm:px-0">
      
      {permissionError && (
          <div className="bg-red-500/10 border border-red-500/30 p-3 sm:p-4 rounded-lg sm:rounded-2xl flex items-start sm:items-center gap-2 sm:gap-3 text-red-500 text-xs sm:text-sm font-bold">
              <ShieldAlert size={16} className="sm:w-[20px] sm:h-[20px] flex-shrink-0 mt-0.5 sm:mt-0" />
              <span>Acesso Negado: Sua autoridade Cloud não permite gravar tabelas globais.</span>
          </div>
      )}

      <div className="bg-slate-100 dark:bg-slate-900 rounded-lg sm:rounded-[2rem] border border-gray-300 dark:border-slate-800 shadow-xl overflow-hidden dark:text-slate-100 text-gray-900">
        <div className="p-4 sm:p-6 border-b border-gray-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex flex-col gap-3 sm:gap-4 dark:text-slate-100 text-gray-900">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
            <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl shrink-0 ${type === ProductType.NATAL ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              <Database size={20} className="sm:w-[24px] sm:h-[24px]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-xl font-black text-gray-900 dark:text-white truncate">Editor: {type === ProductType.BASICA ? 'Cesta Básica' : 'Natal'}</h3>
              <p className="text-[9px] sm:text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1 truncate">
                <RefreshCw size={12} className="flex-shrink-0"/> Live Firestore Sync
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {!readOnly && isAdminOrDev && (
                <>
                    <label
                        className="p-2 sm:p-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg sm:rounded-xl text-gray-500 transition-all touch-target"
                        title="Importar tabela JSON"
                    >
                        <Upload size={18} className="sm:w-[20px] sm:h-[20px]" />
                        <input type="file" className="hidden" accept=".json" onChange={handleImportJson} aria-label="Selecionar arquivo" />
                    </label>
                    <button
                        onClick={handleExportJson}
                        className="p-2 sm:p-3 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg sm:rounded-xl text-gray-500 transition-all touch-target"
                        title="Exportar tabela JSON"
                        aria-label="Exportar tabela JSON"
                    >
                        <Download size={18} className="sm:w-[20px] sm:h-[20px]" />
                    </button>
                </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto table-responsive-wrapper p-3 sm:p-6">
            <table className="table-responsive text-xs sm:text-sm text-left">
                <thead className="text-[9px] sm:text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] border-b dark:border-slate-800">
                    <tr>
                        <th className="p-2 sm:p-4 whitespace-nowrap">Margem Mín (%)</th>
                        <th className="p-2 sm:p-4 whitespace-nowrap">Margem Máx (%)</th>
                        <th className="p-2 sm:p-4 whitespace-nowrap">Comissão (%)</th>
                        <th className="p-2 sm:p-4 text-center whitespace-nowrap">Gestão</th>
                    </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                    {rules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="p-2 sm:p-4">
                                <input 
                                    type="number" step="0.01"
                                    placeholder="Sem limite"
                                    className="bg-transparent font-black text-gray-900 dark:text-white outline-none w-full text-xs sm:text-sm"
                                    value={rule.minPercent} 
                                    onChange={(e) => handleFieldChange(rule.id, 'minPercent', parseFloat(e.target.value))}
                                    disabled={readOnly || !isAdminOrDev}
                                    aria-label="Margem mínima"
                                    title="Margem mínima"
                                />
                            </td>
                            <td className="p-2 sm:p-4">
                                <input 
                                    type="number" step="0.01" 
                                    placeholder="Sem limite"
                                    className="bg-transparent font-black text-gray-900 dark:text-white outline-none w-full text-xs sm:text-sm"
                                    value={rule.maxPercent === null ? '' : rule.maxPercent} 
                                    onChange={(e) => handleFieldChange(rule.id, 'maxPercent', e.target.value === '' ? null : parseFloat(e.target.value))}
                                    disabled={readOnly || !isAdminOrDev}
                                    aria-label="Margem máxima"
                                    title="Margem máxima"
                                />
                            </td>
                            <td className="p-2 sm:p-4">
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <input 
                                        type="number" step="0.01"
                                        className="bg-transparent font-black text-emerald-600 dark:text-emerald-400 outline-none w-16 sm:w-24 text-right text-xs sm:text-sm"
                                        value={rule.commissionRate === 0 ? "" : rule.commissionRate} 
                                        onChange={(e) => handleFieldChange(rule.id, 'commissionRate', parseNumericInput(e.target.value))}
                                        disabled={readOnly || !isAdminOrDev}
                                        aria-label="Comissão percentual"
                                        title="Comissão percentual"
                                        placeholder="0"
                                    />
                                    <span className="text-[9px] sm:text-[10px] font-black text-gray-400">%</span>
                                </div>
                            </td>
                            <td className="p-2 sm:p-4 text-center">
                                {!readOnly && isAdminOrDev && (
                                    <button 
                                        onClick={() => deactivateRow(rule.id)}
                                        className="p-1.5 sm:p-2 text-red-400 hover:text-red-600 rounded-lg transition-all touch-target"
                                        title="Remover faixa de comissão"
                                        aria-label="Remover faixa de comissão"
                                    >
                                        <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {!readOnly && isAdminOrDev && (
            <div className="p-4 sm:p-6 border-t border-gray-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 dark:text-slate-100 text-gray-900">
                <button 
                    onClick={addRow}
                    className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-700 text-gray-500 font-bold hover:border-indigo-500 hover:text-indigo-500 transition-all flex items-center justify-center gap-2 text-sm sm:text-base touch-target"
                >
                    <Plus size={16} className="sm:w-[18px] sm:h-[18px]"/> <span className="hidden sm:inline">Nova</span> Faixa
                </button>

                <div className="flex items-center gap-2 sm:gap-4 flex-col-reverse sm:flex-row w-full sm:w-auto">
                    {hasChanges && (
                        <span className="text-[9px] sm:text-[10px] font-black text-amber-500 uppercase animate-pulse flex items-center gap-1 order-2 sm:order-1">
                            <AlertCircle size={12} className="flex-shrink-0"/> Pendente de Sincronia
                        </span>
                    )}
                    <button 
                        onClick={handleCommit}
                        disabled={!hasChanges || isSaving}
                        className={`flex-1 sm:flex-initial px-4 sm:px-10 py-2.5 sm:py-4 rounded-lg sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 sm:gap-3 shadow-xl text-sm order-1 sm:order-2 ${hasChanges ? 'bg-indigo-600 text-white shadow-indigo-900/30 hover:bg-indigo-700' : 'bg-gray-200 dark:bg-slate-800 text-gray-400'}`}
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin sm:w-[18px] sm:h-[18px]"/> : <Save size={16} className="sm:w-[18px] sm:h-[18px]"/>}
                        <span className="hidden sm:inline">Publicar Alterações Cloud</span><span className="sm:hidden">Publicar</span>
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default CommissionEditor;
