import * as functions from 'firebase-functions';
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

export const sendFcmNotification = functions
    .runWith({ serviceAccount: 'api-firebase-cloud-messaging@gestor360-app.iam.gserviceaccount.com' })
    .https.onCall(async (data: SendFcmPayload, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'A solicitação deve estar autenticada.');
    }

    const targetUserId = data?.targetUserId;
    const title = data?.title;
    const body = data?.body;
    const normalizedData = normalizeDataPayload(data?.data);

    if (!targetUserId || typeof targetUserId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Destino inválido para notificação.');
    }
    if (!title || typeof title !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Título inválido para notificação.');
    }
    if (!body || typeof body !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Mensagem inválida para notificação.');
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

    try {
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
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'Falha ao enviar notificação via FCM.');
    }
});
