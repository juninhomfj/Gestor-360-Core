import React, { useState } from 'react';
import { Download, FileText, Database, Shield, CheckCircle, X } from 'lucide-react';
import { getStoredSales, getFinanceData, exportReportToCSV, exportEncryptedBackup } from '../services/logic';
import { Sale } from '../types';

interface DataExportWizardProps {
  onClose: () => void;
}

const DataExportWizard: React.FC<DataExportWizardProps> = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [backupPass, setBackupPass] = useState('');

  const handleExportSales = async (format: 'CSV' | 'JSON') => {
      setLoading(true);
      try {
          const sales = await getStoredSales();
          if (format === 'CSV') {
              const data = sales.map(s => ({
                  Cliente: s.client,
                  Data: s.date,
                  ValorVenda: s.valueSold,
                  Comissao: s.commissionValueTotal
              }));
              exportReportToCSV(data, 'meus_dados_vendas');
          } else {
              const blob = new Blob([JSON.stringify(sales, null, 2)], {type: 'application/json'});
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'meus_dados_vendas.json';
              a.click();
          }
      } finally {
          setLoading(false);
      }
  };

  const handleExportFinance = async () => {
      setLoading(true);
      try {
          const finData = await getFinanceData();
          const txs = finData.transactions || [];
          const data = txs.map(t => ({
              Data: t.date,
              Descricao: t.description,
              Valor: t.amount,
              Tipo: t.type
          }));
          exportReportToCSV(data, 'meus_dados_financeiros');
      } finally {
          setLoading(false);
      }
  };

  const handleFullBackup = async () => {
      if (!backupPass || backupPass.length < 4) {
          alert("Defina uma senha de pelo menos 4 caracteres para proteger seu backup.");
          return;
      }
      setLoading(true);
      try {
          await exportEncryptedBackup(backupPass);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700 animate-in zoom-in-95 dark:text-slate-100">
            
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Download className="text-blue-500"/> Exportação de Dados
                </h3>
                <button onClick={onClose} aria-label="Fechar" title="Fechar"><X className="text-gray-400 hover:text-gray-600"/></button>
            </div>

            <div className="p-6">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                    Seus dados são seus. Antes de excluir sua conta, recomendamos baixar uma cópia.
                    Selecione o que deseja exportar:
                </p>

                <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 hover:border-blue-300 transition-colors dark:text-slate-100">
                        <div className="flex items-start gap-3">
                            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded text-blue-600"><FileText size={20}/></div>
                            <div className="flex-1">
                                <h4 className="font-bold text-gray-800 dark:text-white">Relatórios Legíveis (Excel/CSV)</h4>
                                <p className="text-xs text-gray-500 mb-3">Ideal para leitura em planilhas.</p>
                                <div className="flex gap-2">
                                    <button onClick={() => handleExportSales('CSV')} disabled={loading} className="px-3 py-1.5 bg-white dark:bg-slate-700 border rounded text-xs font-bold hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors dark:text-slate-100">
                                        Baixar Vendas
                                    </button>
                                    <button onClick={handleExportFinance} disabled={loading} className="px-3 py-1.5 bg-white dark:bg-slate-700 border rounded text-xs font-bold hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors dark:text-slate-100">
                                        Baixar Financeiro
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 hover:border-emerald-300 transition-colors dark:text-slate-100">
                        <div className="flex items-start gap-3">
                            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded text-emerald-600"><Database size={20}/></div>
                            <div className="flex-1">
                                <h4 className="font-bold text-gray-800 dark:text-white">Backup Completo do Sistema (.v360)</h4>
                                <p className="text-xs text-gray-500 mb-3">Arquivo criptografado contendo tudo (Configurações, Vendas, Finanças). Pode ser restaurado depois.</p>
                                
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="password" 
                                        placeholder="Senha para o arquivo" aria-label="Senha para o arquivo" 
                                        className="border rounded px-3 py-1.5 text-sm w-40 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100"
                                        value={backupPass}
                                        onChange={e = /> setBackupPass(e.target.value)}
                                    />
                                    <button onClick={handleFullBackup} disabled={loading} className="px-4 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                                        {loading ? 'Gerando...' : 'Baixar Backup'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-slate-800/80 border-t border-gray-100 dark:border-slate-800 flex justify-end dark:text-slate-100">
                <button onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">
                    Fechar
                </button>
            </div>
        </div>
    </div>
  );
};

export default DataExportWizard;