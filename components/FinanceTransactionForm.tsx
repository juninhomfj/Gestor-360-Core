import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FinanceAccount, CreditCard, Transaction, TransactionCategory, PersonType } from '../types';
import { X, Save, TrendingUp, TrendingDown, ArrowLeftRight, CreditCard as CardIcon, Wallet, Tag, Calendar, Building2, User, CheckCircle, Clock, Hash, AlignLeft, RefreshCw } from 'lucide-react';
import { auth } from '../services/firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void>;
  onSave?: (tx: Transaction) => Promise<void>;
  accounts: FinanceAccount[];
  cards: CreditCard[];
  categories: TransactionCategory[];
  initialType?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
}

const FinanceTransactionForm: React.FC<Props> = ({
  isOpen, onClose, onSaved, onSave, accounts, cards, categories, initialType = 'EXPENSE'
}) => {
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>(initialType);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPaid, setIsPaid] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState('MONTHLY');
  
  const [accountId, setAccountId] = useState('');
  const [targetAccountId, setTargetAccountId] = useState(''); 
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [personType, setPersonType] = useState<PersonType>('PF');
  const [cardId, setCardId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [installments, setInstallments] = useState(1);
  const [costCenter, setCostCenter] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (isOpen) {
        setType(initialType);
        if (accounts.length > 0 && !accountId) setAccountId(accounts[0].id);
    }
  }, [isOpen, initialType, accounts]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (amount <= 0) { alert("Informe um valor maior que zero."); return; }
    if (!description) { alert("Informe a descrição."); return; }
    if (!accountId) { alert("Selecione uma conta."); return; }
    if (type !== 'TRANSFER' && !categoryId) { alert("A categoria é obrigatória."); return; }

    const tx: Transaction = {
      id: crypto.randomUUID(),
      type: type as any,
      description,
      amount,
      date,
      realizedAt: isPaid ? date : undefined,
      accountId,
      targetAccountId: type === 'TRANSFER' ? targetAccountId : undefined,
      cardId: type === 'EXPENSE' ? cardId : null,
      categoryId: type === 'TRANSFER' ? 'TRANSFER' : (categoryId || 'uncategorized'),
      subcategory,
      personType,
      isPaid: cardId ? false : isPaid,
      provisioned: !isPaid,
      isRecurring,
      recurrenceRule: isRecurring ? recurrenceRule : undefined,
      paymentMethod: type === 'TRANSFER' ? 'TRANSFER' : paymentMethod,
      installments: cardId ? installments : 1,
      costCenter,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
      userId: auth.currentUser?.uid || ''
    };

    if (onSave) await onSave(tx);
    if (onSaved) await onSaved();
    onClose();
  };

  const filteredCategories = categories.filter(c => 
    (type === 'TRANSFER' ? false : c.type === (type as any)) &&
    (c.personType === personType || !c.personType)
  );

  const modalContent = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-2 md:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 my-auto dark:text-slate-100">
        
        <div className="p-1 bg-gray-100 dark:bg-slate-950 flex shrink-0 dark:text-slate-100">
          <button onClick={() => setType('INCOME')} className={`flex-1 flex items-center justify-center gap-2 py-4 font-black text-sm transition-all ${type === 'INCOME' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-md rounded-xl' : 'text-gray-400'}`}>
            <TrendingUp size={18}/> RECEITA
          </button>
          <button onClick={() => setType('EXPENSE')} className={`flex-1 flex items-center justify-center gap-2 py-4 font-black text-sm transition-all ${type === 'EXPENSE' ? 'bg-white dark:bg-slate-900 text-red-600 shadow-md rounded-xl' : 'text-gray-400'}`}>
            <TrendingDown size={18}/> DESPESA
          </button>
          <button onClick={() => setType('TRANSFER')} className={`flex-1 flex items-center justify-center gap-2 py-4 font-black text-sm transition-all ${type === 'TRANSFER' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-md rounded-xl' : 'text-gray-400'}`}>
            <ArrowLeftRight size={18}/> TRANSFERÊNCIA
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
                <div className="flex flex-col items-center mb-8">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Valor do Lançamento</span>
                    <div className="relative w-full max-w-[250px]">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-black opacity-30">R$</span>
                        <input type="number" step="0.01" className={`bg-transparent text-5xl font-black text-center w-full outline-none ${type === 'INCOME' ? 'text-emerald-500' : type === 'EXPENSE' ? 'text-red-500' : 'text-blue-500'}`} value={amount} onChange={e => setAmount(Number(e.target.value))} autoFocus />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                    <input className="w-full text-xl font-bold p-3 bg-transparent border-b-2 border-gray-100 dark:border-slate-800 outline-none focus:border-indigo-500 transition-colors dark:text-white" placeholder="Ex: Pagamento Fornecedor" value={description} onChange={e => setDescription(e.target.value)} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Conta</label>
                        <select className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none text-sm dark:text-white" value={accountId} onChange={e => setAccountId(e.target.value)}>
                            <option value="">Selecione...</option>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance.toFixed(2)})</option>)}
                        </select>
                    </div>
                    {type !== 'TRANSFER' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                            <select className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none text-sm dark:text-white" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                                <option value="">Selecione...</option>
                                {filteredCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                        <input type="date" className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none text-sm dark:text-white" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-2 cursor-pointer p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30 dark:text-slate-100">
                            <input type="checkbox" className="w-5 h-5 rounded text-indigo-600" checked={isPaid} onChange={e => setIsPaid(e.target.checked)} />
                            <span className="text-sm font-bold">{isPaid ? 'Lançamento Realizado' : 'Provisionar p/ Futuro'}</span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <AlignLeft size={14} /> Opções Avançadas
                </h3>

                <div className={`p-5 rounded-2xl border transition-all ${isRecurring ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-100 dark:border-slate-800'}`}>
                    <label className="flex items-center justify-between cursor-pointer mb-4">
                        <div className="flex items-center gap-2">
                            <RefreshCw size={18} className={isRecurring ? 'text-blue-500' : 'text-gray-400'} />
                            <span className="font-bold text-sm">Lançamento Recorrente</span>
                        </div>
                        <input type="checkbox" className="w-6 h-6 rounded-lg text-blue-600" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
                    </label>
                    
                    {isRecurring && (
                        <div className="space-y-3 animate-in fade-in">
                            <select className="w-full p-3 rounded-lg border dark:bg-slate-800 text-sm dark:text-slate-100" value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)}>
                                <option value="MONTHLY">Todo mês</option>
                                <option value="WEEKLY">Toda semana</option>
                                <option value="DAILY">Todo dia</option>
                                <option value="YEARLY">Todo ano</option>
                            </select>
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">O sistema gerará este lançamento automaticamente.</p>
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Classificação de Pessoa</label>
                    <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl dark:text-slate-100">
                        <button onClick={() => setPersonType('PF')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${personType === 'PF' ? 'bg-white dark:bg-slate-700 text-purple-600 shadow' : 'text-gray-500'}`}>Pessoal (PF)</button>
                        <button onClick={() => setPersonType('PJ')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${personType === 'PJ' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow' : 'text-gray-500'}`}>Empresa (PJ)</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Centro de Custo</label>
                        <input className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none text-sm dark:text-white" placeholder="Ex: Marketing" value={costCenter} onChange={e => setCostCenter(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tags</label>
                        <div className="relative">
                            <Hash size={14} className="absolute left-3 top-4 text-gray-400"/>
                            <input className="w-full pl-8 p-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none text-xs dark:text-white" placeholder="fixo, variável..." value={tags} onChange={e => setTags(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex gap-4 bg-gray-50 dark:bg-slate-950/50 shrink-0 dark:text-slate-100">
          <button onClick={onClose} className="flex-1 py-4 rounded-xl border border-gray-300 dark:border-slate-700 font-bold text-gray-500 hover:bg-gray-100 transition-all uppercase text-xs">Cancelar</button>
          <button onClick={handleSave} className={`flex-1 py-4 rounded-xl text-white font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 uppercase text-xs ${type === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700' : type === 'EXPENSE' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            <Save size={20}/> Gravar Lançamento
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default FinanceTransactionForm;