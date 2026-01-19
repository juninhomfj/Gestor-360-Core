import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

type SendFcmPayload = {
    targetUserId: string;
    title: string;
    body: string;
    data?: Record<string, any>;
};

const normalizeDataPayload = (payload?: Record<string, any>): Record<string, string> => {
    if (!payload || typeof payload !== 'object') return {};

    return Object.entries(payload).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value === undefined || value === null) return acc;
        acc[key] = typeof value === 'string' ? value : JSON.stringify(value);
        return acc;
    }, {});
};

const chunkTokens = (tokens: string[], size = 500): string[][] => {
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += size) {
        chunks.push(tokens.slice(i, i + size));
    }
    return chunks;
};

const applyCors = (req: functions.https.Request, res: functions.Response<any>) => {
    const origin = req.headers.origin || '*';
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck, X-Firebase-Client');
};

const sendNotification = async (data: SendFcmPayload) => {
    const targetUserId = data?.targetUserId;
    const title = data?.title;
    const body = data?.body;
    const normalizedData = normalizeDataPayload(data?.data);

    if (!targetUserId || typeof targetUserId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Destino invalido para notificacao.');
    }
    if (!title || typeof title !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Titulo invalido para notificacao.');
    }
    if (!body || typeof body !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Mensagem invalida para notificacao.');
    }

    const db = admin.firestore();
    let tokens: string[] = [];

    if (targetUserId === 'ADMIN_GROUP') {
        const snap = await db.collection('profiles').where('role', '==', 'ADMIN').get();
        tokens = snap.docs
            .map(doc => doc.data().fcmToken)
            .filter((token): token is string => typeof token === 'string' && token.trim().length > 0);
    } else {
        const userSnap = await db.collection('profiles').doc(targetUserId).get();
        if (userSnap.exists) {
            const token = userSnap.data()?.fcmToken;
            if (typeof token === 'string' && token.trim().length > 0) {
                tokens.push(token);
            }
        }
    }

    if (tokens.length === 0) {
        return { success: false, reason: 'no_tokens' };
    }

    const link = normalizedData.url;
    const messageBase = {
        notification: { title, body },
        data: normalizedData,
        webpush: link
            ? {
                  fcmOptions: {
                      link
                  }
              }
            : undefined
    };

    const chunks = chunkTokens(tokens);
    const responses = await Promise.all(
        chunks.map(chunk => admin.messaging().sendEachForMulticast({ ...messageBase, tokens: chunk }))
    );

    const successCount = responses.reduce((sum, res) => sum + res.successCount, 0);
    const failureCount = responses.reduce((sum, res) => sum + res.failureCount, 0);

    return {
        success: true,
        successCount,
        failureCount
    };
};

export const sendFcmNotification = functions
    .runWith({ serviceAccount: 'api-firebase-cloud-messaging@gestor360-app.iam.gserviceaccount.com' })
    .https.onCall(async (data: SendFcmPayload, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'A solicitacao deve estar autenticada.');
        }

        try {
            return await sendNotification(data);
        } catch (error) {
            throw new functions.https.HttpsError('internal', 'Falha ao enviar notificacao via FCM.');
        }
    });

export const sendFcmNotificationHttp = functions
    .runWith({ serviceAccount: 'api-firebase-cloud-messaging@gestor360-app.iam.gserviceaccount.com' })
    .https.onRequest(async (req, res) => {
        applyCors(req, res);
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'method-not-allowed' });
            return;
        }

        const authHeader = String(req.headers.authorization || '');
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        if (!token) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }

        try {
            await admin.auth().verifyIdToken(token);
        } catch {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }

        try {
            const result = await sendNotification(req.body as SendFcmPayload);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: 'internal' });
        }
    });
