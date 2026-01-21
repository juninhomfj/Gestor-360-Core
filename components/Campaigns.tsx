import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CommissionCampaign, CommissionCampaignTier, User } from '../types';
import { getCampaignsByCompany, resolveCompanyId, saveCampaign, toggleCampaignActive } from '../services/campaignService';
import { AlertCircle, CheckCircle2, Loader2, Plus, RefreshCw, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { Logger } from '../services/logger';

interface CampaignsProps {
  currentUser: User;
  darkMode?: boolean;
  onNotify?: (type: 'SUCCESS' | 'ERROR' | 'INFO', msg: string) => void;
}

const defaultMetaTiers: CommissionCampaignTier[] = [
  { from: 0, to: 2.5, commissionPct: 0.1 },
  { from: 2.51, to: 3.99, commissionPct: 0.15 }
];

const Campaigns: React.FC<CampaignsProps> = ({ currentUser, darkMode = true, onNotify }) => {
  const [campaigns, setCampaigns] = useState<CommissionCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [startMonth, setStartMonth] = useState(new Date().toISOString().slice(0, 7));
  const [endMonth, setEndMonth] = useState(new Date().toISOString().slice(0, 7));
  const [active, setActive] = useState(true);
  const [tiers, setTiers] = useState<CommissionCampaignTier[]>(defaultMetaTiers);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const parseNumericInput = (value: string) => (value == "" ? 0 : Number(value));

  const cardClass = darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200';
  const inputClass = darkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-300';

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const resolvedCompany = await resolveCompanyId(currentUser);
      setCompanyId(resolvedCompany);
      const data = await getCampaignsByCompany(resolvedCompany);
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (error: any) {
      onNotify?.('ERROR', 'Falha ao carregar campanhas.');
      Logger.error('Campaigns: falha ao carregar campanhas.', { error: error?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [currentUser.id]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setStartMonth(new Date().toISOString().slice(0, 7));
    setEndMonth(new Date().toISOString().slice(0, 7));
    setActive(true);
    setTiers(defaultMetaTiers);
  };

  const handleSave = async () => {
    if (!companyId) return;
    if (!name.trim()) {
      onNotify?.('ERROR', 'Informe o nome da campanha.');
      return;
    }
    if (!startMonth || !endMonth) {
      onNotify?.('ERROR', 'Informe o período da campanha.');
      return;
    }
    const rules = {
      minMargin: 0,
      maxMarginExclusive: 4,
      tiers,
      requiresGoalHit: true,
      goalMetric: 'CESTAS_BASICAS_VOLUME',
      goalMonthlyTargetField: 'monthlyBasicBasketGoal'
    };
    const payload: CommissionCampaign = {
      id: editingId || crypto.randomUUID(),
      active,
      type: 'META_BAIXA_MARGEM',
      name: name.trim(),
      companyId,
      startMonth,
      endMonth,
      rules,
      userId: currentUser.uid
    };
    try {
      await saveCampaign(payload);
      onNotify?.('SUCCESS', 'Campanha salva com sucesso.');
      await loadCampaigns();
      resetForm();
    } catch (error: any) {
      onNotify?.('ERROR', 'Falha ao salvar campanha.');
      Logger.error('Campaigns: falha ao salvar campanha.', { error: error?.message, companyId });
    }
  };

  const handleEdit = (campaign: CommissionCampaign) => {
    setEditingId(campaign.id);
    setName(campaign.name);
    setStartMonth(campaign.startMonth);
    setEndMonth(campaign.endMonth);
    setActive(campaign.active);
    const rules = campaign.rules as any;
    const mapped = (rules.tiers || defaultMetaTiers).map((tier: CommissionCampaignTier) => ({ ...tier }));
    setTiers(mapped);
  };

  const handleToggleActive = async (campaign: CommissionCampaign) => {
    try {
      await toggleCampaignActive(campaign, !campaign.active);
      await loadCampaigns();
      onNotify?.('SUCCESS', `Campanha ${campaign.active ? 'desativada' : 'ativada'}.`);
    } catch (error: any) {
      onNotify?.('ERROR', 'Falha ao atualizar campanha.');
      Logger.error('Campaigns: falha ao atualizar status da campanha.', { error: error?.message, campaignId: campaign.id });
    }
  };

  const filteredCampaigns = useMemo(() => {
    if (!filterMonth) return campaigns;
    return campaigns.filter(campaign => filterMonth >= campaign.startMonth && filterMonth <= campaign.endMonth);
  }, [campaigns, filterMonth]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-black ${darkMode ? 'text-white' : 'text-gray-900'}`}>Campanhas de Comissão</h1>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Configure incentivos por período e empresa.
          </p>
        </div>
        <button
          onClick={loadCampaigns}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest ${darkMode ? 'bg-slate-800 text-slate-200' : 'bg-gray-100 text-gray-600'}`}
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <div ref={editorRef} className={`rounded-3xl border p-6 ${cardClass}`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-black">Editor de Campanhas</h2>
            <p className="text-xs text-gray-400">Configure regras para margem baixa.</p>
          </div>
          <button
            onClick={resetForm}
            className={`text-xs font-bold uppercase tracking-widest px-3 py-2 rounded-lg ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-600'}`}
          >
            <Plus size={14} className="inline-block mr-2" />
            Nova Campanha
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <div>
            <label className="text-xs font-bold uppercase opacity-70">Nome</label>
            <input className={`w-full p-3 rounded-xl border mt-1 ${inputClass}`} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase opacity-70">Tipo</label>
            <div className={`w-full p-3 rounded-xl border mt-1 ${inputClass}`}>
              Meta (Margem &lt; 4%)
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase opacity-70">Início (YYYY-MM)</label>
            <input type="month" className={`w-full p-3 rounded-xl border mt-1 ${inputClass}`} value={startMonth} onChange={e => setStartMonth(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase opacity-70">Fim (YYYY-MM)</label>
            <input type="month" className={`w-full p-3 rounded-xl border mt-1 ${inputClass}`} value={endMonth} onChange={e => setEndMonth(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => setActive(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest ${active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}
          >
            {active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {active ? 'Ativa' : 'Inativa'}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-indigo-600 text-white"
          >
            <Save size={16} /> Salvar
          </button>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Faixas e Percentuais</h3>
          <div className="space-y-3 mt-4">
            {tiers.map((tier, idx) => (
              <div key={`${tier.from}-${idx}`} className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  step="0.01"
                  className={`p-3 rounded-xl border ${inputClass}`}
                  value={tier.from === 0 ? "" : tier.from}
                  onChange={e => setTiers(prev => prev.map((t, i) => i === idx ? { ...t, from: parseNumericInput(e.target.value) } : t))}
                  placeholder="De (%)"
                />
                <input
                  type="number"
                  step="0.01"
                  className={`p-3 rounded-xl border ${inputClass}`}
                  value={tier.to === 0 ? "" : tier.to}
                  onChange={e => setTiers(prev => prev.map((t, i) => i === idx ? { ...t, to: parseNumericInput(e.target.value) } : t))}
                  placeholder="Até (%)"
                />
                <input
                  type="number"
                  step="0.01"
                  className={`p-3 rounded-xl border ${inputClass}`}
                  value={tier.commissionPct === 0 ? "" : tier.commissionPct}
                  onChange={e => setTiers(prev => prev.map((t, i) => i === idx ? { ...t, commissionPct: parseNumericInput(e.target.value) } : t))}
                  placeholder="Comissão (%)"
                />
              </div>
            ))}
            <button
              onClick={() => setTiers(prev => [...prev, { from: 0, to: 0, commissionPct: 0 }])}
              className={`text-xs font-bold uppercase tracking-widest px-3 py-2 rounded-lg ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-600'}`}
            >
              <Plus size={14} className="inline-block mr-2" />
              Adicionar Faixa
            </button>
          </div>
        </div>
      </div>

      <div className={`rounded-3xl border p-6 ${cardClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">Campanhas Ativas por Período</h2>
          <input
            type="month"
            className={`p-2 rounded-lg border text-xs font-bold ${inputClass}`}
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            placeholder="YYYY-MM"
          />
        </div>

        {loading && (
          <div className="flex items-center gap-3 mt-6 text-sm text-gray-400">
            <Loader2 size={18} className="animate-spin" /> Carregando campanhas...
          </div>
        )}

        {!loading && filteredCampaigns.length === 0 && (
          <div className={`mt-6 rounded-2xl border border-dashed p-6 ${darkMode ? 'border-slate-800 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
            <div className="flex items-center gap-3 text-sm">
              <AlertCircle size={18} /> Nenhuma campanha encontrada para o período.
            </div>
            <button
              onClick={() => {
                resetForm();
                editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest ${darkMode ? 'bg-slate-800 text-slate-200' : 'bg-gray-100 text-gray-600'}`}
            >
              <Plus size={14} /> Criar campanha
            </button>
          </div>
        )}

        {!loading && filteredCampaigns.length > 0 && (
          <div className="mt-4 space-y-3">
            {filteredCampaigns.map(campaign => (
              <div key={campaign.id} className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-2xl border ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-gray-200 bg-gray-50'}`}>
                <div>
                  <p className="text-sm font-black">{campaign.name}</p>
                  <p className="text-xs text-gray-400">
                    Meta por Margem Baixa • {campaign.startMonth} → {campaign.endMonth}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold uppercase tracking-widest ${campaign.active ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {campaign.active ? 'ATIVA' : 'INATIVA'}
                  </span>
                  <button
                    onClick={() => handleEdit(campaign)}
                    className={`text-xs font-bold uppercase tracking-widest px-3 py-2 rounded-lg ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-600'}`}
                  >
                    <CheckCircle2 size={14} className="inline-block mr-2" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(campaign)}
                    className={`text-xs font-bold uppercase tracking-widest px-3 py-2 rounded-lg ${campaign.active ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}
                  >
                    {campaign.active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Campaigns;
