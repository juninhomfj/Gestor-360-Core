import React, { useState, useEffect } from 'react';
import { User, CommissionCampaign, Sale } from '../types';
import { getCampaignsByCompany, resolveCompanyId, resolveMonthlyBasicBasketTarget, getSaleMonthKey } from '../services/campaignService';
import { getStoredSales } from '../services/logic';
import { Target, Award, Calendar } from 'lucide-react';
import { Logger } from '../services/logger';

interface CampaignsDashboardProps {
  user: User;
  onNavigateToProfile?: () => void;
}

const CampaignsDashboard: React.FC<CampaignsDashboardProps> = ({ user, onNavigateToProfile }) => {
  const [activeCampaigns, setActiveCampaigns] = useState<CommissionCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storedSales, setStoredSales] = useState<Sale[]>([]);

  // Obter mês corrente no formato YYYY-MM
  const getCurrentMonthKey = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  // Contar vendas do mês corrente por tipo de cesta
  const countMonthlySalessByType = (sales: Sale[], monthKey: string) => {
    let basicCount = 0;
    let natalCount = 0;

    // Guard: garantir que sales é array
    if (!Array.isArray(sales)) {
      Logger.warn("CampaignsDashboard: countMonthlySalessByType recebeu entrada não-array", { 
        type: typeof sales, 
        isArray: Array.isArray(sales) 
      });
      return { basicCount: 0, natalCount: 0 };
    }

    sales.forEach(sale => {
      const saleMonth = getSaleMonthKey(sale);
      if (saleMonth === monthKey && sale.status === 'FATURADO') {
        if (sale.basketType === 'BASICA') basicCount++;
        else if (sale.basketType === 'NATAL') natalCount++;
      }
    });

    return { basicCount, natalCount };
  };

  useEffect(() => {
    const loadCampaigns = async () => {
      setLoading(true);
      setError(null);

      try {
        // Resolver companyId
        const companyId = await resolveCompanyId(user);
        
        // Carregar campanhas
        const campaigns = await getCampaignsByCompany(companyId);
        
        // Carregar vendas armazenadas (async)
        const salesData = await getStoredSales();
        setStoredSales(Array.isArray(salesData) ? salesData : []);
        
        // Filtrar apenas campanhas ativas no mês corrente
        const currentMonth = getCurrentMonthKey();
        const activeCampsThisMonth = campaigns.filter(camp => 
          camp.active &&
          camp.startMonth <= currentMonth &&
          camp.endMonth >= currentMonth
        );

        setActiveCampaigns(activeCampsThisMonth);

        if (activeCampsThisMonth.length === 0) {
          Logger.info("CampaignsDashboard: nenhuma campanha ativa no mês corrente.", { currentMonth });
        }
      } catch (err: any) {
        Logger.error("CampaignsDashboard: erro ao carregar campanhas.", err);
        setError(String(err?.message || 'Erro ao carregar campanhas'));
      } finally {
        setLoading(false);
      }
    };

    loadCampaigns();
  }, [user]);

  // Se não há campanhas ativas, não renderizar nada
  if (!loading && activeCampaigns.length === 0) {
    return null;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 text-sm">
        <p className="font-bold">Erro ao carregar campanhas</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full"></div>
        </div>
        <p className="text-sm text-gray-500 mt-4">Carregando campanhas...</p>
      </div>
    );
  }

  // Renderizar campanhas ativas
  const currentMonth = getCurrentMonthKey();
  const { basicCount, natalCount } = countMonthlySalessByType(storedSales, currentMonth);
  const basicTarget = resolveMonthlyBasicBasketTarget(user);

  // Calcular progresso
  const basicProgress = basicTarget > 0 ? (basicCount / basicTarget) * 100 : 0;
  const basicHit = basicCount >= basicTarget;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card Cestas Básicas */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Target size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-widest">
                  Cestas Básicas
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Meta mensal</p>
              </div>
            </div>
            {basicHit && (
              <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full">
                <Award size={14} />
                <span className="text-[10px] font-black">1</span>
              </div>
            )}
          </div>

          {/* Barra de progresso */}
          <div className="mb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {basicCount}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                de {basicTarget}
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  basicHit ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(basicProgress, 100)}%` }}
              />
            </div>
            <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1 font-bold">
              {Math.round(basicProgress)}%
            </div>
          </div>

          {/* Info */}
          <div className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
            <p>
              <span className="font-bold text-gray-700 dark:text-gray-300">
                {Math.max(0, basicTarget - basicCount)}
              </span>{' '}
              {basicTarget - basicCount === 1 ? 'cesta' : 'cestas'} faltam
            </p>
          </div>
        </div>

        {/* Card Cestas de Natal */}
        <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 rounded-2xl border border-red-200 dark:border-red-800 p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <Target size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-widest">
                  Cestas de Natal
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Visualização</p>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="text-[11px] text-gray-600 dark:text-gray-400 space-y-2">
            <p>
              <span className="font-bold text-gray-700 dark:text-gray-300">
                {natalCount}
              </span>{' '}
              {natalCount === 1 ? 'cesta' : 'cestas'} vendidas neste mês
            </p>
            <p className="text-[10px] text-gray-500">
              Meta de cestas de natal pode ser editada no seu <strong>Perfil</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Campaign Details */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <h3 className="font-black text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2 uppercase text-xs tracking-widest">
          <Calendar size={16} className="text-indigo-500" /> Campanhas Ativas
        </h3>
        <div className="space-y-3">
          {activeCampaigns.map(camp => (
            <div
              key={camp.id}
              className="flex items-start justify-between p-3 bg-gray-50 dark:bg-slate-950 rounded-xl border border-gray-200 dark:border-slate-700"
            >
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {camp.name}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  {camp.startMonth} a {camp.endMonth}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-bold">
                  ATIVA
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botão para editar metas */}
      {onNavigateToProfile && (
        <div className="flex justify-center">
          <button
            onClick={onNavigateToProfile}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/20"
          >
            ✏️ Editar Metas no Perfil
          </button>
        </div>
      )}
    </div>
  );
};

export default CampaignsDashboard;
