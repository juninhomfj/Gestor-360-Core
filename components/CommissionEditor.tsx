import React, { useState, useEffect } from 'react';
import { CommissionRule, ProductType, User } from '../types';
import { Save, Plus, Trash2, Download, Upload, AlertCircle, Loader2, Database, ShieldAlert, RefreshCw } from 'lucide-react';
import { subscribeToCommissionRules, saveCommissionRules } from '../services/logic';
import { Logger } from '../services/logger';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

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
                minPercent: Number(r.minPercent),
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
            minPercent: Number(r.minPercent || 0),
            maxPercent: r.maxPercent ?? null,
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
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {permissionError && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-sm font-bold">
              <ShieldAlert size={20}/>
              <span>Acesso Negado: Sua autoridade Cloud não permite gravar tabelas globais.</span>
          </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${type === ProductType.NATAL ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              <Database size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Editor Global: {type === ProductType.BASICA ? 'Cesta Básica' : 'Natal'}</h3>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1">
                <RefreshCw size={12}/> Live Firestore Sync Active
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {!readOnly && isAdminOrDev && (
                <>
                    <label className="p-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-800 rounded-xl text-gray-500 transition-all">
                        <Upload size={20} />
                        <input type="file" className="hidden" accept=".json" onChange={handleImportJson} />
                    </label>
                    <button
                        onClick={handleExportJson}
                        className="p-3 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-xl text-gray-500 transition-all"
                    >
                        <Download size={20} />
                    </button>
                </>
            )}
          </div>
        </div>

        <div className="p-6 overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] border-b dark:border-slate-800">
                    <tr>
                        <th className="p-4">Margem Mín (%)</th>
                        <th className="p-4">Margem Máx (%)</th>
                        <th className="p-4">Comissão (%)</th>
                        <th className="p-4 text-center">Gestão</th>
                    </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                    {rules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="p-4">
                                <input 
                                    type="number" step="0.01"
                                    className="bg-transparent font-black text-gray-900 dark:text-white outline-none w-full"
                                    value={rule.minPercent} 
                                    onChange={(e) => handleFieldChange(rule.id, 'minPercent', parseFloat(e.target.value))}
                                    disabled={readOnly || !isAdminOrDev}
                                />
                            </td>
                            <td className="p-4">
                                <input 
                                    type="number" step="0.01" 
                                    placeholder="Sem limite"
                                    className="bg-transparent font-black text-gray-900 dark:text-white outline-none w-full"
                                    value={rule.maxPercent === null ? '' : rule.maxPercent} 
                                    onChange={(e) => handleFieldChange(rule.id, 'maxPercent', e.target.value === '' ? null : parseFloat(e.target.value))}
                                    disabled={readOnly || !isAdminOrDev}
                                />
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" step="0.01"
                                        className="bg-transparent font-black text-emerald-600 dark:text-emerald-400 outline-none w-24 text-right"
                                        value={rule.commissionRate} 
                                        onChange={(e) => handleFieldChange(rule.id, 'commissionRate', parseFloat(e.target.value))}
                                        disabled={readOnly || !isAdminOrDev}
                                    />
                                    <span className="text-[10px] font-black text-gray-400">%</span>
                                </div>
                            </td>
                            <td className="p-4 text-center">
                                {!readOnly && isAdminOrDev && (
                                    <button 
                                        onClick={() => deactivateRow(rule.id)}
                                        className="p-2 text-red-400 hover:text-red-600 rounded-lg transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {!readOnly && isAdminOrDev && (
            <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 flex flex-col md:flex-row justify-between items-center gap-4">
                <button 
                    onClick={addRow}
                    className="w-full md:w-auto px-6 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-700 text-gray-500 font-bold hover:border-indigo-500 hover:text-indigo-500 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={18}/> Nova Faixa
                </button>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    {hasChanges && (
                        <span className="text-[10px] font-black text-amber-500 uppercase animate-pulse flex items-center gap-1">
                            <AlertCircle size={14}/> Pendente de Sincronia
                        </span>
                    )}
                    <button 
                        onClick={handleCommit}
                        disabled={!hasChanges || isSaving}
                        className={`w-full md:w-auto px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl ${hasChanges ? 'bg-indigo-600 text-white shadow-indigo-900/30 hover:bg-indigo-700' : 'bg-gray-200 dark:bg-slate-800 text-gray-400'}`}
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                        Publicar Alterações Cloud
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default CommissionEditor;
