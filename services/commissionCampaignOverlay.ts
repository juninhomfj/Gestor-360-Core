import {
  CommissionCampaign,
  CommissionCampaignRulesMeta,
  CommissionCampaignTag,
  Sale
} from "../types";
import { MonthlyBasicBasketProgress, isMonthWithinRange, resolveSalePaymentType } from "./campaignService";

export interface CommissionBaseResult {
  commissionBaseTotal: number;
  commissionValueTotal: number;
  commissionRateUsed: number;
}

export interface CampaignOverlayContext {
  month: string;
  campaigns: CommissionCampaign[];
  goalProgress?: MonthlyBasicBasketProgress;
  salePaymentType?: string | null;
}

export interface CommissionCampaignOverlayResult {
  commissionValueTotal: number;
  commissionRateUsed: number;
  campaignTag: CommissionCampaignTag;
  campaignLabel: string;
  campaignMessage: string;
  campaignRateUsed: number;
  campaignColor: 'emerald' | 'amber';
}

export interface AvistaLowMarginRuleConfig {
  enabled: boolean;
  commissionPct: number;
  paymentTypesAllowed?: string[];
}

const normalizePercent = (pct: number): number => {
  if (Number.isNaN(pct)) return 0;
  return pct / 100;
};

const buildTierMessage = (label: string, ratePct: number, from: number, to: number) => {
  const pctLabel = ratePct.toFixed(2).replace('.', ',');
  const fromLabel = from.toFixed(2).replace('.', ',');
  const toLabel = to.toFixed(2).replace('.', ',');
  return `${label} • ${pctLabel}% (faixa ${fromLabel}% - ${toLabel}%)`;
};

const buildFixedMessage = (label: string, ratePct: number) => {
  const pctLabel = ratePct.toFixed(2).replace('.', ',');
  return `${label} • ${pctLabel}%`;
};

const normalizePaymentTokens = (paymentType?: string | null): string[] => {
  if (!paymentType) return [];
  const normalized = paymentType
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  const tokens = normalized
    .split(/[\\/|,;]+/)
    .map(token => token.replace(/\s+/g, ''))
    .filter(Boolean);

  const compact = normalized.replace(/\s+/g, '');
  if (compact && !tokens.includes(compact)) {
    tokens.push(compact);
  }
  return tokens;
};

export const applyCampaignOverlay = (
  sale: Sale,
  baseCommission: CommissionBaseResult,
  context: CampaignOverlayContext
): CommissionCampaignOverlayResult | null => {
  const activeCampaigns = context.campaigns.filter(c => c.active && isMonthWithinRange(context.month, c.startMonth, c.endMonth));
  if (!activeCampaigns.length) return null;

  const margin = Number(sale.marginPercent ?? 0);
  const salePaymentType = context.salePaymentType !== undefined ? context.salePaymentType : resolveSalePaymentType(sale);
  const normalizedPayments = normalizePaymentTokens(salePaymentType);

  const avistaCampaign = activeCampaigns.find(c => c.type === 'AVISTA_BAIXA_MARGEM');
  if (avistaCampaign) {
    const rules = avistaCampaign.rules as CommissionCampaignRulesAvista;
    const allowed = (rules.paymentTypesAllowed || []).map((item) =>
      String(item).toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '')
    );
    const matchesPayment = normalizedPayments.some(payment => allowed.includes(payment));
    if (matchesPayment && margin >= rules.minMargin && margin < rules.maxMarginExclusive) {
      const rateUsed = normalizePercent(rules.commissionPct);
      const commissionValueTotal = (baseCommission.commissionBaseTotal || 0) * rateUsed;
      return {
        commissionValueTotal,
        commissionRateUsed: rateUsed,
        campaignTag: 'PREMIACAO_AVISTA',
        campaignLabel: 'Premiação À Vista',
        campaignMessage: buildFixedMessage('Premiação À Vista', rules.commissionPct),
        campaignRateUsed: rateUsed,
        campaignColor: 'amber'
      };
    }
  }

  const metaCampaign = activeCampaigns.find(c => c.type === 'META_BAIXA_MARGEM');
  if (metaCampaign && context.goalProgress?.hit) {
    const rules = metaCampaign.rules as CommissionCampaignRulesMeta;
    if (margin >= rules.minMargin && margin < rules.maxMarginExclusive) {
      const tier = (rules.tiers || []).find(t => margin >= t.from && margin <= t.to);
      if (tier) {
        const rateUsed = normalizePercent(tier.commissionPct);
        const commissionValueTotal = (baseCommission.commissionBaseTotal || 0) * rateUsed;
        return {
          commissionValueTotal,
          commissionRateUsed: rateUsed,
          campaignTag: 'PREMIACAO_META',
          campaignLabel: 'Premiação por Meta',
          campaignMessage: buildTierMessage('Premiação por Meta', tier.commissionPct, tier.from, tier.to),
          campaignRateUsed: rateUsed,
          campaignColor: 'emerald'
        };
      }
    }
  }

  return null;
};

export const applyAvistaLowMarginRule = (
  sale: Sale,
  baseCommission: CommissionBaseResult,
  config: AvistaLowMarginRuleConfig
): CommissionCampaignOverlayResult | null => {
  if (!config.enabled) return null;
  const margin = Number(sale.marginPercent ?? 0);
  if (margin < 0 || margin >= 4) return null;

  if (config.paymentTypesAllowed && config.paymentTypesAllowed.length > 0) {
    const allowed = config.paymentTypesAllowed.map((item) =>
      String(item).toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '')
    );
    const normalizedPayments = normalizePaymentTokens(resolveSalePaymentType(sale));
    const matchesPayment = normalizedPayments.some(payment => allowed.includes(payment));
    if (!matchesPayment) return null;
  }

  const rateUsed = normalizePercent(config.commissionPct);
  const commissionValueTotal = (baseCommission.commissionBaseTotal || 0) * rateUsed;
  return {
    commissionValueTotal,
    commissionRateUsed: rateUsed,
    campaignTag: 'PREMIACAO_AVISTA',
    campaignLabel: 'Premiação À Vista',
    campaignMessage: buildFixedMessage('Premiação À Vista', config.commissionPct),
    campaignRateUsed: rateUsed,
    campaignColor: 'amber'
  };
};
