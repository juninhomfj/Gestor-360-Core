
import React, { useState, useEffect, useRef } from 'react';
import { Transaction, FinanceAccount } from '../types';
import { X, CheckCircle, Calendar, Wallet, DollarSign, Paperclip, Trash2, FileText, Image as ImageIcon } from 'lucide-react';
import { fileToBase64 } from '../utils/fileHelper';

interface TransactionSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  accounts: FinanceAccount[];
  onConfirm: (transaction: Transaction, details: { accountId: string; amount: number; date: string; attachments?: string[] }) => void;
  darkMode?: boolean;
}

const TransactionSettleModal: React.FC<TransactionSettleModalProps> = ({ 
    isOpen, onClose, transaction, accounts, onConfirm, darkMode 
}) => {
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      if (isOpen && transaction) {
          setDate(new Date().toISOString().split('T')[0]); // Default to today for payment
          setAmount(transaction.amount.toString());
          setAccountId(transaction.accountId);
          setAttachments(transaction.attachments || []);
      }
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const handleConfirm = () => {
      const val = parseFloat(amount);
      if (isNaN(val) || val <= 0) {
          alert("Valor inválido");
          return;
      }
      if (!accountId) {
          alert("Selecione uma conta");
          return;
      }
      onConfirm(transaction, { accountId, amount: val, date, attachments });
      onClose();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          const file = files[0];
          // Limit size 5MB
          if (file.size > 5 * 1024 * 1024) {
              alert("Arquivo muito grande (Máx 5MB).");
              return;
          }
          try {
              const base64 = await fileToBase64(file);
              setAttachments([...attachments, base64]);
          } catch (error) {
              alert("Erro ao processar arquivo.");
          }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
      setAttachments(attachments.filter((_, i) => i !== index));
  };

  const bgClass = darkMode ? 'bg-slate-900 text-white' : 'bg-white text-gray-900';
  const inputClass = darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900';

  const isIncome = transaction.type === 'INCOME';

  const renderThumbnail = (att: string) => {
      if (att.startsWith('data:application/pdf')) {
          return (
              <div className="w-full h-full flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-500">
                  <FileText size={16} />
              </div>
          );
      }
      return <img src={att} className="w-full h-full object-cover" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className={`${bgClass} rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 border ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
        
        <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-lg flex items-center gap-2">
                <CheckCircle className={isIncome ? "text-emerald-500" : "text-red-500"} size={20} />
                {isIncome ? 'Receber Valor' : 'Pagar Conta'}
            </h3>
            <button onClick={onClose} aria-label="Fechar" title="Fechar"><X size={20} className="text-gray-400 hover:text-gray-500"/></button>
        </div>

        <div className="p-6 space-y-4">
            <div>
                <p className="text-xs font-bold uppercase opacity-50 mb-1">Descrição</p>
                <p className="font-medium text-lg truncate">{transaction.description}</p>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                    <Calendar size={16} className="text-blue-500"/> Data da Baixa
                </label>
                <input 
                    type="date" 
                    className={`w-full p-2.5 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${inputClass}`}
                    value={date}
                    onChange={e = /> setDate(e.target.value)}
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                    <Wallet size={16} className="text-purple-500"/> {isIncome ? 'Receber em' : 'Pagar com'}
                </label>
                <select 
                    className={`w-full p-2.5 rounded-lg border outline-none focus:ring-2 focus:ring-purple-500 ${inputClass}`}
                    value={accountId}
                    onChange={e = aria-label="Selecionar"> setAccountId(e.target.value)}
                >
                    {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance.toFixed(2)})</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                    <DollarSign size={16} className={isIncome ? "text-emerald-500" : "text-red-500"}/> Valor Efetivado
                </label>
                <input 
                    type="number" 
                    step="0.01"
                    className={`w-full p-2.5 rounded-lg border outline-none font-bold text-lg ${inputClass}`}
                    value={amount}
                    onChange={e = /> setAmount(e.target.value)}
                />
            </div>

            {/* Attachments Mini Section */}
            <div>
                <label className="block text-xs font-medium mb-2 flex items-center gap-2">
                    <Paperclip size={14}/> Comprovante / Recibo
                </label>
                <div className="flex gap-2 items-center flex-wrap">
                    {attachments.map((att, idx) => (
                        <div key={idx} className="relative w-8 h-8 bg-gray-100 dark:bg-slate-800 rounded overflow-hidden group border border-gray-300 dark:border-slate-600 dark:text-slate-100">
                            {renderThumbnail(att)}
                            <button onClick={() => removeAttachment(idx)} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={12}/>
                            </button>
                        </div>
                    ))}
                    <button onClick={() => fileInputRef.current?.click()} className={`w-8 h-8 rounded border-2 border-dashed flex items-center justify-center ${darkMode ? 'border-slate-600 hover:border-slate-400' : 'border-gray-300 hover:border-gray-400'}`}>
                        <Paperclip size={14} className="text-gray-500" />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileSelect} aria-label="Selecionar arquivo" />
                </div>
            </div>
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-slate-700 flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
            <button 
                onClick={handleConfirm}
                className={`flex-1 py-2.5 rounded-lg font-bold text-white shadow-lg transition-transform active:scale-95 ${isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
                Confirmar
            </button>
        </div>

      </div>
    </div>
  );
};

export default TransactionSettleModal;
