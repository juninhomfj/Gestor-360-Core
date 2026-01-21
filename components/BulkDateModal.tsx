
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ProductType } from '../types';
import { Calendar, CheckCircle, AlertCircle, X, Filter } from 'lucide-react';

interface BulkDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    targetDate: string, 
    filterType: ProductType | 'ALL', 
    launchDateFrom: string, 
    onlyEmpty: boolean
  ) => void;
  darkMode?: boolean;
}

const BulkDateModal: React.FC<BulkDateModalProps> = ({ isOpen, onClose, onConfirm, darkMode }) => {
  const [targetDate, setTargetDate] = useState('');
  const [filterType, setFilterType] = useState<ProductType | 'ALL'>('ALL');
  const [launchDateFrom, setLaunchDateFrom] = useState('');
  const [onlyEmpty, setOnlyEmpty] = useState(true);

  if (!isOpen) return null;

  const bgClass = darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-gray-900';
  const inputBg = darkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900';

  const handleSubmit = () => {
    if (!targetDate) {
      alert("Defina a nova data de faturamento.");
      return;
    }
    if (!launchDateFrom) {
      alert("Defina a data de início do filtro (Lançado a partir de).");
      return;
    }

    if (confirm("Tem certeza? Essa ação atualizará várias vendas de uma vez.")) {
      onConfirm(targetDate, filterType, launchDateFrom, onlyEmpty);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className={`${bgClass} rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200`}>
        
        {/* Header */}
        <div className={`p-5 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'} flex justify-between items-center`}>
          <h2 className="text-lg font-bold flex items-center gap-2">
             <Calendar className="text-emerald-500" size={20} />
             Definir Faturamento em Massa
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500" aria-label="Fechar" title="Fechar">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
            
            <div className={`text-sm p-3 rounded border ${darkMode ? 'bg-amber-900/20 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p>Essa ferramenta define a <strong>Data de Faturamento</strong> para um grupo de vendas selecionado.</p>
                </div>
            </div>

            {/* Filter Section */}
            <div>
                <label className="block text-xs font-bold uppercase mb-2 flex items-center gap-1 opacity-70">
                    <Filter size={14}/> Filtros de Seleção
                </label>
                
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm mb-1">Tipo de Venda</label>
                        <select 
                            value={filterType}
                            onChange={(e) = aria-label="Selecionar"> setFilterType(e.target.value as any)}
                            className={`w-full p-2 rounded border text-sm ${inputBg}`}
                        >
                            <option value="ALL">Todos os Tipos</option>
                            <option value={ProductType.BASICA}>Cesta Básica</option>
                            <option value={ProductType.NATAL}>Cesta de Natal</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm mb-1">Lançados a partir de (Data Finalização)</label>
                        <input 
                            type="date" 
                            value={launchDateFrom}
                            onChange={(e) = /> setLaunchDateFrom(e.target.value)}
                            className={`w-full p-2 rounded border text-sm ${inputBg}`}
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                        <input 
                            type="checkbox" 
                            checked={onlyEmpty}
                            onChange={(e) = aria-label="Selecionar" /> setOnlyEmpty(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm">Considerar apenas vendas <strong>sem data</strong> de faturamento</span>
                    </label>
                </div>
            </div>

            <hr className={darkMode ? 'border-slate-700' : 'border-gray-200'} />

            {/* Action Section */}
            <div>
                <label className="block text-xs font-bold uppercase mb-2 text-emerald-600">
                    Nova Definição
                </label>
                <div>
                    <label className="block text-sm mb-1">Aplicar Data de Faturamento</label>
                    <input 
                        type="date" 
                        value={targetDate}
                        onChange={(e) = /> setTargetDate(e.target.value)}
                        className={`w-full p-2 rounded border text-sm ring-2 ring-emerald-500/20 ${inputBg}`}
                    />
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className={`p-5 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'} flex justify-end gap-3`}>
          <button 
            onClick={onClose}
            className={`px-4 py-2 rounded-lg border text-sm ${darkMode ? 'border-slate-600 hover:bg-slate-800' : 'border-gray-300 hover:bg-gray-50'}`}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm flex items-center shadow-md"
          >
            <CheckCircle size={18} className="mr-2" />
            Aplicar Alterações
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BulkDateModal;
