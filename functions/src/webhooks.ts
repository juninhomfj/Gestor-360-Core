import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { WebhookEvent } from '../../types';

const WEBHOOKS_COLLECTION = 'webhooks';

const buildSignature = (secret: string, payload: string) => {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

const sendWebhook = async (webhook: FirebaseFirestore.DocumentData, payload: Record<string, any>) => {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Gestor360-Event': payload.event
    };

    if (webhook.secret) {
        headers['X-Gestor360-Signature'] = buildSignature(webhook.secret, body);
    }

    try {
        const response = await fetch(webhook.endpoint, {
            method: 'POST',
            headers,
            body
        });

        if (!response.ok) {
            console.warn('[WEBHOOKS] Endpoint respondeu com erro', {
                endpoint: webhook.endpoint,
                status: response.status,
                statusText: response.statusText
            });
        }
    } catch (error: any) {
        console.error('[WEBHOOKS] Falha ao enviar webhook', {
            endpoint: webhook.endpoint,
            error: error?.message
        });
    }
};

const emitWebhookEvent = async (
    event: WebhookEvent,
    action: 'created' | 'updated',
    data: Record<string, any>,
    id: string,
    collection: string
) => {
    const db = admin.firestore();
    const hooksSnap = await db
        .collection(WEBHOOKS_COLLECTION)
        .where('active', '==', true)
        .where('events', 'array-contains', event)
        .get();

    if (hooksSnap.empty) return;

    const payload = {
        event,
        action,
        id,
        collection,
        data,
        occurredAt: new Date().toISOString()
    };

    await Promise.all(hooksSnap.docs.map(doc => sendWebhook(doc.data(), payload)));
};

const assertAdmin = async (uid: string) => {
    const db = admin.firestore();
    const profileSnap = await db.collection('profiles').doc(uid).get();
    const profile = profileSnap.data();

    if (!profileSnap.exists || (profile?.role !== 'DEV' && profile?.role !== 'ADMIN')) {
        throw new functions.https.HttpsError('permission-denied', 'Privilégios insuficientes.');
    }
};

export const sendWebhookTest = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'A solicitação deve estar autenticada.');
    }

    await assertAdmin(context.auth.uid);

    const webhookId = data?.webhookId;
    const event = data?.event as WebhookEvent | undefined;

    if (!webhookId) {
        throw new functions.https.HttpsError('invalid-argument', 'Webhook inválido.');
    }

    const db = admin.firestore();
    const webhookSnap = await db.collection(WEBHOOKS_COLLECTION).doc(webhookId).get();

    if (!webhookSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Webhook não encontrado.');
    }

    const webhook = webhookSnap.data();
    if (!webhook) {
        throw new functions.https.HttpsError('not-found', 'Webhook vazio.');
    }
    const effectiveEvent = event || webhook?.events?.[0] || 'sale';

    const payload = {
        event: effectiveEvent,
        action: 'test',
        id: `test-${Date.now()}`,
        collection: 'webhooks',
        data: {
            message: 'Disparo de teste do Gestor360',
            sample: true
        },
        occurredAt: new Date().toISOString()
    };

    await sendWebhook(webhook, payload);
    return { success: true };
});

export const onTransferWrite = functions.firestore
    .document('client_transfer_requests/{requestId}')
    .onWrite(async (change, context) => {
        if (!change.after.exists) return;
        const action = change.before.exists ? 'updated' : 'created';
        const data = change.after.data();
        if (!data) return;
        await emitWebhookEvent('transfer', action, data, context.params.requestId, 'client_transfer_requests');
    });

export const onTicketWrite = functions.firestore
    .document('tickets/{ticketId}')
    .onWrite(async (change, context) => {
        if (!change.after.exists) return;
        const action = change.before.exists ? 'updated' : 'created';
        const data = change.after.data();
        if (!data) return;
        await emitWebhookEvent('ticket', action, data, context.params.ticketId, 'tickets');
    });

export const onMessageWrite = functions.firestore
    .document('internal_messages/{messageId}')
    .onWrite(async (change, context) => {
        if (!change.after.exists) return;
        const action = change.before.exists ? 'updated' : 'created';
        const data = change.after.data();
        if (!data) return;
        await emitWebhookEvent('message', action, data, context.params.messageId, 'internal_messages');
    });

export const onSaleWrite = functions.firestore
    .document('sales/{saleId}')
    .onWrite(async (change, context) => {
        if (!change.after.exists) return;
        const action = change.before.exists ? 'updated' : 'created';
        const data = change.after.data();
        if (!data) return;
        await emitWebhookEvent('sale', action, data, context.params.saleId, 'sales');
    });
