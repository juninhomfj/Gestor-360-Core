/*
**********************************************************************
ARQUIVO BLOQUEADO — NAO MODIFICAR
ALTERAR SOMENTE COM AUTORIZACAO EXPRESSA.

CONTRATO DO MOTOR DE COMISSAO:
- "margin" e apenas comparador de intervalo (min <= margin <= max).
- "rate" e a taxa aplicada sobre a base de comissao.
- A assinatura publica deve permanecer identica.

EXEMPLOS (TABELA DE FAIXAS):
| margin | min  | max  | rate |
|  0.00  | 0.00 | 2.50 | 0.05 |
|  2.51  | 2.51 | 4.00 | 0.10 |
|  4.01  | 4.01 | null | 0.15 |
**********************************************************************
*/
import {
  collection,
  query,
  where,
  getDocs,
  getDocsFromServer,
  doc,
  serverTimestamp,
  Timestamp,
  getDoc,
  getDocFromServer,
  writeBatch,
  limit,
  onSnapshot
} from "firebase/firestore";
import { db, auth } from "./firebase";
import {
  dbPut,
  dbBulkPut,
  dbBulkPutSkipPending,
  dbGetAll,
  initDB,
  dbDelete,
  dbGet,
  dbClearStore
} from "../storage/db";
import { sanitizeForFirestore } from "../utils/firestoreUtils";
import * as XLSX from "xlsx";
import {
  Sale,
  Transaction,
  FinanceAccount,
  Receivable,
  ReportConfig,
  SystemConfig,
  ProductType,
  CommissionRule,
  ChallengeCell,
  FinancialPacing,
  ProductivityMetrics,
  ImportMapping,
  User,
  ChallengeModel,
  SalesTask,
  Client
} from "../types";
import { Logger } from "./logger";
import { getSession } from "./auth";
import { getOpenTicketCount } from "./tickets";
import { isOnline, safeSetDoc, safeUpdateDoc } from "./safeWrites";

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  bootstrapVersion: 2,
  includeNonAccountingInTotal: false,
  isMaintenanceMode: false,
  salesLockEnabled: true,
  paymentMethods: ["À vista / Antecipado", "À prazo"],
  avistaLowMarginRuleEnabled: true,
  avistaLowMarginCommissionPct: 0.25,
  avistaLowMarginPaymentMethods: ["À vista / Antecipado"],
  modules: {
    sales: true,
    finance: true,
    crm: true,
    receivables: true,
    distribution: true,
    imports: true,
    settings: true,
    dev: true,
    chat: true,
    logs: true,
    users: false,
    profiles: false,
    abc_analysis: true,
    ltv_details: true,
    manual_billing: true,
    audit_logs: true
  }
};

export const validateWriteAccess = async () => {
  const user = getSession();
  if (user?.role === "DEV") return true;
  const config = await getSystemConfig();
  if (config.isMaintenanceMode)
    throw new Error("SISTEMA EM MANUTENÇÃO: Operação de escrita bloqueada.");
  return true;
};

export const validateSalesWriteAccess = async () => {
  const user = getSession();
  if (user?.role === "DEV") return true;
  const config = await getSystemConfig();
  if (config.isMaintenanceMode)
    throw new Error("SISTEMA EM MANUTENÇÃO: Operação de escrita bloqueada.");
  if (config.salesLockEnabled)
    throw new Error("MÓDULO DE VENDAS BLOQUEADO: Operação somente leitura.");
  return true;
};

export const canAccess = (user: User | null, mod: string): boolean => {
  if (!user || !user.isActive) return false;
  if (user.role === "DEV") return true;

  const alwaysVisible = ["profile", "settings", "commissions", "clients_hub", "home"];
  if (alwaysVisible.includes(mod)) return true;

  const perms = user.permissions || {};
  return !!(perms as any)[mod];
};

export const SystemPerformance = {
  firebaseLatency: 0,
  async measureFirebase(): Promise<number> {
    const start = performance.now();
    try {
      await getDocFromServer(doc(db, "config", "ping"));
      const latency = Math.round(performance.now() - start);
      this.firebaseLatency = latency;
      return latency;
    } catch {
      return -1;
    }
  }
};

export const ensureNumber = (value: any, fallback = 0): number => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number") return isNaN(value) ? fallback : value;
  let str = String(value).trim();
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  if (lastComma > lastDot) str = str.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma) str = str.replace(/,/g, "");
  else if (lastComma !== -1) str = str.replace(",", ".");
  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
};

export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
};

export const isActiveSale = (sale: Sale): boolean => {
  return !sale.deleted;
};

export const isBilledSale = (sale: Sale): boolean => {
  return isActiveSale(sale) && !!sale.date;
};

export const buildBilledSalesMap = (sales: Sale[]): Map<string, Sale> => {
  return new Map(sales.filter(isBilledSale).map((sale) => [sale.id, sale]));
};

export const SessionTraffic = {
  reads: 0,
  writes: 0,
  lastActivity: null as Date | null,
  trackRead(count = 1) {
    this.reads += count;
    this.lastActivity = new Date();
  },
  trackWrite(count = 1) {
    this.writes += count;
    this.lastActivity = new Date();
  }
};

export const calculatePredictiveCashFlow = (
  currentBalance: number,
  receivables: Receivable[],
  transactions: Transaction[]
) => {
  const timeline: any[] = [];
  const now = new Date();
  let rollingBalance = currentBalance;

  for (let i = 0; i <= 30; i++) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + i);
    const dateStr = targetDate.toISOString().split("T")[0];

    const dayIncomes = receivables
      .filter((r) => r.date === dateStr && r.status === "PENDING")
      .reduce(
        (acc, r) =>
          acc +
          (r.value - (r.deductions?.reduce((dAcc, d) => dAcc + d.amount, 0) || 0)),
        0
      );

    const dayExpenses = transactions
      .filter((t) => t.date === dateStr && !t.isPaid && t.type === "EXPENSE")
      .reduce((acc, t) => acc + t.amount, 0);

    rollingBalance += dayIncomes - dayExpenses;

    timeline.push({
      date: dateStr,
      displayDate: targetDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      balance: rollingBalance,
      income: dayIncomes,
      expense: dayExpenses,
      isCritical: rollingBalance < 0
    });
  }

  return timeline;
};

export const analyzeClients = (sales: Sale[], config: ReportConfig) => {
  const clientsMap = new Map<string, any>();
  const now = new Date();

  sales.forEach((sale) => {
    if (sale.deleted) return;
    const name = sale.client;
    const date = new Date(sale.date || sale.completionDate || 0);
    const existing = clientsMap.get(name) || {
      name,
      totalOrders: 0,
      totalSpent: 0,
      lastPurchaseDate: date,
      firstPurchaseDate: date
    };
    existing.totalOrders++;
    existing.totalSpent += sale.valueSold;
    if (date > existing.lastPurchaseDate) existing.lastPurchaseDate = date;
    if (date < existing.firstPurchaseDate) existing.firstPurchaseDate = date;
    clientsMap.set(name, existing);
  });

  return Array.from(clientsMap.values()).map((c) => {
    const daysSinceLast = Math.floor((now.getTime() - c.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceFirst = Math.floor((now.getTime() - c.firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    let status = "ACTIVE";
    if (daysSinceFirst <= config.daysForNewClient) status = "NEW";
    else if (daysSinceLast > config.daysForLost) status = "LOST";
    else if (daysSinceLast > config.daysForInactive) status = "INACTIVE";
    return { ...c, daysSinceLastPurchase: daysSinceLast, status };
  });
};

export const getABCAnalysis = (sales: Sale[]) => {
  const activeSales = sales.filter((s) => !s.deleted);
  if (activeSales.length === 0) return [];

  const clientsData = new Map<string, number>();
  let totalRevenue = 0;

  activeSales.forEach((s) => {
    const current = clientsData.get(s.client) || 0;
    clientsData.set(s.client, current + s.valueSold);
    totalRevenue += s.valueSold;
  });

  const sorted = Array.from(clientsData.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  let cumulative = 0;
  return sorted.map((c) => {
    cumulative += c.revenue;
    const percent = (cumulative / totalRevenue) * 100;
    let classification: "A" | "B" | "C" = "C";
    if (percent <= 70) classification = "A";
    else if (percent <= 90) classification = "B";
    return {
      ...c,
      percentOfTotal: (c.revenue / totalRevenue) * 100,
      cumulativePercent: percent,
      classification
    };
  });
};

export const getSalesByClient = async (clientName: string, clientId?: string): Promise<Sale[]> => {
  const allSales = await getStoredSales();
  return allSales
    .filter((s) => {
      if (clientId && s.clientId === clientId) return true;
      return (s.client || "").toLowerCase() === (clientName || "").toLowerCase();
    })
    .sort(
      (a, b) =>
        new Date(b.date || b.completionDate || 0).getTime() - new Date(a.date || a.completionDate || 0).getTime()
    );
};

export const analyzeMonthlyVolume = (sales: Sale[], months: number) => {
  const data: any[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const name = d.toLocaleDateString("pt-BR", { month: "short" });
    data.push({ name, basica: 0, natal: 0, month: d.getMonth(), year: d.getFullYear() });
  }
  sales.forEach((sale) => {
    if (sale.deleted || !sale.date) return;
    const d = new Date(sale.date);
    const bin = data.find((b) => b.month === d.getMonth() && b.year === d.getFullYear());
    if (bin) {
      if (sale.type === ProductType.BASICA) bin.basica += sale.quantity;
      else bin.natal += sale.quantity;
    }
  });
  return data;
};

export const exportReportToCSV = (data: any[], filename: string) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data
    .map((row) => Object.values(row).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const csvContent = "\uFEFF" + headers + "\n" + rows;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  Logger.info(`Audit: Exportação de CSV finalizada para [${filename}]`);
};

export const calculateProductivityMetrics = async (userId: string): Promise<ProductivityMetrics> => {
  const sales = await getStoredSales();
  const config = await getReportConfig();
  const clients = analyzeClients(sales, config);
  const activeCount = clients.filter((c) => c.status === "ACTIVE" || c.status === "NEW").length;
  const now = new Date();
  const convertedThisMonth = sales.filter((s) => {
    if (s.deleted || !s.date) return false;
    const d = new Date(s.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const conversionRate = activeCount > 0 ? (convertedThisMonth / activeCount) * 100 : 0;
  let productivityStatus: "GREEN" | "YELLOW" | "RED" = "RED";
  if (conversionRate >= 70) productivityStatus = "GREEN";
  else if (conversionRate >= 40) productivityStatus = "YELLOW";

  return { totalClients: clients.length, activeClients: activeCount, convertedThisMonth, conversionRate, productivityStatus };
};

export const getInvoiceMonth = (dateStr: string, closingDay: number): string => {
  const d = new Date(dateStr);
  const day = d.getDate();
  if (day > closingDay) d.setMonth(d.getMonth() + 1);
  return d.toISOString().substring(0, 7);
};

export const clearAllSales = async (): Promise<void> => {
  const dbInst = await initDB();
  await dbInst.clear("sales");
  Logger.warn("Auditoria: Cache local de vendas limpo.");
};

export const generateChallengeCells = (
  challengeId: string,
  target: number,
  count: number,
  model: ChallengeModel
): ChallengeCell[] => {
  const cells: ChallengeCell[] = [];
  const uid = auth.currentUser?.uid || "";
  if (model === "LINEAR") {
    const factor = target / ((count * (count + 1)) / 2);
    for (let i = 1; i <= count; i++)
      cells.push({
        id: crypto.randomUUID(),
        challengeId,
        number: i,
        value: i * factor,
        status: "PENDING",
        userId: uid,
        deleted: false
      });
  } else if (model === "PROPORTIONAL") {
    const val = target / count;
    for (let i = 1; i <= count; i++)
      cells.push({
        id: crypto.randomUUID(),
        challengeId,
        number: i,
        value: val,
        status: "PENDING",
        userId: uid,
        deleted: false
      });
  }
  return cells;
};

export const saveFinanceData = async (data: { transactions?: Transaction[]; accounts?: FinanceAccount[] }) => {
  await validateWriteAccess();
  try {
    if (data.transactions) await dbBulkPut("transactions", data.transactions);
    if (data.accounts) await dbBulkPut("accounts", data.accounts);
    SessionTraffic.trackWrite();
  } catch (e: any) {
    Logger.error(`Audit: Erro ao gravar dados financeiros: ${e.message}`);
    throw e;
  }
};

export const saveSingleSale = async (sale: Sale): Promise<void> => {
  await validateSalesWriteAccess();
  try {
    await dbPut("sales", sale);
    await safeSetDoc("sales", sale.id, sale as any, { merge: true }, sale as any, "UPDATE");
    SessionTraffic.trackWrite();
  } catch (e: any) {
    Logger.error(`Audit: Erro ao gravar venda [${sale.id}]: ${e.message}`);
    throw e;
  }
};

export const computeCommissionValues = (
  quantity: number,
  valueProposed: number,
  margin: number,
  rules: CommissionRule[]
) => {
  const commissionBase = (quantity || 0) * (valueProposed || 0);
  const normalizedRules = (rules || []).map((r) => {
    const minValue = r.minPercent === null ? Number.NEGATIVE_INFINITY : r.minPercent;
    const maxValue = r.maxPercent === null ? Number.POSITIVE_INFINITY : r.maxPercent;
    return { rule: r, minValue, maxValue };
  });
  const sortedRules = normalizedRules.sort((a, b) => a.minValue - b.minValue);
  const overlap = sortedRules.find((item, index) => {
    if (index === 0) return false;
    const prev = sortedRules[index - 1];
    return item.minValue <= prev.maxValue;
  });
  if (overlap) {
    Logger.error("Audit: Faixas de comissão conflitantes encontradas. Verifique duplicidades ou sobreposição.", {
      margin,
      rulesCount: rules?.length ?? 0
    });
    return { commissionBase, commissionValue: 0, rateUsed: 0 };
  }
  const rule = sortedRules.find((r) => margin >= r.minValue && margin <= r.maxValue)?.rule;
  if (!rule) {
    Logger.warn("Audit: Nenhuma faixa de comissão encontrada para a margem informada.", {
      margin,
      rulesCount: rules?.length ?? 0
    });
  }
  const rateUsed = rule ? ensureNumber(rule.commissionRate, 0) : 0;
  return { commissionBase, commissionValue: commissionBase * rateUsed, rateUsed };
};

export const createReceivableFromSale = async (sale: Sale): Promise<string> => {
  await validateWriteAccess();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Unauthenticated");
  const receivableId = crypto.randomUUID();
  const newRec: Receivable = {
    id: receivableId,
    saleId: sale.id,
    description: `Comissão: ${sale.client}`,
    value: sale.commissionValueTotal,
    date: sale.date || new Date().toISOString().split("T")[0],
    status: "PENDING",
    distributed: false,
    deductions: [],
    userId: uid,
    deleted: false
  };
  await dbPut("receivables", newRec);
  await safeSetDoc("receivables", receivableId, newRec as any, { merge: true }, newRec as any, "INSERT");
  SessionTraffic.trackWrite();
  return receivableId;
};

export const subscribeToCommissionRules = (
  type: ProductType,
  callback: (rules: CommissionRule[]) => void,
  onError?: (error: any) => void
) => {
  const colName = type === ProductType.NATAL ? "commission_natal" : "commission_basic";
  const q = query(collection(db, colName), where("isActive", "==", true));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback([]);
        return;
      }

      const rules: CommissionRule[] = [];
      snap.docs.forEach((docSnap) => {
        const docData = docSnap.data();
        if (Array.isArray(docData?.tiers)) {
          docData.tiers.forEach((t: any, idx: number) => {
            const minValue = t.min ?? t.minPercent;
            const maxValue = t.max ?? t.maxPercent;
            rules.push({
              id: `${docSnap.id}_${idx}`,
              minPercent: minValue === null || minValue === undefined ? null : ensureNumber(minValue),
              maxPercent: maxValue === null || maxValue === undefined ? null : ensureNumber(maxValue),
              commissionRate: ensureNumber(t.rate ?? t.commissionRate),
              isActive: true
            });
          });
        } else {
          const minValue = docData.min ?? docData.minPercent;
          const maxValue = docData.max ?? docData.maxPercent;
          rules.push({
            id: docSnap.id,
            minPercent: minValue === null || minValue === undefined ? null : ensureNumber(minValue),
            maxPercent: maxValue === null || maxValue === undefined ? null : ensureNumber(maxValue),
            commissionRate: ensureNumber(docData.rate ?? docData.commissionRate),
            isActive: true
          });
        }
      });

      callback(
        rules.sort(
          (a, b) => (a.minPercent ?? Number.NEGATIVE_INFINITY) - (b.minPercent ?? Number.NEGATIVE_INFINITY)
        )
      );
    },
    (error: any) => {
      console.error("[Logic] Tabela de comissão erro no onSnapshot:", error);
      Logger.error("[Logic] Tabela de comissão erro no onSnapshot", {
        code: error?.code,
        message: error?.message,
        type
      });
      callback([]);
      onError?.(error);
    }
  );
};

export const getStoredTable = async (type: ProductType): Promise<CommissionRule[]> => {
  const colName = type === ProductType.NATAL ? "commission_natal" : "commission_basic";
  const storeName = type === ProductType.NATAL ? "commission_natal" : "commission_basic";

  try {
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
    }
    const q = query(collection(db, colName), where("isActive", "==", true));
    const snap = await getDocsFromServer(q);
    if (!snap.empty) {
      const rules: CommissionRule[] = [];
      snap.docs.forEach((docSnap) => {
        const docData = docSnap.data();
        if (Array.isArray(docData?.tiers)) {
          docData.tiers.forEach((t: any, idx: number) => {
            const minValue = t.min ?? t.minPercent;
            const maxValue = t.max ?? t.maxPercent;
            rules.push({
              id: `${docSnap.id}_${idx}`,
              minPercent: minValue === null || minValue === undefined ? null : ensureNumber(minValue),
              maxPercent: maxValue === null || maxValue === undefined ? null : ensureNumber(maxValue),
              commissionRate: ensureNumber(t.rate ?? t.commissionRate),
              isActive: true
            });
          });
        } else {
          const minValue = docData.min ?? docData.minPercent;
          const maxValue = docData.max ?? docData.maxPercent;
          rules.push({
            id: docSnap.id,
            minPercent: minValue === null || minValue === undefined ? null : ensureNumber(minValue),
            maxPercent: maxValue === null || maxValue === undefined ? null : ensureNumber(maxValue),
            commissionRate: ensureNumber(docData.rate ?? docData.commissionRate),
            isActive: true
          });
        }
      });

      const normalized = rules.sort(
        (a, b) => (a.minPercent ?? Number.NEGATIVE_INFINITY) - (b.minPercent ?? Number.NEGATIVE_INFINITY)
      );
      await dbBulkPut(storeName as any, normalized);
      return normalized;
    }
  } catch (e: any) {
    Logger.error("[Logic] Falha ao buscar tabela de comissão", {
      type,
      message: e?.message,
      code: e?.code
    });
  }

  const cached = await dbGetAll(storeName as any);
  return (cached || [])
    .filter((r: any) => r.isActive)
    .sort(
      (a: any, b: any) =>
        (a.minPercent ?? Number.NEGATIVE_INFINITY) - (b.minPercent ?? Number.NEGATIVE_INFINITY)
    );
};

export const saveCommissionRules = async (type: ProductType, rules: CommissionRule[]) => {
  await validateWriteAccess();
  const colName = type === ProductType.NATAL ? "commission_natal" : "commission_basic";
  const q = query(collection(db, colName), where("isActive", "==", true));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { isActive: false, updatedAt: serverTimestamp() }));
  rules.forEach((rule) => {
    const newDocRef = doc(collection(db, colName));
    batch.set(
      newDocRef,
      sanitizeForFirestore({
        version: Date.now(),
        isActive: true,
        createdAt: serverTimestamp(),
        createdAtLocal: new Date().toISOString(),
        createdBy: auth.currentUser?.uid,
        min: rule.minPercent === null ? null : Number(rule.minPercent),
        max: rule.maxPercent === null ? null : Number(rule.maxPercent),
        rate: Number(rule.commissionRate)
      })
    );
  });
  await batch.commit();
  Logger.info(`Audit: Tabela de comissão [${type}] atualizada globalmente.`);
};

type SalesQueryDiagnostics = {
  uid: string | null;
  cloudCount: number;
  localCount: number;
  cloudEmpty: boolean;
  lastSyncAt: string;
  error?: string;
  errorCode?: string;
  indexRequired?: boolean;
};

let lastSalesQueryDiagnostics: SalesQueryDiagnostics = {
  uid: null,
  cloudCount: 0,
  localCount: 0,
  cloudEmpty: false,
  lastSyncAt: new Date(0).toISOString(),
  errorCode: undefined,
  indexRequired: false
};

export const getSalesQueryDiagnostics = (): SalesQueryDiagnostics => lastSalesQueryDiagnostics;

export const getStoredSales = async (): Promise<Sale[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    Logger.warn("Audit: Tentativa de carregar vendas sem usuário autenticado.");
    lastSalesQueryDiagnostics = {
      uid: null,
      cloudCount: 0,
      localCount: 0,
      cloudEmpty: true,
      lastSyncAt: new Date().toISOString(),
      error: "missing-user"
    };
    return [];
  }

  let cloudCount = 0;
  let cloudEmpty = false;
  let errorMessage: string | undefined;
  let errorCode: string | undefined;
  let indexRequired = false;

  try {
    const q = query(collection(db, "sales"), where("userId", "==", uid), limit(1000));
    const snap = await getDocsFromServer(q);
    cloudCount = snap.size;
    cloudEmpty = snap.empty;

    const cloudSales = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Sale));

    const missingDeleted = cloudSales.filter((sale) => (sale as any).deleted === undefined).length;
    Logger.info("Audit: Vendas carregadas do Firestore.", { uid, cloudCount, missingDeleted });

    if (snap.empty) {
      Logger.warn("Audit: Query de vendas no Firestore retornou vazia.", { uid });
    }

    await dbBulkPutSkipPending("sales", cloudSales);
  } catch (e: any) {
    errorMessage = e?.message;
    errorCode = e?.code;
    indexRequired = e?.code === "failed-precondition" || Boolean(e?.message?.includes("requires an index"));
    Logger.error("Audit: Falha ao buscar vendas no Firestore.", { uid, message: e?.message, code: e?.code });
    console.error("[Bootstrap] Firestore sales query falhou.", { code: e?.code, message: e?.message });
  }

  const localSales = await dbGetAll("sales", (s) => s.userId === uid);
  const filtered = (localSales || []).filter((s: any) => !s.deleted);

  const localOrphans = await dbGetAll("sales", (s) => !(s as any).userId);
  if (localOrphans.length > 0) {
    Logger.warn("Audit: Vendas locais sem userId detectadas.", { uid, count: localOrphans.length });
  }

  lastSalesQueryDiagnostics = {
    uid,
    cloudCount,
    localCount: filtered.length,
    cloudEmpty,
    lastSyncAt: new Date().toISOString(),
    error: errorMessage,
    errorCode,
    indexRequired
  };

  filtered.sort((a: any, b: any) => {
    const da = new Date(a.createdAt || a.date || a.completionDate || 0).getTime();
    const dbb = new Date(b.createdAt || b.date || b.completionDate || 0).getTime();
    return dbb - da;
  });

  return filtered;
};

export const getSalesTasks = async (): Promise<SalesTask[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  try {
    const q = query(collection(db, "sales_tasks"), where("userId", "==", uid), limit(800));
    const snap = await getDocsFromServer(q);
    const tasks = snap.docs.map((d) => ({ ...d.data(), id: d.id } as SalesTask));
    await dbBulkPutSkipPending("sales_tasks", tasks);
  } catch {}
  const local = await dbGetAll("sales_tasks", (t) => t.userId === uid);
  return (local || []).sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
};

export const saveSalesTask = async (task: SalesTask): Promise<void> => {
  await validateSalesWriteAccess();
  await dbPut("sales_tasks", task);
  await safeSetDoc("sales_tasks", task.id, task as any, { merge: true }, task as any, "UPDATE");
};

export const getClients = async (): Promise<Client[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  try {
    const q = query(collection(db, "clients"), where("userId", "==", uid), limit(1000));
    const snap = await getDocsFromServer(q);
    const cloud = snap.docs.map((d) => ({ ...(d.data() as any), id: d.id })) as Client[];
    await dbBulkPutSkipPending("clients" as any, cloud as any);
  } catch {}

  const local = await dbGetAll("clients" as any, (c: any) => c.userId === uid);
  return (local || [])
    .filter((c: any) => !c.deleted)
    .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
};

export const getFinanceData = async () => {
  const uid = auth.currentUser?.uid;
  if (!uid)
    return {
      accounts: [],
      transactions: [],
      cards: [],
      categories: [],
      goals: [],
      challenges: [],
      cells: [],
      receivables: []
    };

  const tables = ["accounts", "transactions", "cards", "categories", "goals", "challenges", "challenge_cells", "receivables"];

  for (const table of tables) {
    try {
      const q = query(collection(db, table), where("userId", "==", uid), limit(1500));
      const snap = await getDocsFromServer(q);
      await dbBulkPutSkipPending(
        table as any,
        snap.docs.map((d) => ({ ...(d.data() as any), id: d.id })) as any
      );
    } catch {}
  }

  const accounts = await dbGetAll("accounts", (a) => a.userId === uid);
  const transactions = await dbGetAll("transactions", (t) => t.userId === uid);
  const cards = await dbGetAll("cards", (c) => c.userId === uid);
  const categories = await dbGetAll("categories", (c) => c.userId === uid);
  const goals = await dbGetAll("goals", (g) => g.userId === uid);
  const challenges = await dbGetAll("challenges", (ch) => ch.userId === uid);
  const cells = await dbGetAll("challenge_cells", (cl) => cl.userId === uid);
  const receivables = await dbGetAll("receivables", (r) => r.userId === uid);

  return {
    accounts: (accounts || []).filter((a: any) => !a.deleted),
    transactions: (transactions || []).filter((t: any) => !t.deleted),
    cards: (cards || []).filter((c: any) => !c.deleted),
    categories: (categories || []).filter((c: any) => !c.deleted),
    goals: (goals || []).filter((g: any) => !g.deleted),
    challenges: (challenges || []).filter((ch: any) => !ch.deleted),
    cells: (cells || []).filter((cl: any) => !cl.deleted),
    receivables: (receivables || []).filter((r: any) => !r.deleted)
  };
};

export const handleSoftDelete = async (table: string, id: string) => {
  if (table === "sales") await validateSalesWriteAccess();
  else await validateWriteAccess();

  try {
    const local = await dbGet(table as any, id);
    const nowIso = new Date().toISOString();
    if (local) await dbPut(table as any, { ...local, deleted: true, deletedAt: nowIso });
    await safeUpdateDoc(
      table as any,
      id,
      { deleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() } as any,
      { deleted: true, deletedAt: nowIso, updatedAt: nowIso } as any
    );
  } catch (e: any) {
    Logger.error(`Audit: Falha ao deletar item [${id}] de [${table}]: ${e.message}`);
  }
};

export const getSystemConfig = async (): Promise<SystemConfig> => {
  const normalizeSystemConfig = (config?: SystemConfig | null): SystemConfig => {
    const mergedModules = { ...DEFAULT_SYSTEM_CONFIG.modules, ...(config?.modules || {}) };
    return {
      ...DEFAULT_SYSTEM_CONFIG,
      ...config,
      modules: mergedModules,
      includeNonAccountingInTotal: config?.includeNonAccountingInTotal ?? DEFAULT_SYSTEM_CONFIG.includeNonAccountingInTotal,
      isMaintenanceMode: config?.isMaintenanceMode ?? DEFAULT_SYSTEM_CONFIG.isMaintenanceMode,
      salesLockEnabled: config?.salesLockEnabled ?? DEFAULT_SYSTEM_CONFIG.salesLockEnabled,
      paymentMethods: config?.paymentMethods ?? DEFAULT_SYSTEM_CONFIG.paymentMethods,
      avistaLowMarginRuleEnabled: config?.avistaLowMarginRuleEnabled ?? DEFAULT_SYSTEM_CONFIG.avistaLowMarginRuleEnabled,
      avistaLowMarginCommissionPct: config?.avistaLowMarginCommissionPct ?? DEFAULT_SYSTEM_CONFIG.avistaLowMarginCommissionPct,
      avistaLowMarginPaymentMethods:
        config?.avistaLowMarginPaymentMethods ?? DEFAULT_SYSTEM_CONFIG.avistaLowMarginPaymentMethods
    };
  };

  try {
    const snap = await getDocFromServer(doc(db, "config", "system"));
    if (snap.exists()) return normalizeSystemConfig(snap.data() as SystemConfig);
  } catch {}

  const local = await dbGet("config" as any, "system");
  if (local) return normalizeSystemConfig(local as SystemConfig);

  return DEFAULT_SYSTEM_CONFIG;
};

export const saveSystemConfig = async (config: SystemConfig) => {
  await validateWriteAccess();
  const normalized = {
    ...DEFAULT_SYSTEM_CONFIG,
    ...config,
    modules: {
      ...DEFAULT_SYSTEM_CONFIG.modules,
      ...config.modules
    }
  };
  await dbPut("config", { ...normalized, id: "system" } as any);
  await safeSetDoc("config", "system", normalized as any, { merge: true }, { ...normalized, id: "system" } as any, "UPDATE");
  Logger.info(`Audit: Configuração do sistema salva.`);
};

export const permanentlyDeleteClient = async (id: string) => {
  await validateWriteAccess();
  await dbDelete("clients", id);
};

export const readExcelFile = (file: File): Promise<any[][]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      try {
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        resolve(json as any[][]);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (ex) => reject(ex);
    reader.readAsArrayBuffer(file);
  });
};

export const downloadSalesTemplate = () => {
  const url = "/modelo_importacao_vendas360.xlsx";
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "modelo_importacao_vendas360.xlsx");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const saveSales = async (sales: Sale[]) => {
  await validateSalesWriteAccess();
  await dbBulkPut("sales", sales);

  if (!isOnline()) {
    await Promise.all(sales.map((s) => safeSetDoc("sales", s.id, s as any, { merge: true }, s as any, "UPDATE")));
    SessionTraffic.trackWrite(sales.length);
    return;
  }

  try {
    const batch = writeBatch(db);
    for (const sale of sales) {
      const saleRef = doc(db, "sales", sale.id);
      batch.set(saleRef, sanitizeForFirestore(sale), { merge: true });
    }
    await batch.commit();
    SessionTraffic.trackWrite(sales.length);
  } catch {
    await Promise.all(sales.map((s) => safeSetDoc("sales", s.id, s as any, { merge: true }, s as any, "UPDATE")));
    SessionTraffic.trackWrite(sales.length);
  }
};

export const bulkBillSales = async (ids: string[], date: string, createReceivables = false) => {
  await validateSalesWriteAccess();
  const allSales = await dbGetAll("sales");
  const targets = (allSales || []).filter((s: any) => ids.includes(s.id));
  const updates: Sale[] = [];

  for (const sale of targets) {
    const updated = {
      ...(sale as any),
      date,
      isBilled: true,
      status: "FATURADO" as const,
      updatedAt: new Date().toISOString()
    };
    await dbPut("sales", updated);
    updates.push(updated);
    if (createReceivables) {
      await createReceivableFromSale(updated);
    }
  }

  if (!isOnline()) {
    await Promise.all(updates.map((u) => safeSetDoc("sales", u.id, u as any, { merge: true }, u as any, "UPDATE")));
    Logger.info(`Audit: Faturamento em lote enfileirado para ${ids.length} vendas.`);
    return;
  }

  try {
    const batch = writeBatch(db);
    for (const updated of updates) {
      batch.set(doc(db, "sales", updated.id), sanitizeForFirestore(updated), { merge: true });
    }
    await batch.commit();
  } catch {
    await Promise.all(updates.map((u) => safeSetDoc("sales", u.id, u as any, { merge: true }, u as any, "UPDATE")));
  }
  Logger.info(`Audit: Faturamento em lote executado para ${ids.length} vendas.`);
};

export const deleteReceivablesBySaleIds = async (saleIds: string[]) => {
  await validateWriteAccess();
  const uid = auth.currentUser?.uid;
  if (!uid || saleIds.length === 0) return;
  const receivables = await dbGetAll("receivables", (r) => r.userId === uid && !r.deleted && saleIds.includes(r.saleId || ""));
  await Promise.all(receivables.map((rec) => handleSoftDelete("receivables", rec.id)));
};

export const getTicketStats = async (): Promise<number> => {
  return getOpenTicketCount();
};

export const findPotentialDuplicates = (sales: Sale[]) => {
  const activeSales = sales.filter((sale) => !sale.deleted);
  const uniqueNames = Array.from(new Set(activeSales.map((sale) => sale.client)));
  const duplicates: { master: string; similar: string[] }[] = [];
  const processed = new Set<string>();
  const normalize = (str: string) =>
    str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

  for (let i = 0; i < uniqueNames.length; i++) {
    const nameA = uniqueNames[i];
    if (processed.has(nameA)) continue;
    const normA = normalize(nameA);
    const similar: string[] = [];
    for (let j = i + 1; j < uniqueNames.length; j++) {
      const nameB = uniqueNames[j];
      if (processed.has(nameB)) continue;
      const normB = normalize(nameB);
      if (normA === normB || (normA.length > 5 && normB.length > 5 && (normA.includes(normB) || normB.includes(normA)))) {
        similar.push(nameB);
        processed.add(nameB);
      }
    }
    if (similar.length > 0) {
      duplicates.push({ master: nameA, similar });
      processed.add(nameA);
    }
  }
  return duplicates;
};

export const exportEncryptedBackup = async (_passphrase: string) => {
  const data: any = {};
  const tables = ["sales", "transactions", "accounts", "clients", "cards", "categories", "goals", "challenges", "challenge_cells", "receivables"];
  for (const t of tables) data[t] = await dbGetAll(t as any);
  const blob = new Blob([JSON.stringify(data)], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_gestor360_${Date.now()}.json`;
  a.click();
};

export const calculateFinancialPacing = (balance: number, expenses: Transaction[]): FinancialPacing => {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = endOfMonth.getDate() - now.getDate() + 1;

  const pendingExpenses = expenses
    .filter((e) => !e.isPaid && e.type === "EXPENSE")
    .reduce((acc, e) => acc + e.amount, 0);

  const safeDailySpend = (balance - pendingExpenses) / Math.max(1, daysRemaining);

  return {
    daysRemaining,
    safeDailySpend: Math.max(0, safeDailySpend),
    pendingExpenses,
    nextIncomeDate: new Date()
  };
};

export const markAsReconciled = async (txId: string, status: boolean) => {
  await validateWriteAccess();
  const nowIso = new Date().toISOString();
  await safeUpdateDoc(
    "transactions",
    txId,
    { reconciled: status, reconciledAt: status ? serverTimestamp() : null, updatedAt: serverTimestamp() } as any,
    { reconciled: status, reconciledAt: status ? nowIso : null, updatedAt: nowIso } as any
  );

  const local = await dbGet("transactions", txId);
  if (local) {
    await dbPut("transactions", {
      ...local,
      reconciled: status,
      reconciledAt: status ? new Date().toISOString() : undefined
    } as any);
  }
};

export const bulkMarkAsReconciled = async (ids: string[], status: boolean) => {
  await validateWriteAccess();
  const nowIso = new Date().toISOString();

  for (const id of ids) {
    const local = await dbGet("transactions", id);
    if (local) {
      await dbPut("transactions", {
        ...local,
        reconciled: status,
        reconciledAt: status ? nowIso : undefined
      } as any);
    }
  }

  if (!isOnline()) {
    await Promise.all(
      ids.map((id) =>
        safeUpdateDoc(
          "transactions",
          id,
          { reconciled: status, reconciledAt: status ? serverTimestamp() : null, updatedAt: serverTimestamp() } as any,
          { reconciled: status, reconciledAt: status ? nowIso : null, updatedAt: nowIso } as any
        )
      )
    );
    return;
  }

  try {
    const batch = writeBatch(db);
    for (const id of ids) {
      batch.update(doc(db, "transactions", id), {
        reconciled: status,
        reconciledAt: status ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();
  } catch {
    await Promise.all(
      ids.map((id) =>
        safeUpdateDoc(
          "transactions",
          id,
          { reconciled: status, reconciledAt: status ? serverTimestamp() : null, updatedAt: serverTimestamp() } as any,
          { reconciled: status, reconciledAt: status ? nowIso : null, updatedAt: nowIso } as any
        )
      )
    );
  }
};

export const importEncryptedBackup = async (file: File, _passphrase: string) => {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        for (const table in data) {
          if (Array.isArray(data[table])) {
            await dbBulkPut(table as any, data[table]);
          }
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

export const processFinanceImport = async (data: any[][], mapping: ImportMapping) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const categories = (await dbGetAll("categories", (c) => (c as any).userId === uid)) || [];
  const accounts = (await dbGetAll("accounts", (a) => (a as any).userId === uid)) || [];
  const cards = (await dbGetAll("cards", (c) => (c as any).userId === uid)) || [];

  const normalize = (value: any) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "");

  const parseDateValue = (value: any) => {
    if (!value) return new Date().toISOString().split("T")[0];
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().split("T")[0];
    }
    if (typeof value === "number") {
      const parsed = XLSX.SSF ? XLSX.SSF.parse_date_code(value) : null;
      if (parsed) {
        const formatted = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
        return formatted;
      }
    }
    const text = String(value).trim();
    if (!text) return new Date().toISOString().split("T")[0];
    const ddmmyyyy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, dd, mm, yyyy] = ddmmyyyy;
      return `${yyyy}-${mm}-${dd}`;
    }
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split("T")[0];
    return parsed.toISOString().split("T")[0];
  };

  const transactions: Transaction[] = [];
  const batch = writeBatch(db);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const dateIdx = mapping["date"];
    const descIdx = mapping["description"];
    const amountIdx = mapping["amount"];
    const typeIdx = mapping["type"];
    const categoryIdx = mapping["category"];
    const accountIdx = mapping["account"];
    const personIdx = mapping["person"];

    if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) continue;

    const amount = ensureNumber(row[amountIdx]);
    const typeRaw = typeIdx !== -1 ? String(row[typeIdx] || "") : "";
    const typeNormalized = normalize(typeRaw);
    const type =
      typeNormalized.includes("rec") || typeNormalized.includes("entr")
        ? "INCOME"
        : typeNormalized.includes("desp") || typeNormalized.includes("sai")
          ? "EXPENSE"
          : typeNormalized.includes("transf")
            ? "TRANSFER"
            : amount >= 0
              ? "INCOME"
              : "EXPENSE";

    let categoryId = "uncategorized";
    if (categoryIdx !== undefined && categoryIdx !== -1) {
      const rawCategory = row[categoryIdx];
      const normalized = normalize(rawCategory);
      const matched = categories.find((c: any) => normalize(c.name) === normalized);
      if (matched?.id) categoryId = matched.id;
    }

    let accountId = "";
    let cardId: string | null = null;
    if (accountIdx !== undefined && accountIdx !== -1) {
      const rawAccount = row[accountIdx];
      const normalized = normalize(rawAccount);
      const matchedAccount = accounts.find((a: any) => normalize(a.name) === normalized);
      const matchedCard = cards.find((c: any) => normalize(c.name) === normalized);
      if (matchedAccount?.id) {
        accountId = matchedAccount.id;
      } else if (matchedCard?.id) {
        cardId = matchedCard.id;
      }
    }

    const personType =
      personIdx !== undefined && personIdx !== -1
        ? String(row[personIdx] || "").toUpperCase().includes("PJ")
          ? "PJ"
          : "PF"
        : "PF";

    const txId = crypto.randomUUID();
    const tx: Transaction = {
      id: txId,
      description: String(row[descIdx] || "Importado"),
      amount: Math.abs(amount),
      type: type as any,
      date: parseDateValue(row[dateIdx]),
      isPaid: true,
      provisioned: false,
      isRecurring: false,
      deleted: false,
      createdAt: new Date().toISOString(),
      userId: uid,
      categoryId,
      accountId,
      cardId,
      personType: personType as any
    };

    transactions.push(tx);
    batch.set(doc(db, "transactions", txId), sanitizeForFirestore(tx));
  }

  if (transactions.length > 0) {
    await batch.commit();
    await dbBulkPut("transactions", transactions);
  }
};

export const atomicClearUserTables = async (userId: string, tables: string[]) => {
  await validateWriteAccess();
  for (const table of tables) {
    const q = query(collection(db, table), where("userId", "==", userId), limit(5000));
    const snap = await getDocsFromServer(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    const local = await dbGetAll(table as any);
    for (const item of local) {
      if ((item as any).userId === userId) await dbDelete(table as any, (item as any).id);
    }
  }
};

export const resetSalesToSoftDeletedSeed = async (seed?: Partial<Sale>): Promise<string> => {
  await validateSalesWriteAccess();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Unauthenticated");

  await atomicClearUserTables(uid, ["sales", "clients", "sales_tasks", "receivables", "transactions"]);
  const localClearTables = [
    "sales",
    "clients",
    "sales_tasks",
    "receivables",
    "transactions",
    "accounts",
    "cards",
    "categories",
    "goals",
    "challenges",
    "challenge_cells",
    "sync_queue"
  ] as const;
  for (const table of localClearTables) {
    await dbClearStore(table as any);
  }

  const nowIso = new Date().toISOString();
  const date = nowIso.split("T")[0];
  const seedSale: Sale = {
    id: seed?.id || crypto.randomUUID(),
    userId: uid,
    client: seed?.client || "SEED (INATIVO)",
    quantity: seed?.quantity ?? 12,
    type: seed?.type || ProductType.BASICA,
    status: seed?.status || "FATURADO",
    valueProposed: seed?.valueProposed ?? 250,
    valueSold: seed?.valueSold ?? 264.6,
    marginPercent: seed?.marginPercent ?? 42.05,
    quoteDate: seed?.quoteDate || date,
    completionDate: seed?.completionDate || date,
    date: seed?.date || date,
    isBilled: seed?.isBilled ?? true,
    hasNF: seed?.hasNF ?? false,
    observations: seed?.observations || "Seed soft deleted (exemplo)",
    trackingCode: seed?.trackingCode || "SEED-EXEMPLO",
    commissionBaseTotal: seed?.commissionBaseTotal ?? 3000,
    commissionValueTotal: seed?.commissionValueTotal ?? 150,
    commissionRateUsed: seed?.commissionRateUsed ?? 0.05,
    createdAt: seed?.createdAt || nowIso,
    updatedAt: nowIso,
    deleted: true,
    deletedAt: nowIso,
    paymentMethod: seed?.paymentMethod || "a vista"
  };

  await dbPut("sales", seedSale);
  await safeSetDoc("sales", seedSale.id, seedSale as any, { merge: true }, seedSale as any, "UPDATE");
  Logger.warn("Audit: Vendas resetadas com seed soft deleted.", { userId: uid, seedId: seedSale.id });

  return seedSale.id;
};

export const clearNotifications = async (userId: string, source: string) => {
  await validateWriteAccess();
  const colRef = collection(db, "notifications");
  const q =
    source === "ALL"
      ? query(colRef, where("userId", "==", userId), limit(5000))
      : query(colRef, where("userId", "==", userId), where("source", "==", source), limit(5000));

  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

export const smartMergeSales = (items: Sale[]): Sale => {
  const sorted = [...items].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const master = sorted[0];
  const duplicates = sorted.slice(1);

  const obs = [master.observations, ...duplicates.map((d: any) => d.observations)].filter(Boolean).join(" | ");

  return {
    ...(master as any),
    observations: obs,
    updatedAt: new Date().toISOString()
  } as any;
};

export const bootstrapProductionData = async (): Promise<void> => {
  try {
    const user = getSession();
    const cfg = await getSystemConfig();

    const merged: SystemConfig = {
      ...DEFAULT_SYSTEM_CONFIG,
      ...cfg,
      modules: {
        ...DEFAULT_SYSTEM_CONFIG.modules,
        ...(cfg?.modules || {})
      }
    };

    if (user?.role === "DEV") {
      await saveSystemConfig(merged);
    } else {
      await dbPut("config" as any, { ...merged, id: "system" } as any);
    }

    Logger.info("Bootstrap: Ambiente inicializado.", { role: user?.role || "unknown" });
  } catch (e: any) {
    Logger.warn("Bootstrap: Falha silenciosa.", { message: e?.message, code: e?.code });
  }
};

// ===============================
// REPORT CONFIG (user-scope, compatível com rules atuais)
// ===============================

const DEFAULT_REPORT_CONFIG: ReportConfig = {
  daysForNewClient: 30,
  daysForInactive: 60,
  daysForLost: 180
};

export const getReportConfig = async (): Promise<ReportConfig> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return DEFAULT_REPORT_CONFIG;

  try {
    const snap = await getDocFromServer(doc(db, "users", uid));
    if (snap.exists()) {
      const data: any = snap.data();
      if (data?.reportConfig) {
        const merged = { ...DEFAULT_REPORT_CONFIG, ...(data.reportConfig as ReportConfig) };
        await dbPut("config" as any, { id: "report", ...merged } as any);
        return merged;
      }
    }
  } catch {}

  try {
    const local = await dbGet("config" as any, "report");
    if (local) return { ...DEFAULT_REPORT_CONFIG, ...(local as any) };
  } catch {}

  return DEFAULT_REPORT_CONFIG;
};

export const saveReportConfig = async (cfg: ReportConfig): Promise<void> => {
  await validateWriteAccess();
  const uid = auth.currentUser?.uid;

  const normalized: ReportConfig = { ...DEFAULT_REPORT_CONFIG, ...(cfg || {}) };
  await dbPut("config" as any, { id: "report", ...normalized } as any);

  if (uid) {
    const nowIso = new Date().toISOString();
    await safeUpdateDoc(
      "users" as any,
      uid,
      { reportConfig: normalized, updatedAt: serverTimestamp() } as any,
      { reportConfig: normalized, updatedAt: nowIso } as any
    );
  }

  Logger.info("Audit: ReportConfig salvo.", normalized as any);
};

// ===============================
// CLIENTS / TRASH / RESTORE (exports esperados pela UI)
// ===============================

export const createClientAutomatically = async (clientName: string): Promise<string> => {
  await validateWriteAccess();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Unauthenticated");

  const name = String(clientName || "").trim();
  if (!name) throw new Error("Cliente inválido");

  const normalize = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const existing = await dbGetAll("clients" as any, (c: any) => c.userId === uid);
  const found = (existing || []).find((c: any) => !c.deleted && normalize(c.name || "") === normalize(name));
  if (found?.id) return found.id;

  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const client: Client = {
    id,
    userId: uid,
    name,
    contactName: "",
    contactPhone: "",
    notes: "",
    clientStatus: "ACTIVE",
    createdAt: nowIso,
    updatedAt: nowIso,
    deleted: false
  };

  await dbPut("clients" as any, client as any);
  await safeSetDoc("clients" as any, id, client as any, { merge: true }, client as any, "INSERT");
  return id;
};

export const getTrashItems = async (): Promise<{ sales: Sale[]; transactions: Transaction[] }> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return { sales: [], transactions: [] };

  try {
    const qs = query(collection(db, "sales"), where("userId", "==", uid), limit(1500));
    const qt = query(collection(db, "transactions"), where("userId", "==", uid), limit(1500));
    const [ss, tt] = await Promise.all([getDocsFromServer(qs), getDocsFromServer(qt)]);
    await dbBulkPutSkipPending("sales" as any, ss.docs.map((d) => ({ ...(d.data() as any), id: d.id })) as any);
    await dbBulkPutSkipPending("transactions" as any, tt.docs.map((d) => ({ ...(d.data() as any), id: d.id })) as any);
  } catch {}

  const sales = await dbGetAll("sales" as any, (s: any) => s.userId === uid && !!s.deleted);
  const transactions = await dbGetAll("transactions" as any, (t: any) => t.userId === uid && !!t.deleted);

  return {
    sales: (sales || []).sort((a: any, b: any) => (b.deletedAt || "").localeCompare(a.deletedAt || "")),
    transactions: (transactions || []).sort((a: any, b: any) => (b.deletedAt || "").localeCompare(a.deletedAt || ""))
  };
};

export const restoreItem = async (type: "sales" | "transactions", item: Sale | Transaction): Promise<void> => {
  await validateWriteAccess();
  const nowIso = new Date().toISOString();
  const restored: any = { ...(item as any), deleted: false, deletedAt: undefined, updatedAt: nowIso };

  await dbPut(type as any, restored);
  await safeUpdateDoc(
    type as any,
    (item as any).id,
    { deleted: false, deletedAt: null, updatedAt: serverTimestamp() } as any,
    { deleted: false, deletedAt: null, updatedAt: nowIso } as any
  );
};

export const permanentlyDeleteItem = async (type: "sales" | "transactions", id: string): Promise<void> => {
  await validateWriteAccess();
  await dbDelete(type as any, id);
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, type, id));
    await batch.commit();
  } catch {}
};

export const getDeletedClients = async (): Promise<Client[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const local = await dbGetAll("clients" as any, (c: any) => c.userId === uid);
  return (local || [])
    .filter((c: any) => !!c.deleted)
    .sort((a: any, b: any) => (b.deletedAt || "").localeCompare(a.deletedAt || ""));
};

export const restoreClient = async (client: Client): Promise<void> => {
  await validateWriteAccess();
  const nowIso = new Date().toISOString();

  const restored: any = { ...(client as any), deleted: false, deletedAt: undefined, updatedAt: nowIso };
  await dbPut("clients" as any, restored);

  await safeUpdateDoc(
    "clients" as any,
    client.id,
    { deleted: false, deletedAt: null, updatedAt: serverTimestamp() } as any,
    { deleted: false, deletedAt: null, updatedAt: nowIso } as any
  );
};
