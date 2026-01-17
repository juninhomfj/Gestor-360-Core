
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ImportMapping } from '../types';
import { X, ArrowRight, Check, AlertTriangle, DollarSign } from 'lucide-react';

interface FinanceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileData: any[][];
  onConfirm: (mapping: ImportMapping) => void;
  darkMode?: boolean;
}

const FINANCE_FIELDS = [
  { key: 'date', label: 'Data', required: true },
  { key: 'description', label: 'Descrição', required: true },
  { key: 'amount', label: 'Valor', required: true },
  { key: 'type', label: 'Tipo (Receita/Despesa)', required: false }, // Can auto-detect by signal
  { key: 'category', label: 'Categoria', required: false },
  { key: 'account', label: 'Conta/Cartão', required: false },
  { key: 'person', label: 'Pessoa (PF/PJ)', required: false },
];

const FinanceImportModal: React.FC<FinanceImportModalProps> = ({ isOpen, onClose, fileData, onConfirm, darkMode }) => {
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRow, setPreviewRow] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && fileData && fileData.length > 0) {
      const headerRow = fileData[0].map(cell => String(cell || '').trim());
      setHeaders(headerRow);
      
      if (fileData.length > 1) {
        setPreviewRow(fileData[1]);
      } else {
        setPreviewRow([]);
      }

      // Auto-guess
      const initialMap: ImportMapping = {};
      FINANCE_FIELDS.forEach(field => {
        const index = headerRow.findIndex(h => 
          h && h.toLowerCase().includes(field.label.toLowerCase().split(' ')[0])
        );
        if (index !== -1) initialMap[field.key] = index;
        else initialMap[field.key] = -1;
      });
      setMapping(initialMap);
    }
  }, [isOpen, fileData]);

  const handleMapChange = (fieldKey: string, colIndex: number) => {
    setMapping(prev => ({ ...prev, [fieldKey]: colIndex }));
  };

  const handleConfirm = () => {
    const missing = FINANCE_FIELDS.filter(f => f.required && (mapping[f.key] === undefined || mapping[f.key] === -1));
    if (missing.length > 0) {
      alert(`Campos obrigatórios faltando: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    onConfirm(mapping);
  };

  if (!isOpen) return null;

  const bgClass = darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-gray-900';
  const borderClass = darkMode ? 'border-slate-700' : 'border-gray-200';
  const inputBg = darkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-2 md:p-4 backdrop-blur-sm">
      <div className={`${bgClass} rounded-xl shadow-2xl w-full max-w-4xl h-[95vh] md:h-auto md:max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200`}>
        
        {/* Header */}
        <div className={`p-4 md:p-6 border-b ${borderClass} flex justify-between items-center shrink-0`}>
          <div>
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <DollarSign size={20} className="text-blue-500"/> Importar Extrato Financeiro
            </h2>
            <p className={`text-xs md:text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                Mapeie as colunas do seu extrato bancário ou planilha.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin">
          
          <div className={`p-4 rounded-lg border flex gap-3 ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50 border-blue-100'}`}>
             <AlertTriangle size={20} className="text-blue-500 shrink-0 mt-0.5" />
             <div className="text-xs md:text-sm opacity-80">
                 <p className="font-bold mb-1">Como funciona?</p>
                 <ul className="list-disc list-inside space-y-1">
                    <li>Se o <strong>Valor</strong> for negativo (ex: -100), será lançado como <strong>Despesa</strong>.</li>
                    <li>Se for positivo (ex: 1000), será lançado como <strong>Receita</strong>.</li>
                    <li>Você pode forçar o tipo usando a coluna "Tipo" (valores aceitos: Entrada, Saída, Receita, Despesa).</li>
                 </ul>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {FINANCE_FIELDS.map(field => {
                const selectedIdx = mapping[field.key] ?? -1;
                const previewValue = selectedIdx !== -1 && previewRow[selectedIdx] !== undefined 
                    ? String(previewRow[selectedIdx]) 
                    : '-';

                return (
                    <div key={field.key} className={`p-3 rounded-lg border transition-all ${borderClass} ${darkMode ? 'bg-slate-800/30' : 'bg-gray-50 hover:bg-white hover:shadow-sm'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            {selectedIdx !== -1 && <Check size={14} className="text-blue-500"/>}
                        </div>
                        
                        <div className="space-y-2">
                            <select 
                                className={`w-full text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
                                value={selectedIdx}
                                onChange={(e) => handleMapChange(field.key, Number(e.target.value))}
                            >
                                <option value={-1}>-- Ignorar --</option>
                                {headers.map((h, idx) => (
                                    <option key={idx} value={idx}>
                                        {h} (Col {idx + 1})
                                    </option>
                                ))}
                            </select>

                            <div className={`text-xs p-2 rounded border ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-gray-200 text-gray-500'}`}>
                                <span className="block text-[10px] uppercase font-bold opacity-50 mb-0.5">Exemplo:</span>
                                <div className="font-mono truncate h-4" title={previewValue}>
                                    {previewValue}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className={`p-4 md:p-6 border-t ${borderClass} flex flex-col sm:flex-row justify-end gap-3 shrink-0 bg-opacity-50 ${darkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
          <button 
            onClick={onClose}
            className={`w-full sm:w-auto px-6 py-3 rounded-lg border font-bold text-sm transition-colors ${darkMode ? 'border-slate-600 hover:bg-slate-800' : 'border-gray-300 hover:bg-white text-gray-700'}`}
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm}
            className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
          >
            Processar Lançamentos <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FinanceImportModal;
