import { collection, query, where, getDocsFromServer, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { dbBulkPutSkipPending, dbGetAll, dbPut } from "../storage/db";
import { CommissionCampaign, ProductType, Sale, User } from "../types";
import { Logger } from "./logger";
import { getSession } from "./auth";
import { getStoredSales } from "./logic";
import { safeSetDoc } from "./safeWrites";
export interface MonthlyBasicBasketProgress {
  target: number;
  current: number;
  hit: boolean;
}

let warnedMissingPaymentType = false;
let warnedMissingGoalTarget = false;
let warnedMissingQuantityField = false;

export const resolveCompanyId = async (user: User): Promise<string> => {
  const rawCompanyId = (user as any)?.companyId || (user as any)?.companyKey;
  if (rawCompanyId) return String(rawCompanyId);
  return user.uid;
};

export const resolveMonthlyBasicBasketTarget = (user: User | null): number => {
  if (!user) return 0;
  const candidate =
    (user as any)?.monthlyBasicBasketGoal ??
    (user as any)?.monthlyBasicBasketTarget ??
    (user as any)?.salesTargets?.basic ??
    (user as any)?.targets?.basic;
  if (candidate === undefined || candidate === null) {
    if (!warnedMissingGoalTarget) {
      warnedMissingGoalTarget = true;
      Logger.warn("Campaigns: meta mensal de cestas não encontrada no usuário.");
    }
    return 0;
  }
  const parsed = Number(candidate);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const getSaleMonthKey = (sale: Sale): string => {
  const rawDate = sale.date || sale.completionDate || sale.quoteDate || sale.createdAt;
  if (!rawDate) return '';
  if (typeof rawDate === 'string' && rawDate.includes('-')) {
    return rawDate.slice(0, 7);
  }
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 7);
};

export const resolveSalePaymentType = (sale: Sale): string | null => {
  const raw =
    (sale as any)?.paymentType ??
    (sale as any)?.paymentMethod ??
    (sale as any)?.paymentMode ??
    (sale as any)?.paymentCondition ??
    (sale as any)?.paymentTerms ??
    (sale as any)?.payment;
  if (!raw) {
    if (!warnedMissingPaymentType) {
      warnedMissingPaymentType = true;
      Logger.warn("Campaigns: campo de pagamento não encontrado em venda.");
    }
    return null;
  }
  const normalized = String(raw)
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '');
  if (normalized.includes('ANTECIP')) return 'ANTECIPADO';
  if (normalized.includes('AVISTA') || normalized.includes('A VISTA')) return 'AVISTA';
  return normalized;
};

const resolveSaleQuantity = (sale: Sale): number => {
  const candidates = [
    sale.quantity,
    (sale as any)?.qtdCestas,
    (sale as any)?.qtdCesta,
    (sale as any)?.quantidade,
    (sale as any)?.qtde,
    (sale as any)?.qtd
  ];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  if (!warnedMissingQuantityField) {
    warnedMissingQuantityField = true;
    Logger.warn("Campaigns: quantidade de cestas não encontrada; usando 0.");
  }
  return 0;
};

export const isMonthWithinRange = (month: string, startMonth: string, endMonth: string): boolean => {
  if (!month || !startMonth || !endMonth) return false;
  return month >= startMonth && month <= endMonth;
};

export const getCampaignsByCompany = async (companyId: string): Promise<CommissionCampaign[]> => {
  try {
    const baseQuery = query(collection(db, 'campaigns'), where('companyId', '==', companyId));
    const sortedQuery = query(baseQuery, orderBy('startMonth', 'desc'));
    let snap = await getDocsFromServer(sortedQuery);
    let campaigns = snap.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as any) } as CommissionCampaign));
    if (
      campaigns.length === 0 &&
      !(snap as any)?.metadata?.fromCache
    ) {
      Logger.info("Campaigns: nenhuma campanha encontrada no Firestore.", { companyId });
      return [];
    }
    if (campaigns.length === 0) {
      return [];
    }
    await dbBulkPutSkipPending('campaigns', campaigns);
    Logger.info("Campaigns: campanhas carregadas do Firestore.", { companyId, count: campaigns.length });
    return campaigns;
  } catch (error: any) {
    const message = String(error?.message || '');
    const isIndexError =
      error?.code === 'failed-precondition' ||
      message.toLowerCase().includes('requires an index');
    if (isIndexError) {
      try {
        const fallbackQuery = query(collection(db, 'campaigns'), where('companyId', '==', companyId));
        const fallbackSnap = await getDocsFromServer(fallbackQuery);
        const campaigns = fallbackSnap.docs
          .map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as any) } as CommissionCampaign))
          .sort((a, b) => (b.startMonth || '').localeCompare(a.startMonth || ''));
        if (campaigns.length === 0) {
          Logger.info("Campaigns: nenhuma campanha encontrada no Firestore.", { companyId });
          return [];
        }
        await dbBulkPutSkipPending('campaigns', campaigns);
        Logger.info("Campaigns: campanhas carregadas do Firestore (sem ordenação no servidor).", {
          companyId,
          count: campaigns.length
        });
        return campaigns;
      } catch (fallbackError: any) {
        Logger.warn("Campaigns: falha ao buscar campanhas do Firestore.", {
          message: fallbackError?.message,
          companyId,
          query: "campaigns where companyId == X"
        });
        return await dbGetAll('campaigns', c => c.companyId === companyId);
      }
    }
    Logger.warn("Campaigns: falha ao buscar campanhas do Firestore.", {
      message: error?.message,
      companyId,
      query: "campaigns where companyId == X orderBy startMonth desc"
    });
    return await dbGetAll('campaigns', c => c.companyId === companyId);
  }
};

export const saveCampaign = async (campaign: CommissionCampaign): Promise<void> => {
  const now = new Date().toISOString();
  const payload: CommissionCampaign = {
    ...campaign,
    updatedAt: now,
    createdAt: campaign.createdAt || now,
    userId: campaign.userId || getSession()?.uid
  };
  try {
    await dbPut('campaigns', payload);
    await safeSetDoc('campaigns', payload.id, payload as any, { merge: true }, payload as any, 'UPDATE');
    Logger.info("Campaigns: campanha salva.", { campaignId: payload.id, companyId: payload.companyId });
  } catch (error: any) {
    Logger.error("Campaigns: falha ao salvar campanha.", { campaignId: payload.id, message: error?.message });
    throw error;
  }
};

export const toggleCampaignActive = async (campaign: CommissionCampaign, active: boolean): Promise<void> => {
  await saveCampaign({ ...campaign, active });
  Logger.info("Campaigns: status atualizado.", { campaignId: campaign.id, active });
};

export const getMonthlyBasicBasketProgress = async (
  userId: string,
  month: string,
  companyId: string,
  options?: { sales?: Sale[]; targetOverride?: number }
): Promise<MonthlyBasicBasketProgress> => {
  const target = options?.targetOverride ?? 0;
  let sales = options?.sales;
  if (!sales) {
    sales = await getStoredSales();
  }
  const current = sales
    .filter(sale => sale.userId === userId)
    .filter(sale => !sale.deleted)
    .filter(sale => sale.type === ProductType.BASICA)
    .filter(sale => getSaleMonthKey(sale) === month)
    .reduce((acc, sale) => acc + resolveSaleQuantity(sale), 0);
  return { target, current, hit: target > 0 && current >= target };
};
