import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sale, ProductType, Client, SaleStatus } from '../types';
import { getStoredTable, computeCommissionValues, getClients, createClientAutomatically, createReceivableFromSale, getSystemConfig, DEFAULT_SYSTEM_CONFIG } from '../services/logic';
import { X, Calculator, AlertCircle, Truck, DollarSign, Clock, Users, Plus, Check } from 'lucide-react';
import { auth } from '../services/firebase';
import { Logger } from '../services/logger';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void>;
  onSave?: (sale: Sale) => Promise<void>;
  initialData?: Sale | null;
  isLocked?: boolean;
}

const SalesForm: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaved,
  onSave,
  initialData,
  isLocked
}) => {
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [clientName, setClientName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [productType, setProductType] = useState<ProductType>(ProductType.BASICA);
  const [status, setStatus] = useState<SaleStatus>('ORÇAMENTO');
  const [quantity, setQuantity] = useState(1);
  const [valueProposed, setValueProposed] = useState(0);
  const [valueSold, setValueSold] = useState(0);
  const [margin, setMargin] = useState(0);
  const [quoteDate, setQuoteDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [billDate, setBillDate] = useState('');
  const [isPendingBilling, setIsPendingBilling] = useState(false);
  const [autoCreateReceivable, setAutoCreateReceivable] = useState(false);
  const [observations, setObservations] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);

  const [commissionRate, setCommissionRate] = useState(0);
  const [commissionValue, setCommissionValue] = useState(0);
  const [commissionBase, setCommissionBase] = useState(0);
  const [showClientList, setShowClientList] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getClients().then(setAvailableClients);
      getSystemConfig()
        .then((config) => {
          const methods = (config?.paymentMethods || DEFAULT_SYSTEM_CONFIG.paymentMethods || []).filter(Boolean);
          setPaymentMethods(methods);
        })
        .catch(() => setPaymentMethods(DEFAULT_SYSTEM_CONFIG.paymentMethods || []));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!initialData) {
        setIsPendingBilling(false);
        setClientName('');
        setSelectedClientId('');
        setProductType(ProductType.BASICA);
        setStatus('ORÇAMENTO');
        setQuantity(1);
        setValueProposed(0);
        setValueSold(0);
        setMargin(0);
        setBillDate('');
        setObservations('');
        setTrackingCode('');
        setPaymentMethod('');
        setAutoCreateReceivable(false);
        return;
    }

    setClientName(initialData.client);
    setSelectedClientId(initialData.clientId || '');
    setProductType(initialData.type);
    setStatus(initialData.status || (initialData.date ? 'FATURADO' : 'ORÇAMENTO'));
    setQuantity(initialData.quantity);
    setValueProposed(initialData.valueProposed);
    setValueSold(initialData.valueSold || 0);
    setMargin(initialData.marginPercent || 0);
    setQuoteDate(initialData.quoteDate || '');
    setCloseDate(initialData.completionDate || '');
    setBillDate(initialData.date || '');
    setIsPendingBilling(!initialData.date);
    setObservations(initialData.observations || '');
    setTrackingCode(initialData.trackingCode || '');
    setPaymentMethod(initialData.paymentMethod || '');
    setAutoCreateReceivable(false);
  }, [initialData, isOpen]);

  useEffect(() => {
    if (isPendingBilling) {
      setAutoCreateReceivable(false);
    }
  }, [isPendingBilling]);

  useEffect(() => {
    if (!paymentMethod && paymentMethods.length > 0) {
      setPaymentMethod(paymentMethods[0]);
    }
  }, [paymentMethods, paymentMethod]);

  useEffect(() => {
    const calc = async () => {
      const rules = await getStoredTable(productType);
      const { commissionBase: base, commissionValue: val, rateUsed } =
        computeCommissionValues(quantity, valueProposed, margin, rules);

      setCommissionBase(base);
      setCommissionValue(val);
      setCommissionRate(rateUsed);
    };
    calc();
  }, [quantity, valueProposed, margin, productType]);

  const filteredClients = useMemo(() => {
      if (!clientName) return [];
      return availableClients.filter(c => c.name.toLowerCase().includes(clientName.toLowerCase()));
  }, [clientName, availableClients]);

  const handleSelectClient = (c: Client) => {
      setClientName(c.name);
      setSelectedClientId(c.id);
      setShowClientList(false);
  };

  const handleSave = async () => {
    if (!clientName || valueProposed <= 0 || (!isPendingBilling && !billDate)) {
      alert('Preencha cliente, valor proposto e data de faturamento (ou marque como pendente).');
      return;
    }
    if (paymentMethods.length > 0 && !paymentMethod) {
      alert('Selecione a forma de pagamento.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    let finalClientId = selectedClientId;

    if (!finalClientId) {
        const existing = availableClients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
        if (existing) {
            finalClientId = existing.id;
        } else {
            finalClientId = await createClientAutomatically(clientName);
        }
    }

    Logger.info(`Audit: Iniciando gravação de venda para [${clientName}]`);

    const finalBillDate = isPendingBilling ? "" : billDate;
    const isBilled = !isPendingBilling;
    const finalStatus: SaleStatus = isPendingBilling ? 'ORÇAMENTO' : 'FATURADO';

    const sale: Sale = {
      id: initialData?.id || crypto.randomUUID(),
      userId: uid,
      client: clientName,
      clientId: finalClientId,
      quantity,
      type: productType,
      status: finalStatus,
      valueProposed,
      valueSold,
      marginPercent: margin,
      quoteDate,
      completionDate: closeDate || new Date().toISOString().split('T')[0],
      date: finalBillDate,
      isBilled,
      hasNF: initialData?.hasNF || false,
      observations,
      trackingCode,
      paymentMethod,
      commissionBaseTotal: commissionBase,
      commissionValueTotal: commissionValue,
      commissionRateUsed: commissionRate,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      deleted: false
    };

    try {
        Logger.info("Audit: Venda preparada para persistência.", {
            saleId: sale.id,
            userId: sale.userId,
            deleted: sale.deleted,
            isBilled: sale.isBilled
        });
        if (onSave) await onSave(sale);
        Logger.info("Audit: Venda enviada para persistência.", {
            saleId: sale.id,
            userId: sale.userId
        });
        if (isBilled && autoCreateReceivable && !initialData) {
            await createReceivableFromSale(sale);
        }
        if (onSaved) await onSaved();
        onClose();
    } catch (e) {
        Logger.error("Audit: Erro ao gravar venda.", e);
        alert("Erro ao salvar. Verifique sua conexão.");
    }
  };

  if (!isOpen) return null;

  const inputClasses = "w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400";

  const modalContent = (
    <div 
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-4 overflow-y-auto"
        onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl max-h-[95vh] shadow-2xl flex flex-col border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden my-auto dark:text-slate-100">
        
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-950 shrink-0 dark:text-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
              <Calculator size={22} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {initialData ? 'Editar Venda' : 'Lançar Nova Venda'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
          {isLocked && (
            <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 flex items-center gap-3">
              <AlertCircle size={18} />
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Modo Somente Leitura</p>
                <p className="text-xs">O módulo de vendas está bloqueado para alterações.</p>
              </div>
            </div>
          )}
          <fieldset disabled={isLocked} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1 flex items-center gap-1">
                    <Users size={12}/> Cliente
                </label>
                <input
                  className={inputClasses}
                  placeholder="Nome do cliente ou empresa"
                  value={clientName}
                  onChange={e => { setClientName(e.target.value); setShowClientList(true); setSelectedClientId(''); }}
                  onFocus={() => setShowClientList(true)}
                />
                {showClientList && filteredClients.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl max-h-40 overflow-y-auto dark:text-slate-100">
                        {filteredClients.map(c => (
                            <button 
                                key={c.id} 
                                onClick={() => handleSelectClient(c)}
                                className="w-full text-left p-3 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-b last:border-0 dark:border-slate-700 flex justify-between items-center"
                            >
                                <span>{c.name}</span>
                                <Check size={14} className="text-emerald-500 opacity-0 group-hover:opacity-100"/>
                            </button>
                        ))}
                    </div>
                )}
                {!selectedClientId && clientName && filteredClients.length === 0 && (
                    <p className="text-[10px] text-emerald-500 font-bold mt-1 ml-1 animate-pulse">Novo cliente será criado!</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Tipo de Produto</label>
                <select
                  className={inputClasses}
                  value={productType}
                  onChange={e => setProductType(e.target.value as ProductType)}
                >
                  <option value={ProductType.BASICA}>Cesta Básica</option>
                  <option value={ProductType.NATAL}>Cesta de Natal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Forma de Pagamento</label>
                <select
                  className={inputClasses}
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {paymentMethods.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Cód. Rastreio / NF</label>
                <div className="relative">
                   <Truck className="absolute left-3 top-3.5 text-gray-400" size={16} />
                   <input
                    className={`${inputClasses} pl-10`}
                    placeholder="Código de rastreio ou número"
                    value={trackingCode}
                    onChange={e => setTrackingCode(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Qtd.</label>
                  <input
                    type="number"
                    className={inputClasses}
                    value={quantity}
                    onChange={e => setQuantity(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Margem %</label>
                  <input
                    type="number"
                    className={inputClasses}
                    value={margin}
                    onChange={e => setMargin(Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Valor Unitário Proposto (R$)</label>
                <input
                  type="number"
                  className={inputClasses}
                  value={valueProposed}
                  onChange={e => setValueProposed(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Valor Total Venda / NF (R$)</label>
                <div className="relative">
                   <DollarSign className="absolute left-3 top-3.5 text-gray-400" size={16} />
                   <input
                    type="number"
                    className={`${inputClasses} pl-10 border-indigo-200 dark:border-indigo-900/30`}
                    value={valueSold}
                    onChange={e => setValueSold(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2 ml-1 group">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isPendingBilling ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/20' : 'border-gray-300 dark:border-slate-600'}`}>
                        <input 
                            type="checkbox" 
                            className="hidden"
                            checked={isPendingBilling} 
                            onChange={e => setIsPendingBilling(e.target.checked)}
                        />
                        {isPendingBilling && <Clock size={12} className="text-white" />}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isPendingBilling ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                        Pendente de Faturamento
                    </span>
                </label>
                
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Data de Faturamento</label>
                <input
                  type="date"
                  className={`${inputClasses} ${isPendingBilling ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
                  value={isPendingBilling ? '' : billDate}
                  onChange={e => setBillDate(e.target.value)}
                  disabled={isPendingBilling}
                />
              </div>
              
              {!isPendingBilling && (
                  <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 dark:text-slate-100">
                    <div className="text-xs">
                        <p className="font-bold text-slate-600 dark:text-slate-300">Recebíveis via Importação Mensal</p>
                        <p className="text-slate-500 dark:text-slate-400">Os lançamentos de comissão são feitos por importação do período.</p>
                    </div>
                    <label className="flex items-start gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-emerald-600"
                            checked={autoCreateReceivable}
                            onChange={(e) => setAutoCreateReceivable(e.target.checked)}
                        />
                        <span>
                          Criar recebível automaticamente ao faturar esta venda.
                          <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            Gera um recebível pendente com o valor de comissão calculado.
                          </span>
                        </span>
                    </label>
                  </div>
              )}

              <div className={`p-4 rounded-xl flex items-start gap-3 transition-colors ${isPendingBilling ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30' : 'bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30'}`}>
                  {isPendingBilling ? (
                      <>
                        <Clock className="text-amber-500 shrink-0 mt-0.5" size={16} />
                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
                            Venda marcada como pendente. Ela não aparecerá nos gráficos de faturamento mensal até que você defina uma data.
                        </p>
                      </>
                  ) : (
                      <>
                        <AlertCircle className="text-indigo-500 shrink-0 mt-0.5" size={16} />
                        <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed font-medium">
                            Esta data define o mês em que a comissão será contabilizada no seu dashboard.
                        </p>
                      </>
                  )}
              </div>
            </div>
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Observações</label>
             <textarea 
               className={`${inputClasses} h-24 resize-none`}
               placeholder="Detalhes adicionais do pedido..."
               value={observations}
               onChange={e => setObservations(e.target.value)}
             />
          </div>
          </fieldset>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 bg-gray-50 dark:bg-slate-950 shrink-0 dark:text-slate-100">
          <div className="flex items-center gap-4">
            <div className="text-center md:text-left">
              <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Base de Comissão</span>
              <p className="text-lg font-bold text-gray-700 dark:text-gray-300">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(commissionBase)}
              </p>
            </div>
            <div className="w-px h-8 bg-gray-200 dark:bg-slate-800 dark:text-slate-100"></div>
            <div className="text-center md:text-left">
              <span className={`block text-[10px] font-black uppercase tracking-widest ${isPendingBilling ? 'text-amber-500' : 'text-emerald-500'}`}>
                {isPendingBilling ? 'Comissão Prevista (Pend.)' : 'Comissão Prevista'}
              </span>
              <p className={`text-2xl font-black ${isPendingBilling ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(commissionValue)}
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={onClose}
              className="flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button 
              disabled={isLocked}
              onClick={handleSave}
              className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-white ${isPendingBilling ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isPendingBilling ? 'Salvar Pendência' : 'Gravar Venda'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default SalesForm;
