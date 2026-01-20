import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  InternalMessage,
  User,
  LogEntry,
  Sale,
  CommissionRule,
  FinanceAccount,
  CreditCard,
  Transaction,
  TransactionCategory,
  FinanceGoal,
  Challenge,
  ChallengeCell,
  Receivable,
  SyncEntry,
  Client,
  ClientTransferRequest,
  Ticket,
  SalesTask,
  CommissionCampaign
} from '../types';

interface Gestor360DB extends DBSchema {
  users: { key: string; value: User };
  audit_log: { key: number; value: LogEntry };
  clients: { key: string; value: Client };
  client_transfer_requests: { key: string; value: ClientTransferRequest };
  sales: { key: string; value: Sale };
  sales_tasks: { key: string; value: SalesTask };
  commission_basic: { key: string; value: CommissionRule };
  commission_natal: { key: string; value: CommissionRule };
  commission_custom: { key: string; value: CommissionRule };
  config: { key: string; value: any };
  accounts: { key: string; value: FinanceAccount };
  cards: { key: string; value: CreditCard };
  transactions: { key: string; value: Transaction };
  categories: { key: string; value: TransactionCategory };
  goals: { key: string; value: FinanceGoal };
  challenges: { key: string; value: Challenge };
  challenge_cells: { key: string; value: ChallengeCell };
  receivables: { key: string; value: Receivable };
  campaigns: { key: string; value: CommissionCampaign };
  internal_messages: {
    key: string;
    value: InternalMessage;
    indexes: { 'by-recipient': string };
  };
  tickets: { key: string; value: Ticket };
  sync_queue: {
    key: number;
    value: SyncEntry;
    autoIncrement: true;
    indexes: { 'by-status': string; 'by-table': string };
  };
}

const getDbName = () => {
  const env = localStorage.getItem('SYS_ENV');
  return env === 'TEST' ? 'gestor360_sandbox_db' : 'gestor360_local_db';
};

const DB_VERSION = 19;
let dbPromise: Promise<IDBPDatabase<Gestor360DB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    const dbName = getDbName();
    dbPromise = openDB<Gestor360DB>(dbName, DB_VERSION, {
      upgrade(db) {
        const stores = [
          'users',
          'sales',
          'sales_tasks',
          'accounts',
          'transactions',
          'clients',
          'client_transfer_requests',
          'commission_basic',
          'commission_natal',
          'commission_custom',
          'config',
          'cards',
          'categories',
          'goals',
          'challenges',
          'challenge_cells',
          'receivables',
          'campaigns',
          'audit_log',
          'tickets'
        ];

        stores.forEach((s) => {
          if (!db.objectStoreNames.contains(s as any)) {
            db.createObjectStore(s as any, { keyPath: s === 'audit_log' ? 'timestamp' : 'id' });
          }
        });

        if (!db.objectStoreNames.contains('internal_messages')) {
          const msgStore = db.createObjectStore('internal_messages', { keyPath: 'id' });
          msgStore.createIndex('by-recipient', 'recipientId');
        }

        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('by-status', 'status');
          syncStore.createIndex('by-table', 'table');
        }
      }
    });
  }
  return dbPromise;
};

export const getPendingSyncs = async (): Promise<SyncEntry[]> => {
  try {
    const db = await initDB();
    const pending = await db.getAllFromIndex('sync_queue', 'by-status', 'PENDING');
    const syncing = await db.getAllFromIndex('sync_queue', 'by-status', 'SYNCING');
    return [...pending, ...syncing]
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  } catch (e) {
    console.error('[DB] Error in getPendingSyncs:', e);
    return [];
  }
};

export const enqueueSync = async (entry: Omit<SyncEntry, 'id' | 'status' | 'timestamp' | 'retryCount'>) => {
  try {
    const db = await initDB();
    const syncEntry: SyncEntry = {
      ...entry,
      status: 'PENDING',
      timestamp: Date.now(),
      retryCount: 0
    } as SyncEntry;
    await db.add('sync_queue', syncEntry);
  } catch (e) {
    console.error('[DB] Error enqueuing sync:', e);
  }
};

/**
 * Retorna um Set com os rowIds que possuem sync pendente em uma tabela.
 * Usado para evitar overwrite do cache local durante refresh do servidor.
 */
export const getPendingRowIdsByTable = async (table: SyncEntry['table']): Promise<Set<string>> => {
  try {
    const pending = await getPendingSyncs();
    const ids = pending
      .filter((e) => e.table === table)
      .map((e) => String(e.rowId))
      .filter(Boolean);
    return new Set(ids);
  } catch {
    return new Set();
  }
};

/**
 * BulkPut que ignora registros com alterações locais pendentes (sync_queue).
 */
export const dbBulkPutSkipPending = async <StoreName extends keyof Gestor360DB>(
  storeName: StoreName,
  values: Gestor360DB[StoreName]['value'][]
) => {
  const table = String(storeName);
  const pendingIds = await getPendingRowIdsByTable(table as any);
  const filtered = values.filter((v: any) => {
    const id = String(v?.id ?? '');
    return !id || !pendingIds.has(id);
  });
  if (filtered.length === 0) return;
  await dbBulkPut(storeName, filtered);
};

export const dbGetAll = async <StoreName extends keyof Gestor360DB>(
  storeName: StoreName,
  filterFn?: (item: Gestor360DB[StoreName]['value']) => boolean
): Promise<Gestor360DB[StoreName]['value'][]> => {
  try {
    const db = await initDB();
    const all = await db.getAll(storeName as any);
    return filterFn ? all.filter(filterFn) : all;
  } catch (e) {
    console.error(`[DB] Error in dbGetAll from ${String(storeName)}:`, e);
    return [];
  }
};

export const dbGet = async <StoreName extends keyof Gestor360DB>(
  storeName: StoreName,
  key: Gestor360DB[StoreName]['key']
): Promise<Gestor360DB[StoreName]['value'] | undefined> => {
  try {
    const db = await initDB();
    return await db.get(storeName as any, key);
  } catch (e) {
    console.error(`[DB] Error in dbGet from ${String(storeName)}:`, e);
    return undefined;
  }
};

export const dbPut = async <StoreName extends keyof Gestor360DB>(
  storeName: StoreName,
  value: Gestor360DB[StoreName]['value']
) => {
  try {
    const db = await initDB();
    await db.put(storeName as any, value);
  } catch (e) {
    console.error(`[DB] Error in dbPut to ${String(storeName)}:`, e);
    throw e;
  }
};

export const dbBulkPut = async <StoreName extends keyof Gestor360DB>(
  storeName: StoreName,
  values: Gestor360DB[StoreName]['value'][]
) => {
  try {
    const db = await initDB();
    const tx = db.transaction(storeName as any, 'readwrite');
    await Promise.all(values.map((v) => tx.store.put(v)));
    await tx.done;
  } catch (e) {
    console.error(`[DB] Error in dbBulkPut to ${String(storeName)}:`, e);
    throw e;
  }
};

export const dbDelete = async <StoreName extends keyof Gestor360DB>(
  storeName: StoreName,
  key: Gestor360DB[StoreName]['key']
) => {
  try {
    const db = await initDB();
    await db.delete(storeName as any, key);
  } catch (e) {
    console.error(`[DB] Error in dbDelete from ${String(storeName)}:`, e);
  }
};

export const dbClearStore = async <StoreName extends keyof Gestor360DB>(storeName: StoreName) => {
  try {
    const db = await initDB();
    await db.clear(storeName as any);
  } catch (e) {
    console.error(`[DB] Error in dbClearStore for ${String(storeName)}:`, e);
  }
};
