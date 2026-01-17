import { collection, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { WebhookConfig, WebhookEvent } from '../types';

const WEBHOOKS_COLLECTION = 'webhooks';

export const listWebhooks = async (): Promise<WebhookConfig[]> => {
    const snap = await getDocs(query(collection(db, WEBHOOKS_COLLECTION), orderBy('createdAt', 'desc')));
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as WebhookConfig));
};

export const saveWebhook = async (webhook: Omit<WebhookConfig, 'createdAt' | 'updatedAt'> & { createdAt?: string }) => {
    const now = new Date().toISOString();
    const id = webhook.id || crypto.randomUUID();
    const ref = doc(db, WEBHOOKS_COLLECTION, id);
    const payload: WebhookConfig = {
        ...webhook,
        id,
        createdAt: webhook.createdAt || now,
        updatedAt: now
    };
    await setDoc(ref, payload, { merge: true });
    return payload;
};

export const setWebhookActive = async (id: string, active: boolean) => {
    const ref = doc(db, WEBHOOKS_COLLECTION, id);
    await updateDoc(ref, { active, updatedAt: new Date().toISOString() });
};

export const sendWebhookTest = async (webhookId: string, event: WebhookEvent) => {
    const call = httpsCallable(functions, 'sendWebhookTest');
    return await call({ webhookId, event });
};
