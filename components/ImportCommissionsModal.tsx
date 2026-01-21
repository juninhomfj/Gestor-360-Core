
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sale, CommissionDeduction, ProductType } from '../types';
import { X, Plus, Trash2, Calendar, ShoppingBag, Gift, Filter, CheckCircle, AlertCircle, Search, PieChart } from 'lucide-react';

interface ImportCommissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
  onImport: (description: string, totalValue: number, deductions: CommissionDeduction[]) => void;
  darkMode?: boolean;
}

type ImportMode = 'BASICA' | 'NATAL' | 'CUSTOM';

const ImportCommissionsModal: React.FC<ImportCommissionsModalProps> = ({ isOpen, onClose, sales, onImport, darkMode }) => {
  // --- STATE ---
  const [mode, setMode] = useState<ImportMode>('BASICA');
  
  // Selection States
  const [selectedPeriodBasic, setSelectedPeriodBasic] = useState(''); // Format: "YYYY-MM"
  const [selectedYearNatal, setSelectedYearNatal] = useState(''); // Format: "YYYY"
  
  // Custom Mode States
  const [customType, setCustomType] = useState<ProductType | 'ALL'>('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Partial Import State
  const [importPercentage, setImportPercentage] = useState<number>(100);

  // Deductions State
  const [deductions, setDeductions] = useState<CommissionDeduction[]>([]);
  const [deductionDesc, setDeductionDesc] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');

  // --- MEMOIZED DATA EXTRACTION (Runs safely at top level) ---

  const availableBasicPeriods = useMemo(() => {
      if (!sales) return [];
      const periods = new Set<string>();
      sales.forEach(s => {
          if (s.type === ProductType.BASICA && s.date && s.date.length >= 7) {
              periods.add(s.date.substring(0, 7));
          }
      });
      return Array.from(periods).sort().reverse();
  }, [sales]);

  const availableNatalYears = useMemo(() => {
      if (!sales) return [];
      const years = new Set<string>();
      sales.forEach(s => {
          if (s.type === ProductType.NATAL && s.date && s.date.length >= 4) {
              years.add(s.date.substring(0, 4));
          }
      });
      return Array.from(years).sort().reverse();
  }, [sales]);

  // --- FILTER LOGIC ---

  const filteredData = useMemo(() => {
      if (!sales) return { items: [], total: 0 };

      const items = sales.filter(sale => {
          if (!sale.date) return false;
          const saleDate = sale.date;
          
          if (mode === 'BASICA') {
              if (sale.type !== ProductType.BASICA) return false;
              if (!selectedPeriodBasic) return false;
              return saleDate.startsWith(selectedPeriodBasic);
          }

          if (mode === 'NATAL') {
              if (sale.type !== ProductType.NATAL) return false;
              if (!selectedYearNatal) return false;
              return saleDate.startsWith(selectedYearNatal);
          }

          if (mode === 'CUSTOM') {
              const dateOnly = saleDate.substring(0, 10);
              if (customType !== 'ALL' && sale.type !== customType) return false;
              if (customStart && dateOnly < customStart) return false;
              if (customEnd && dateOnly > customEnd) return false;
              return true;
          }

          return false;
      });

      const fullTotal = items.reduce((acc, s) => acc + s.commissionValueTotal, 0);
      return { items, total: fullTotal };
  }, [sales, mode, selectedPeriodBasic, selectedYearNatal, customType, customStart, customEnd]);

  // Apply Percentage Logic
  const grossTotal = (filteredData.total * importPercentage) / 100;
  const totalDeductions = deductions.reduce((acc, d) => acc + d.amount, 0);
  const netTotal = grossTotal - totalDeductions;

  // --- ACTIONS ---

  const handleAddDeduction = () => {
      const val = parseFloat(deductionAmount);
      if (deductionDesc && val > 0) {
          setDeductions([...deductions, { id: crypto.randomUUID(), description: deductionDesc, amount: val }]);
          setDeductionDesc('');
          setDeductionAmount('');
      }
  };

  const handleRemoveDeduction = (id: string) => {
      setDeductions(deductions.filter(d => d.id !== id));
  };

  const generateDescription = () => {
      let desc = 'Importação de Comissão';
      if (mode === 'BASICA' && selectedPeriodBasic) {
          const [y, m] = selectedPeriodBasic.split('-');
          desc = `Comissão Básica ${m}/${y}`;
      } else if (mode === 'NATAL' && selectedYearNatal) {
          desc = `Comissão Natal ${selectedYearNatal}`;
      } else if (mode === 'CUSTOM') {
          desc = `Comissão Personalizada`;
      }

      if (importPercentage < 100) {
          desc += ` (Parcial ${importPercentage}%)`;
      }
      return desc;
  };

  const handleConfirm = () => {
      if (grossTotal <= 0) {
          alert("Valor zerado. Verifique os filtros.");
          return;
      }
      onImport(generateDescription(), grossTotal, deductions); // Pass gross total applied by percentage
      onClose();
      // Reset
      setDeductions([]);
      setMode('BASICA');
      setSelectedPeriodBasic('');
      setSelectedYearNatal('');
      setImportPercentage(100);
  };

  if (!isOpen) return null;

  const bgClass = darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-gray-900';
  const borderClass = darkMode ? 'border-slate-700' : 'border-gray-200';
  const inputClass = darkMode ? 'bg-black border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900';
  const cardClass = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className={`${bgClass} rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200`}>
        
        {/* Header */}
        <div className={`p-5 border-b ${borderClass} flex justify-between items-center`}>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Search size={24} className="text-emerald-500" /> Importar Comissões
            </h2>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                Traga valores de vendas faturadas para o financeiro.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500" aria-label="Fechar" title="Fechar">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* 1. Select Mode */}
            <div>
                <label className="block text-xs font-bold uppercase mb-2 opacity-70">1. Tipo de Produto</label>
                <div className="grid grid-cols-3 gap-3">
                    <button 
                        onClick={() => setMode('BASICA')}
                        className={`p-3 rounded-lg border text-center transition-all ${mode === 'BASICA' ? 'bg-emerald-600 border-emerald-500 text-white' : cardClass}`}
                    >
                        <ShoppingBag size={20} className="mx-auto mb-1" />
                        <span className="font-bold text-sm block">Cesta Básica</span>
                    </button>
                    
                    <button 
                        onClick={() => setMode('NATAL')}
                        className={`p-3 rounded-lg border text-center transition-all ${mode === 'NATAL' ? 'bg-red-600 border-red-500 text-white' : cardClass}`}
                    >
                        <Gift size={20} className="mx-auto mb-1" />
                        <span className="font-bold text-sm block">Natal</span>
                    </button>

                    <button 
                        onClick={() => setMode('CUSTOM')}
                        className={`p-3 rounded-lg border text-center transition-all ${mode === 'CUSTOM' ? 'bg-blue-600 border-blue-500 text-white' : cardClass}`}
                    >
                        <Filter size={20} className="mx-auto mb-1" />
                        <span className="font-bold text-sm block">Outros</span>
                    </button>
                </div>
            </div>

            {/* 2. Filters */}
            <div className={`p-4 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                <label className="block text-xs font-bold uppercase mb-3 opacity-70 flex items-center gap-2">
                    <Calendar size={14}/> 
                    2. Período de Faturamento
                </label>

                {mode === 'BASICA' && (
                    <div>
                        <label className="block text-sm mb-1">Mês de Referência</label>
                        <select 
                            className={`w-full p-2 rounded border ${inputClass}`}
                            value={selectedPeriodBasic}
                            onChange={e => setSelectedPeriodBasic(e.target.value)}
                        >
                            <option value="">-- Selecione --</option>
                            {availableBasicPeriods.map(p => (
                                <option key={p} value={p}>{p.split('-')[1]}/{p.split('-')[0]}</option>
                            ))}
                        </select>
                        {availableBasicPeriods.length === 0 && (
                            <p className="text-xs text-red-500 mt-2">
                                Nenhuma venda "Básica" faturada encontrada.
                            </p>
                        )}
                    </div>
                )}

                {mode === 'NATAL' && (
                    <div>
                        <label className="block text-sm mb-1">Ano da Campanha</label>
                        <select 
                            className={`w-full p-2 rounded border ${inputClass}`}
                            value={selectedYearNatal}
                            onChange={e => setSelectedYearNatal(e.target.value)}
                        >
                            <option value="">-- Selecione --</option>
                            {availableNatalYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        {availableNatalYears.length === 0 && (
                            <p className="text-xs text-red-500 mt-2">
                                Nenhuma venda "Natal" faturada encontrada.
                            </p>
                        )}
                    </div>
                )}

                {mode === 'CUSTOM' && (
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm mb-1">Início</label>
                            <input 
                                type="date" 
                                className={`w-full p-2 rounded border ${inputClass}`}
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm mb-1">Fim</label>
                            <input 
                                type="date" 
                                className={`w-full p-2 rounded border ${inputClass}`}
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* Live Preview */}
                <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'} flex justify-between items-center`}>
                     <div>
                        <p className="text-xs opacity-70">Vendas Selecionadas</p>
                        <p className="font-bold">{filteredData.items.length}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-xs opacity-70">Total Bruto</p>
                        <p className="font-bold text-lg text-emerald-500">R$ {filteredData.total.toFixed(2)}</p>
                     </div>
                </div>
            </div>

            {/* 2.5 Percentage Selector (New Feature) */}
            <div className={`p-4 rounded-lg border ${darkMode ? 'bg-indigo-900/10 border-indigo-800' : 'bg-indigo-50 border-indigo-100'}`}>
                <label className="block text-xs font-bold uppercase mb-2 opacity-70 flex items-center gap-2">
                    <PieChart size={14}/> 
                    Parcela / Porcentagem
                </label>
                <div className="flex items-center gap-4">
                    <input 
                        type="range" 
                        min="1" 
                        max="100" 
                        value={importPercentage} 
                        onChange={e => setImportPercentage(Number(e.target.value))}
                        className="flex-1 accent-indigo-600 cursor-pointer"
                    />
                    <div className="w-20 text-right">
                        <span className="text-xl font-bold text-indigo-600">{importPercentage}%</span>
                    </div>
                </div>
                <p className="text-xs opacity-60 mt-1">
                    Use para receber apenas parte do valor agora (ex: 50% no Natal). 
                    Valor Aplicado: <strong>R$ {grossTotal.toFixed(2)}</strong>
                </p>
            </div>

            {/* 3. Deductions */}
            <div>
                <label className="block text-xs font-bold uppercase mb-2 opacity-70 flex items-center gap-2">
                    <AlertCircle size={14}/>
                    3. Descontos / Impostos (Opcional)
                </label>
                <div className={`p-4 rounded-lg border ${cardClass}`}>
                    <div className="flex gap-2 mb-3">
                        <input 
                            placeholder="Descrição" aria-label="Descrição"
                            className={`flex-1 p-2 text-sm rounded border ${inputClass}`}
                            value={deductionDesc}
                            onChange={e => setDeductionDesc(e.target.value)}
                        />
                        <input 
                            type="number"
                            placeholder="R$" aria-label="R$"
                            className={`w-24 p-2 text-sm rounded border ${inputClass}`}
                            value={deductionAmount}
                            onChange={e => setDeductionAmount(e.target.value)}
                        />
                        <button 
                            onClick={handleAddDeduction}
                            className="bg-red-500 text-white p-2 rounded hover:bg-red-600"
                         aria-label="Adicionar" title="Adicionar">
                            <Plus size={18} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {deductions.map(d => (
                            <div key={d.id} className={`flex justify-between items-center text-sm p-2 rounded ${darkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
                                <span>{d.description}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-red-500 font-bold">- R$ {d.amount.toFixed(2)}</span>
                                    <button onClick={() => handleRemoveDeduction(d.id)} className="text-gray-400 hover:text-red-500">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {deductions.length === 0 && <p className="text-xs text-center opacity-50 italic">Nenhum desconto.</p>}
                    </div>
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className={`p-5 border-t ${borderClass} bg-opacity-50`}>
            <div className="flex justify-between items-center mb-4">
                <div className="text-right w-full">
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Líquido a Importar</p>
                    <p className={`text-3xl font-bold ${netTotal > 0 ? 'text-emerald-500' : 'text-gray-500'}`}>
                        R$ {netTotal.toFixed(2)}
                    </p>
                </div>
            </div>
            
            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className={`flex-1 py-3 rounded-lg font-medium border ${darkMode ? 'border-slate-600 hover:bg-slate-800' : 'border-gray-300 hover:bg-gray-50'}`}
                >
                    Cancelar
                </button>
                <button 
                    onClick={handleConfirm}
                    disabled={grossTotal <= 0}
                    className={`flex-1 py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 ${grossTotal > 0 ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg' : 'bg-gray-400 cursor-not-allowed'}`}
                >
                    <CheckCircle size={20} />
                    Confirmar
                </button>
            </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default ImportCommissionsModal;
