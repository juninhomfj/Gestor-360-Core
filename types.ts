
// types.ts - Centralized Type Definitions for Gestor360 (v3.2.0)

export type AppMode = 'SALES' | 'FINANCE';

export type UserRole = 'USER' | 'ADMIN' | 'DEV';

export type UserStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE';

export interface UserPermissions {
  // Núcleo (Vendas + Finanças)
  sales: boolean;
  finance: boolean;
  crm: boolean;

  // Áreas transversais
  settings: boolean;
  dev: boolean;
  chat: boolean;
  logs: boolean;
  users: boolean;
  profiles: boolean;

  // Submódulos/Recursos (Finance/Sales)
  receivables: boolean;
  distribution: boolean;
  imports: boolean;

  // Enterprise (mantidos porque existem telas/relatórios internos)
  abc_analysis: boolean;
  ltv_details: boolean;
  manual_billing: boolean;
  audit_logs: boolean;
}

export interface UserPrefs {
  defaultModule?: string;
}

export type UserModules = UserPermissions;
export type SystemModules = UserPermissions;

export type AppTheme = 'glass' | 'neutral' | 'rose' | 'cyberpunk' | 'dark';

export interface User {
  id: string;
  uid: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  theme: AppTheme;
  userStatus: UserStatus;
  createdAt: string;
  updatedAt: string;
  permissions: UserPermissions;
  hiddenModules?: Partial<UserPermissions>;
  salesTargets?: SalesTargets;
  profilePhoto: string;
  tel: string;
  prefs?: UserPrefs;
  contactVisibility?: 'PUBLIC' | 'PRIVATE';
  fcmToken?: string;
  financialProfile?: {
    salaryDays?: number[];
    salaryDay?: number;
  };
}

// ... tipos restantes inalterados ...
// --- NOTIFICATIONS & MESSAGING ---

export type NotificationType = 'INFO' | 'ALERT' | 'WARNING';
export type NotificationSource = 'SALES' | 'FINANCE' | 'SYSTEM';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  source: NotificationSource;
  date: string;
  read: boolean;
}

export interface InternalMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  content: string;
  image: string;
  mediaType?: 'image' | 'gif' | 'sticker' | 'audio' | 'video' | 'other';
  mediaUrl?: string;
  roomId?: string;
  type: 'CHAT' | 'ACCESS_REQUEST' | 'BROADCAST' | 'BUG_REPORT' | 'SYSTEM';
  timestamp: string;
  read: boolean;
  deleted: boolean;
  relatedModule?: 'sales' | 'finance';
  readBy?: string[];
}

export type ChatMessageType = 'CHAT' | 'ACCESS_REQUEST' | 'BROADCAST' | 'BUG_REPORT' | 'SYSTEM';
export type ChatMessageStatus = 'sending' | 'uploading' | 'sent' | 'failed';
export type ChatAttachmentStatus = 'queued' | 'uploading' | 'complete' | 'failed' | 'canceled';

export interface ChatAttachment {
  id: string;
  messageId: string;
  path: string;
  mime: string;
  size: number;
  uploadedBy: string;
  fileName?: string;
  downloadUrl?: string;
  progress?: number;
  status?: ChatAttachmentStatus;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId?: string | null;
  roomId?: string | null;
  content: string;
  type: ChatMessageType;
  timestamp: string;
  read?: boolean | null;
  readBy?: string[] | null;
  attachments?: ChatAttachment[];
  status?: ChatMessageStatus;
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TicketAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  module: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId?: string;
  assigneeName?: string;
  createdById: string;
  createdByName: string;
  createdByEmail?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  logs?: LogEntry[];
  attachments?: TicketAttachment[];
}

export interface CommissionRule {
  id: string;
  minPercent: number;
  maxPercent: number | null;
  commissionRate: number;
  isActive: boolean;
}

export type CommissionCampaignType = 'META_BAIXA_MARGEM';

export type CommissionCampaignTag = 'PREMIACAO_AVISTA' | 'PREMIACAO_META';

export interface CommissionCampaignTier {
  from: number;
  to: number;
  commissionPct: number;
}

export interface CommissionCampaignRulesMeta {
  minMargin: number;
  maxMarginExclusive: number;
  tiers: CommissionCampaignTier[];
  requiresGoalHit: boolean;
  goalMetric: 'CESTAS_BASICAS_VOLUME';
  goalMonthlyTargetField: string;
}

export type CommissionCampaignRules = CommissionCampaignRulesMeta;

export interface CommissionCampaign {
  id: string;
  active: boolean;
  type: CommissionCampaignType;
  name: string;
  companyId: string;
  startMonth: string;
  endMonth: string;
  rules: CommissionCampaignRules;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export enum ProductType {
  BASICA = 'BASICA',
  NATAL = 'NATAL',
  CUSTOM = 'CUSTOM'
}

export type SaleStatus = 'ORÇAMENTO' | 'FATURADO';

export type SalesTaskStatus = 'OPEN' | 'DONE';
export type SalesTaskType = 'ENVIAR_BOLETO' | 'COBRAR' | 'AVISAR_ENTREGA';

export interface Sale {
  id: string;
  userId: string;
  client: string;
  quantity: number;
  type: ProductType;
  status: SaleStatus;
  valueProposed: number;
  valueSold: number;
  marginPercent: number;
  quoteDate?: string;
  completionDate?: string;
  date?: string;
  isBilled: boolean;
  hasNF: boolean;
  observations: string;
  trackingCode: string;
  commissionBaseTotal: number;
  commissionValueTotal: number;
  commissionRateUsed: number;
  campaignTag?: CommissionCampaignTag;
  campaignLabel?: string;
  campaignMessage?: string;
  campaignRateUsed?: number;
  campaignColor?: 'emerald' | 'amber';
  campaignBaseCommissionValueTotal?: number;
  createdAt: string;
  updatedAt?: string;
  deleted: boolean;
  deletedAt?: string;
  clientId?: string;
  boletoStatus?: 'PENDING' | 'SENT' | 'PAID';
  paymentMethod?: string;
}

export interface SalesTask {
  id: string;
  userId: string;
  saleId: string;
  saleClient?: string;
  type: SalesTaskType;
  dueDate: string;
  status: SalesTaskStatus;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface ReportConfig {
  daysForNewClient: number;
  daysForInactive: number;
  daysForLost: number;
}

export interface ProductivityMetrics {
  totalClients: number;
  activeClients: number;
  convertedThisMonth: number;
  conversionRate: number;
  productivityStatus: 'GREEN' | 'YELLOW' | 'RED';
}

export type PersonType = 'PF' | 'PJ';

export interface FinanceAccount {
  id: string;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CASH' | 'INTERNAL';
  balance: number;
  color: string;
  isAccounting: boolean;
  includeInDistribution: boolean;
  personType: PersonType;
  isActive: boolean;
  deleted: boolean;
  userId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  limit: number;
  currentInvoice: number;
  closingDay: number;
  dueDay: number;
  color: string;
  personType: PersonType;
  isActive: boolean;
  deleted: boolean;
  userId: string;
  createdAt?: string;
}

export interface Transaction { 
    id: string; 
    description: string; 
    amount: number; 
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'IN' | 'OUT'; 
    date: string; 
    realizedAt?: string; 
    categoryId: string; 
    accountId: string; 
    isPaid: boolean; 
    provisioned: boolean; 
    isRecurring: boolean; 
    recurrenceRule?: string; 
    personType?: PersonType; 
    deleted: boolean; 
    createdAt: string; 
    userId: string; 
    targetAccountId?: string;
    updatedAt?: string;
    deletedAt?: string;
    attachments?: string[];
    subcategory?: string;
    paymentMethod?: string;
    installments?: number;
    costCenter?: string;
    tags?: string[];
    cardId?: string | null;
    reconciled?: boolean;
    reconciledAt?: string;
}

export interface Receivable {
  id: string;
  saleId?: string;
  description: string;
  value: number;
  date: string;
  status: 'PENDING' | 'EFFECTIVE';
  distributed: boolean;
  deductions: CommissionDeduction[];
  userId: string;
  deleted: boolean;
}

export interface CommissionDeduction {
  id: string;
  description: string;
  amount: number;
}

export interface DashboardWidgetConfig {
  showStats: boolean;
  showCharts: boolean;
  showRecents: boolean;
  showPacing: boolean;
  showBudgets: boolean;
  showProjection?: boolean;
}

export interface FinancialPacing {
  daysRemaining: number;
  safeDailySpend: number;
  pendingExpenses: number;
  nextIncomeDate: Date;
}

export interface TransactionCategory {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  personType: PersonType;
  subcategories: string[];
  monthlyBudget: number;
  isActive: boolean;
  deleted: boolean;
  userId: string;
}

export interface ImportMapping {
  [key: string]: number;
}

export interface SystemConfig {
  bootstrapVersion: number;
  isMaintenanceMode?: boolean;
  salesLockEnabled?: boolean;
  paymentMethods?: string[];
  avistaLowMarginRuleEnabled?: boolean;
  avistaLowMarginCommissionPct?: number;
  avistaLowMarginPaymentMethods?: string[];
  notificationSounds?: {
    enabled: boolean;
    volume: number;
    sound: string;
  };
  includeNonAccountingInTotal: boolean;
  ntfyTopic?: string;
  modules?: UserPermissions;
  notificationSound?: string;
  alertSound?: string;
  successSound?: string;
  warningSound?: string;
  theme?: AppTheme;
  supportEmail?: string;
}

export interface SyncEntry {
  id: number;
  table: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  rowId: string;
  status: 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED';
  timestamp: number;
  retryCount: number;
}

export type SyncTable = 'users' | 'audit_log' | 'clients' | 'client_transfer_requests' | 'sales' | 'sales_tasks' | 'campaigns' | 'commission_basic' | 'commission_natal' | 'commission_custom' | 'config' | 'accounts' | 'cards' | 'transactions' | 'categories' | 'goals' | 'challenges' | 'challenge_cells' | 'receivables' | 'internal_messages' | 'tickets' | 'sync_queue';

export type ChallengeModel = 'LINEAR' | 'PROPORTIONAL' | 'CUSTOM';

export interface Challenge {
  id: string;
  name: string;
  targetValue: number;
  depositCount: number;
  model: ChallengeModel;
  createdAt: string;
  status: 'ACTIVE' | 'COMPLETED';
  userId: string;
  deleted: boolean;
}

export interface ChallengeCell {
  id: string;
  challengeId: string;
  number: number;
  value: number;
  status: 'PENDING' | 'PAID';
  userId: string;
  deleted: boolean;
  paidDate?: string;
}

export interface FinanceGoal {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  currentValue: number;
  status: 'ACTIVE' | 'COMPLETED';
  userId: string;
  deleted: boolean;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRASH';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  details?: any;
  userAgent: string;
  userId?: string;
  userName?: string;
}

export type AudioType = 'NOTIFICATION' | 'ALERT' | 'SUCCESS' | 'WARNING';

export interface SalesTargets {
  basic: number;
  natal: number;
}

export interface Client {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  deletedAt?: string;
  notes?: string;
}

export interface ClientTransferRequest {
  id: string;
  clientId: string;
  fromUserId: string;
  toUserId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateGroup<T> {
  id: string;
  items: T[];
}

export interface NtfyPayload {
  topic: string;
  message: string;
  title?: string;
  priority?: number;
  tags?: string[];
}

export type WebhookEvent = 'transfer' | 'ticket' | 'message' | 'sale';

export interface WebhookConfig {
  id: string;
  endpoint: string;
  secret: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
