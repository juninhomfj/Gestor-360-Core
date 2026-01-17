import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { enqueueSync } from '../storage/db';
import { SyncEntry } from '../types';
import { sanitizeForFirestore } from '../utils/firestoreUtils';

const isTransientError = (e: any): boolean => {
  const code = String(e?.code || '');
  const msg = String(e?.message || '');
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'resource-exhausted' ||
    code === 'internal' ||
    code === 'cancelled' ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError')
  );
};

export const isOnline = (): boolean => {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
};

type SafeWriteOptions = {
  merge?: boolean;
};

/**
 * Online-first: tenta escrever no Firestore; se offline/erro transitório, enfileira no sync_queue.
 * - cloudData: payload para Firestore (pode conter serverTimestamp)
 * - queueData: payload serializável (SEM FieldValue), usado pela fila offline
 */
export const safeSetDoc = async <T extends Record<string, any>>(
  table: SyncEntry['table'],
  rowId: string,
  cloudData: T,
  options: SafeWriteOptions = { merge: true },
  queueData?: T,
  type: SyncEntry['type'] = 'INSERT'
) => {
  const ref = doc(db, table, rowId);

  // Offline: não tenta rede, apenas enfileira.
  if (!isOnline()) {
    await enqueueSync({ table, type, data: queueData ?? (cloudData as any), rowId } as any);
    return;
  }

  try {
    await setDoc(ref, sanitizeForFirestore(cloudData), { merge: options.merge !== false });
  } catch (e: any) {
    if (isTransientError(e)) {
      await enqueueSync({ table, type, data: queueData ?? (cloudData as any), rowId } as any);
      return;
    }
    throw e;
  }
};

export const safeUpdateDoc = async <T extends Record<string, any>>(
  table: SyncEntry['table'],
  rowId: string,
  cloudPatch: T,
  queuePatch?: T
) => {
  return safeSetDoc(table, rowId, cloudPatch, { merge: true }, queuePatch, 'UPDATE');
};

export const safeDeleteDoc = async (table: SyncEntry['table'], rowId: string) => {
  const ref = doc(db, table, rowId);
  if (!isOnline()) {
    await enqueueSync({ table, type: 'DELETE', data: {}, rowId } as any);
    return;
  }
  try {
    await deleteDoc(ref);
  } catch (e: any) {
    if (isTransientError(e)) {
      await enqueueSync({ table, type: 'DELETE', data: {}, rowId } as any);
      return;
    }
    throw e;
  }
};
