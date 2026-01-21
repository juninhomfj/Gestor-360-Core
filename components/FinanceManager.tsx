
import React, { useState, useMemo } from 'react';
import { FinanceAccount, CreditCard, Transaction, PersonType } from '../types';
import { CreditCard as CardIcon, Wallet, Plus, Trash2, Edit2, CheckCircle, X, EyeOff, Save, Building2, User, ArrowLeftRight, Calendar } from 'lucide-react';
// Fix: Added 'getInvoiceMonth' to imports as it is now correctly exported from services/logic
import { getInvoiceMonth } from '../services/logic';
import { auth } from '../services/firebase';

interface FinanceManagerProps {
  accounts: FinanceAccount[];
  cards: CreditCard[];
  transactions: Transaction[]; // Added to calc invoice
  onUpdate: (acc: FinanceAccount[], trans: Transaction[], cards: CreditCard[]) => void;
  onPayInvoice: (cardId: string, accountId: string, amount: number, date: string) => void;
  darkMode?: boolean;
  onNotify?: (type: 'SUCCESS' | 'ERROR', msg: string) => void;
}

const FinanceManager: React.FC<FinanceManagerProps> = ({ 
    accounts = [], cards = [], transactions = [], onUpdate, onPayInvoice, darkMode, onNotify 
}) => {
  // Account Form
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<FinanceAccount['type']>('CHECKING');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccIsAccounting, setNewAccIsAccounting] = useState(true);
  const [newAccDistribution, setNewAccDistribution] = useState(false); // NEW
  const [newAccPersonType, setNewAccPersonType] = useState<PersonType>('PF');

  // Card Form
  const [isCardFormOpen, setIsCardFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [newCardName, setNewCardName] = useState('');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardPersonType, setNewCardPersonType] = useState<PersonType>('PF');
  const [newCardClosing, setNewCardClosing] = useState('10');
  const [newCardDue, setNewCardDue] = useState('15');

  // Invoice Payment Modal
  const [invoiceModal, setInvoiceModal] = useState<{ isOpen: boolean, cardId: string, amount: number } | null>(null);
  const [payAccount, setPayAccount] = useState(accounts[0]?.id || '');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  // Invoice Details Modal
  const [detailsModal, setDetailsModal] = useState<{ card: CreditCard } | null>(null);

  // --- LOGIC: ACCOUNTS ---

  const openAccountForm = (acc?: FinanceAccount) => {
      if (acc) {
          setEditingAccount(acc);
          setNewAccName(acc.name);
          setNewAccType(acc.type);
          setNewAccBalance(acc.balance.toString());
          setNewAccIsAccounting(acc.isAccounting !== false);
          setNewAccDistribution(acc.includeInDistribution || false);
          setNewAccPersonType(acc.personType || 'PF');
      } else {
          setEditingAccount(null);
          setNewAccName('');
          setNewAccType('CHECKING');
          setNewAccBalance('');
          setNewAccIsAccounting(true);
          setNewAccDistribution(false);
          setNewAccPersonType('PF');
      }
      setIsAccountFormOpen(true);
  };

  const handleSaveAccount = () => {
      if (!newAccName.trim()) {
          alert("Por favor, insira o nome da conta.");
          return;
      }
      const balanceVal = parseFloat(newAccBalance);
      const finalBalance = isNaN(balanceVal) ? 0 : balanceVal;

      if (editingAccount) {
          // Edit
          const updatedAccounts = accounts.map(a => a.id === editingAccount.id ? {
              ...a,
              name: newAccName,
              type: newAccType,
              balance: finalBalance, 
              isAccounting: newAccIsAccounting,
              includeInDistribution: newAccDistribution,
              personType: newAccPersonType
          } : a);
          onUpdate(updatedAccounts, transactions, cards);
          if(onNotify) onNotify('SUCCESS', 'Conta atualizada!');
      } else {
          // Create
          // Fix: Included missing required properties for FinanceAccount
          const newAcc: FinanceAccount = {
              id: crypto.randomUUID(),
              name: newAccName,
              type: newAccType,
              balance: finalBalance,
              color: 'blue',
              isAccounting: newAccIsAccounting,
              includeInDistribution: newAccDistribution,
              personType: newAccPersonType,
              isActive: true,
              deleted: false,
              createdAt: new Date().toISOString(),
              userId: auth.currentUser?.uid || ''
          };
          onUpdate([...accounts, newAcc], transactions, cards);
          if(onNotify) onNotify('SUCCESS', 'Conta adicionada!');
      }
      
      setIsAccountFormOpen(false);
      setEditingAccount(null);
      setNewAccName('');
      setNewAccBalance('');
  };

  const handleDeleteAccount = (id: string) => {
      if(confirm('Tem certeza? Isso pode afetar o histórico de transações vinculadas a esta conta.')) {
          onUpdate(accounts.filter(a => a.id !== id), transactions, cards);
      }
  };

  // --- LOGIC: CARDS ---

  const openCardForm = (card?: CreditCard) => {
      if (card) {
          setEditingCard(card);
          setNewCardName(card.name);
          setNewCardLimit(card.limit.toString());
          setNewCardPersonType(card.personType || 'PF');
          setNewCardClosing(card.closingDay.toString());
          setNewCardDue(card.dueDay.toString());
      } else {
          setEditingCard(null);
          setNewCardName('');
          setNewCardLimit('');
          setNewCardPersonType('PF');
          setNewCardClosing('10');
          setNewCardDue('15');
      }
      setIsCardFormOpen(true);
  };

  const handleSaveCard = () => {
      if (!newCardName.trim()) {
          alert("Por favor, insira o nome do cartão.");
          return;
      }
      const limitVal = parseFloat(newCardLimit);
      if (isNaN(limitVal) || limitVal < 0) {
          alert("Insira um limite válido.");
          return;
      }

      if (editingCard) {
          // Edit
          const updatedCards = cards.map(c => c.id === editingCard.id ? {
              ...c,
              name: newCardName,
              limit: limitVal,
              personType: newCardPersonType,
              closingDay: parseInt(newCardClosing) || 10,
              dueDay: parseInt(newCardDue) || 15
          } : c);
          onUpdate(accounts, transactions, updatedCards);
          if(onNotify) onNotify('SUCCESS', 'Cartão atualizado!');
      } else {
          // Create
          // Fix: Included missing required properties for CreditCard
          const newCard: CreditCard = {
              id: crypto.randomUUID(),
              name: newCardName,
              limit: limitVal,
              currentInvoice: 0,
              closingDay: parseInt(newCardClosing) || 10,
              dueDay: parseInt(newCardDue) || 15,
              color: 'purple',
              personType: newCardPersonType,
              isActive: true,
              deleted: false,
              userId: auth.currentUser?.uid || ''
          };
          onUpdate(accounts, transactions, [...cards, newCard]);
          if(onNotify) onNotify('SUCCESS', 'Cartão adicionado!');
      }

      setIsCardFormOpen(false);
      setEditingCard(null);
      setNewCardName('');
      setNewCardLimit('');
  };

  const handleDeleteCard = (id: string) => {
      if(confirm('Excluir cartão?')) {
          onUpdate(accounts, transactions, cards.filter(c => c.id !== id));
      }
  };

  // --- LOGIC: INVOICE ---

  // Total Used Limit: Sum of all unpaid expenses, regardless of invoice month
  const calculateUsedLimit = (cardId: string) => {
      return transactions
        .filter(t => t.cardId === cardId && !t.isPaid && t.type === 'EXPENSE')
        .reduce((acc, t) => acc + t.amount, 0);
  };

  const handleConfirmPayment = () => {
      if (invoiceModal && payAccount) {
          onPayInvoice(invoiceModal.cardId, payAccount, invoiceModal.amount, payDate);
          setInvoiceModal(null);
      }
  };

  const getCardInvoicesByMonth = (cardId: string, closingDay: number) => {
      const cardTrans = transactions.filter(t => t.cardId === cardId && !t.isPaid && t.type === 'EXPENSE');
      const invoices: Record<string, number> = {};
      
      cardTrans.forEach(t => {
          // Group by Invoice Month logic
          const key = getInvoiceMonth(t.date, closingDay);
          invoices[key] = (invoices[key] || 0) + t.amount;
      });

      // Convert to array and sort
      return Object.entries(invoices)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, val]) => ({ month: key, total: val }));
  };

  // --- STYLES ---
  const textClass = darkMode ? 'text-slate-200' : 'text-gray-900';
  const containerClass = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm';
  const inputClass = darkMode ? 'bg-black border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900';

  const PersonTypeToggle = ({ value, onChange }: { value: PersonType, onChange: (v: PersonType) => void }) => (
      <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1 gap-1 dark:text-slate-100">
          <button
              type="button"
              onClick={() => onChange('PF')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${value === 'PF' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
              <User size={16} /> Pessoal
          </button>
          <button
              type="button"
              onClick={() => onChange('PJ')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${value === 'PJ' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
              <Building2 size={16} /> Empresa
          </button>
      </div>
  );

  return (
    <div className="space-y-8 relative">
      <div>
        <h1 className={`text-3xl font-bold ${textClass} mb-2`}>Contas & Cartões</h1>
        <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Gerencie contas Pessoa Física (PF) e Jurídica (PJ).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* ACCOUNTS SECTION */}
          <div className={`${containerClass} rounded-xl border p-6`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className={`font-bold text-xl flex items-center gap-2 ${textClass}`}>
                        <Wallet className="text-blue-500" /> Contas Bancárias
                    </h3>
                    <button 
                        onClick={() => openAccountForm()}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                        title="Nova Conta"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="space-y-3">
                    {accounts.map(acc => (
                        <div key={acc.id} className={`p-4 rounded-lg border flex justify-between items-center relative overflow-hidden ${darkMode ? 'border-slate-700 bg-slate-800/30' : 'border-gray-200 bg-gray-50'}`}>
                            {/* Type Indicator (Background Layer) */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 z-0 ${acc.personType === 'PJ' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                            
                            <div className="pl-3 relative z-10">
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold block ${textClass} flex items-center gap-2`}>
                                        {acc.name} 
                                        {!acc.isAccounting && (
                                            <span title="Não Contábil (Ignorado no Dashboard)" className="flex items-center text-gray-400">
                                                <EyeOff size={14} />
                                            </span>
                                        )}
                                        {acc.includeInDistribution && (
                                            <span title="Disponível para Distribuição de Lucros" className="flex items-center text-emerald-500">
                                                <ArrowLeftRight size={14} />
                                            </span>
                                        )}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${acc.personType === 'PJ' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'}`}>
                                        {acc.personType || 'PF'}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-500 uppercase">{acc.type}</span>
                            </div>
                            <div className="flex items-center gap-3 relative z-10">
                                <span className={`font-mono font-bold mr-2 ${acc.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    R$ {acc.balance.toFixed(2)}
                                </span>
                                <button onClick={() => openAccountForm(acc)} className="text-amber-500 hover:text-amber-600 p-2 rounded hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors cursor-pointer" title="Editar">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDeleteAccount(acc.id)} className="text-red-500 hover:text-red-600 p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer" title="Excluir">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {accounts.length === 0 && <p className="text-gray-500 text-center py-4">Nenhuma conta cadastrada.</p>}
                </div>

                {isAccountFormOpen && (
                    <div className={`mt-4 p-4 rounded-lg border animate-in slide-in-from-top-2 ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-blue-100 bg-blue-50'}`}>
                        <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                            {editingAccount ? <Edit2 size={16}/> : <Plus size={16}/>}
                            {editingAccount ? 'Editar Conta' : 'Nova Conta'}
                        </h4>
                        <div className="space-y-3">
                            <PersonTypeToggle value={newAccPersonType} onChange={setNewAccPersonType} />
                            
                            <input 
                                placeholder="Nome da Conta (ex: Nubank PF)" aria-label="Nome da Conta (ex: Nubank PF)" 
                                className={`w-full p-2 rounded border ${inputClass}`}
                                value={newAccName} onChange={e => setNewAccName(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <select 
                                    className={`flex-1 p-2 rounded border ${inputClass}`}
                                    value={newAccType} onChange={e => setNewAccType(e.target.value as any)}
                                >
                                    <option value="CHECKING">Corrente</option>
                                    <option value="SAVINGS">Poupança</option>
                                    <option value="INVESTMENT">Investimento</option>
                                    <option value="CASH">Dinheiro</option>
                                    <option value="INTERNAL">Interna (Cofre)</option>
                                </select>
                                <input 
                                    type="number" placeholder="Saldo Atual" aria-label="Saldo Atual" 
                                    className={`flex-1 p-2 rounded border ${inputClass}`}
                                    value={newAccBalance} onChange={e => setNewAccBalance(e.target.value)}
                                />
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-black/5 dark:hover:bg-white/5">
                                    <input 
                                        type="checkbox" 
                                        checked={newAccIsAccounting}
                                        onChange={e => setNewAccIsAccounting(e.target.checked)}
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <div className="text-sm">
                                        <span className={`block font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Considerar no Patrimônio Total?</span>
                                        <span className="text-xs text-gray-500">Desmarque se não deve somar no dashboard.</span>
                                    </div>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-black/5 dark:hover:bg-white/5">
                                    <input 
                                        type="checkbox" 
                                        checked={newAccDistribution}
                                        onChange={e => setNewAccDistribution(e.target.checked)}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <div className="text-sm">
                                        <span className={`block font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Habilitar na Distribuição?</span>
                                        <span className="text-xs text-gray-500">Marque para permitir transferir lucros para esta conta.</span>
                                    </div>
                                </label>
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                                <button onClick={() => setIsAccountFormOpen(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3">Cancelar</button>
                                <button onClick={handleSaveAccount} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors">
                                    <Save size={16} /> Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
          </div>

          {/* CARDS SECTION */}
          <div className={`${containerClass} rounded-xl border p-6`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className={`font-bold text-xl flex items-center gap-2 ${textClass}`}>
                        <CardIcon className="text-purple-500" /> Cartões de Crédito
                    </h3>
                    <button 
                        onClick={() => openCardForm()}
                        className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-sm transition-colors"
                        title="Nova Cartão"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    {(cards || []).map(card => {
                        const usedLimit = calculateUsedLimit(card.id);
                        const available = card.limit - usedLimit;
                        const percent = card.limit > 0 ? Math.min((usedLimit / card.limit) * 100, 100) : 0;

                        return (
                            <div key={card.id} className={`p-4 rounded-lg border relative overflow-hidden ${darkMode ? 'border-slate-700 bg-slate-800/30' : 'border-gray-50 bg-gray-50'}`}>
                                {/* Type Indicator (Z-index 0) */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 z-0 ${card.personType === 'PJ' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>

                                <div className="flex justify-between items-start mb-3 pl-3 relative z-10">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold block ${textClass}`}>{card.name}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${card.personType === 'PJ' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'}`}>
                                                {card.personType || 'PF'}
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-500">Limite: R$ {card.limit.toFixed(2)} • Fecha dia {card.closingDay}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setDetailsModal({ card })} className="text-blue-500 hover:text-blue-600 p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer" title="Ver Detalhes">
                                            <Calendar size={18} />
                                        </button>
                                        <button onClick={() => openCardForm(card)} className="text-amber-500 hover:text-amber-600 p-2 rounded hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors cursor-pointer" title="Editar">
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => handleDeleteCard(card.id)} className="text-red-500 hover:text-red-600 p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer" title="Excluir">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 pl-3 relative z-10">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span className="text-gray-500">Limite Utilizado</span>
                                        <span className="text-purple-600 font-bold">R$ {usedLimit.toFixed(2)}</span>
                                    </div>
                                    <div className={`h-2 w-full rounded-full overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-gray-200'}`}>
                                        <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>Disponível: <strong className="text-emerald-500">R$ {available.toFixed(2)}</strong></span>
                                        <span>{percent.toFixed(0)}% uso</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {(cards || []).length === 0 && <p className="text-gray-500 text-sm italic text-center py-4">Nenhum cartão cadastrado.</p>}
                </div>

                {isCardFormOpen && (
                    <div className={`mt-4 p-4 rounded-lg border animate-in slide-in-from-top-2 ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-purple-100 bg-purple-50'}`}>
                        <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                            {editingCard ? <Edit2 size={16}/> : <Plus size={16}/>}
                            {editingCard ? 'Editar Cartão' : 'Novo Cartão'}
                        </h4>
                        <div className="space-y-3">
                            <PersonTypeToggle value={newCardPersonType} onChange={setNewCardPersonType} />

                            <input 
                                placeholder="Nome do Cartão (ex: Visa Infinite PJ)" aria-label="Nome do Cartão (ex: Visa Infinite PJ)" 
                                className={`w-full p-2 rounded border ${inputClass}`}
                                value={newCardName} onChange={e => setNewCardName(e.target.value)}
                            />
                            <input 
                                type="number" placeholder="Limite Total" aria-label="Limite Total" 
                                className={`w-full p-2 rounded border ${inputClass}`}
                                value={newCardLimit} onChange={e => setNewCardLimit(e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Dia Fechamento</label>
                                    <input type="number" min="1" max="31" className={`w-full p-2 rounded border ${inputClass}`} value={newCardClosing} onChange={e => setNewCardClosing(e.target.value)}/>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Dia Vencimento</label>
                                    <input type="number" min="1" max="31" className={`w-full p-2 rounded border ${inputClass}`} value={newCardDue} onChange={e => setNewCardDue(e.target.value)}/>
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                                <button onClick={() => setIsCardFormOpen(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3">Cancelar</button>
                                <button onClick={handleSaveCard} className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-purple-700 transition-colors">
                                    <Save size={16} /> Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
          </div>
      </div>

      {/* DETAILS MODAL (Faturas Futuras) */}
      {detailsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className={`${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'} border rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95`}>
                  <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-slate-700 pb-2">
                      <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Previsão de Faturas</h3>
                      <button onClick={() => setDetailsModal(null)} className="text-gray-400 hover:text-gray-500"><X size={20}/></button>
                  </div>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {getCardInvoicesByMonth(detailsModal.card.id, detailsModal.card.closingDay).map((inv, idx) => (
                          <div key={idx} className={`flex justify-between items-center p-3 rounded border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                              <div>
                                  <span className={`block font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                      {new Date(inv.month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                  </span>
                                  <span className="text-xs text-gray-500">Vence dia {detailsModal.card.dueDay}</span>
                              </div>
                              <span className="font-bold font-mono text-purple-500 text-lg">R$ {inv.total.toFixed(2)}</span>
                          </div>
                      ))}
                      {getCardInvoicesByMonth(detailsModal.card.id, detailsModal.card.closingDay).length === 0 && (
                          <p className="text-gray-500 text-center py-4 text-sm">Sem faturas em aberto.</p>
                      )}
                  </div>
                  
                  <div className="mt-4 pt-2 border-t border-gray-200 dark:border-slate-700 text-xs text-gray-500 text-center">
                      Considera dia de fechamento ({detailsModal.card.closingDay}) para alocar a despesa.
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default FinanceManager;