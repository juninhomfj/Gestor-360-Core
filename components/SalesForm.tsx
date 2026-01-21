import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sale, ProductType, Client, SaleStatus, CommissionRule } from '../types';
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
  rulesBasic?: CommissionRule[];
  rulesNatal?: CommissionRule[];
}

const SalesForm: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaved,
  onSave,
  initialData,
  isLocked,
  rulesBasic = [],
  rulesNatal = []
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
  const [quoteNumber, setQuoteNumber] = useState('');
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
  const parseNumericInput = (value: string) => (value == "" ? 0 : Number(value));
  const commissionRatePercent = useMemo(() => {
    if (!commissionRate) return 0;
    return commissionRate <= 1 ? commissionRate * 100 : commissionRate;
  }, [commissionRate]);

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
        setQuoteNumber('');
        setQuoteDate(new Date().toISOString());
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
    setQuoteNumber(initialData.quoteNumber || '');
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

  const activeRules = useMemo(
    () => (productType === ProductType.NATAL ? rulesNatal : rulesBasic),
    [productType, rulesBasic, rulesNatal]
  );

  useEffect(() => {
    let isActive = true;
    const calc = async () => {
      const fallbackRules = activeRules?.length ? activeRules : [];
      const { commissionBase: baseCached, commissionValue: valCached, rateUsed: rateCached } =
        computeCommissionValues(quantity, valueProposed, margin, fallbackRules);
      if (fallbackRules.length > 0) {
        setCommissionBase(baseCached);
        setCommissionValue(valCached);
        setCommissionRate(rateCached);
      }

      const rules = await getStoredTable(productType);
      if (!isActive) return;
      const resolvedRules = rules.length > 0 ? rules : fallbackRules;
      const { commissionBase: base, commissionValue: val, rateUsed } =
        computeCommissionValues(quantity, valueProposed, margin, resolvedRules);

      setCommissionBase(base);
      setCommissionValue(val);
      setCommissionRate(rateUsed);
    };
    calc();
    return () => {
      isActive = false;
    };
  }, [quantity, valueProposed, margin, productType, activeRules]);

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
      quoteNumber,
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

  const inputClasses = "w-full p-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-slate-100 placeholder:text-slate-400";
  const isNatal = productType === ProductType.NATAL;

  const modalContent = (
    <div 
        className="fixed inset-0 z-[1000] flex items-start md:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 md:p-6 overflow-y-auto"
        onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-950 rounded-2xl md:rounded-3xl w-full max-w-5xl max-h-[92vh] shadow-2xl flex flex-col border border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden my-auto text-slate-100">
        
        <div className="p-5 md:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isNatal ? 'bg-red-900/40 text-red-300' : 'bg-emerald-900/40 text-emerald-300'}`}>
              <Calculator size={22} />
            </div>
            <h2 className="text-xl font-bold text-white">
              {initialData ? 'Editar Venda' : 'Lançar Nova Venda'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-8 space-y-8 custom-scrollbar">
          {isLocked && (
            <div className="p-4 rounded-2xl border border-amber-800/60 bg-amber-900/20 text-amber-200 flex items-center gap-3">
              <AlertCircle size={18} />
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Modo Somente Leitura</p>
                <p className="text-xs">O módulo de vendas está bloqueado para alterações.</p>
              </div>
            </div>
          )}
          <fieldset disabled={isLocked} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1 ml-1">Tipo de Produto</label>
                <select
                  className={inputClasses}
                  value={productType}
                  onChange={e => setProductType(e.target.value as ProductType)}
                >
                  <option value={ProductType.BASICA}>Cesta BÃ¡sica</option>
                  <option value={ProductType.NATAL}>Cesta de Natal</option>
                </select>
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1 ml-1 flex items-center gap-1">
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
                    <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                        {filteredClients.map(c => (
                            <button 
                                key={c.id} 
                                onClick={() => handleSelectClient(c)}
                                className="group w-full text-left p-3 text-sm hover:bg-emerald-900/20 border-b last:border-0 border-slate-700 flex justify-between items-center text-slate-100"
                            >
                                <span>{c.name}</span>
                                <Check size={14} className="text-emerald-500 opacity-0 group-hover:opacity-100"/>
                            </button>
                        ))}
                    </div>
                )}
                {!selectedClientId && clientName && filteredClients.length === 0 && (
                    <p className="text-[10px] text-emerald-400 font-bold mt-1 ml-1 animate-pulse">Novo cliente serÃ¡ criado!</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1 ml-1">NÃºmero do OrÃ§amento</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={inputClasses}
                  value={quoteNumber}
                  onChange={e => setQuoteNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1 ml-1">Qtd.</label>
                <input
                  type="number"
                  className={inputClasses}
                  value={quantity === 0 ? "" : quantity}
                  onChange={e => setQuantity(parseNumericInput(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1 ml-1">Valor Proposto (R$)</label>
                <input
                  type="number"
                  className={inputClasses}
                  value={valueProposed === 0 ? "" : valueProposed}
                  onChange={e => setValueProposed(parseNumericInput(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1 ml-1">Valor Total Venda / NF (R$)</label>
                <div className="relative">
                   <DollarSign className="absolute left-3 top-3.5 text-slate-400" size={16} />
                   <input
                    type="number"
                    className={`${inputClasses} pl-10 border-indigo-900/40`}
                    value={valueSold === 0 ? "" : valueSold}
                    onChange={e => setValueSold(parseNumericInput(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1 ml-1">Margem %</label>
                <input
                  type="number"
                  className={inputClasses}
                  value={margin === 0 ? "" : margin}
                  onChange={e => setMargin(parseNumericInput(e.target.value))}
                />
                <span className="mt-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {commissionRatePercent > 0
                    ? `Taxa aplicada: ${commissionRatePercent.toFixed(2)}%`
                    : 'Sem faixa de comissÃ£o aplicada'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1 ml-1">CÃ³d. Rastreio / NF</label>
                <div className="relative">
                   <Truck className="absolute left-3 top-3.5 text-slate-400" size={16} />
                   <input
                    className={`${inputClasses} pl-10`}
                    placeholder="CÃ³digo de rastreio ou nÃºmero"
                    value={trackingCode}
                    onChange={e => setTrackingCode(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-300 uppercase mb-1 ml-1">Data de Faturamento</label>
                <input
                  type="date"
                  className={`${inputClasses} ${isPendingBilling ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
                  value={isPendingBilling ? '' : billDate}
                  onChange={e => setBillDate(e.target.value)}
                  disabled={isPendingBilling}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-300 uppercase mb-1 ml-1">Prazo</label>
                <input
                  type="date"
                  className={inputClasses}
                  value={closeDate}
                  onChange={e => setCloseDate(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                 <label className="block text-xs font-bold text-slate-300 uppercase mb-1 ml-1">ObservaÃ§Ãµes</label>
                 <textarea 
                   className={`${inputClasses} h-24 resize-none`}
                   placeholder="Detalhes adicionais do pedido..."
                   value={observations}
                   onChange={e => setObservations(e.target.value)}
                 />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1 ml-1">Forma de Pagamento</label>
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

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer ml-1 group">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isPendingBilling ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/20' : 'border-slate-600'}`}>
                        <input 
                            type="checkbox" 
                            className="hidden"
                            checked={isPendingBilling} 
                            onChange={e => setIsPendingBilling(e.target.checked)}
                        />
                        {isPendingBilling && <Clock size={12} className="text-white" />}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isPendingBilling ? 'text-amber-300' : 'text-slate-400'}`}>
                        Pendente de Faturamento
                    </span>
                </label>
                
                <div className={`p-4 rounded-xl flex items-start gap-3 transition-colors ${isPendingBilling ? 'bg-amber-900/20 border border-amber-800/60' : 'bg-indigo-900/20 border border-indigo-800/60'}`}>
                    {isPendingBilling ? (
                        <>
                          <Clock className="text-amber-500 shrink-0 mt-0.5" size={16} />
                          <p className="text-xs text-amber-200 leading-relaxed font-medium">
                              Venda marcada como pendente. Ela n?o aparecer? nos gr?ficos de faturamento mensal at? que voc? defina uma data.
                          </p>
                        </>
                    ) : (
                        <>
                          <AlertCircle className="text-indigo-500 shrink-0 mt-0.5" size={16} />
                          <p className="text-xs text-indigo-200 leading-relaxed font-medium">
                              Esta data define o m?s em que a comiss?o ser? contabilizada no seu dashboard.
                          </p>
                        </>
                    )}
                </div>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="p-5 md:p-6 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-900 shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-center md:text-left">
              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Base de Comissão</span>
              <p className="text-lg font-bold text-slate-100">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(commissionBase)}
              </p>
            </div>
            <div className="w-px h-8 bg-slate-800"></div>
            <div className="text-center md:text-left">
              <span className={`block text-[10px] font-black uppercase tracking-widest ${isPendingBilling ? 'text-amber-600' : 'text-emerald-600'}`}>
                {isPendingBilling ? 'Comissão Prevista (Pend.)' : 'Comissão Prevista'}
              </span>
              <p className={`text-2xl font-black ${isPendingBilling ? 'text-amber-400' : 'text-emerald-400'}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(commissionValue)}
              </p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={onClose}
              className="flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button 
              disabled={isLocked}
              onClick={handleSave}
              className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-white ${isPendingBilling ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/20' : (isNatal ? 'bg-red-600 hover:bg-red-700 shadow-red-900/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20')} disabled:opacity-40 disabled:cursor-not-allowed`}
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
