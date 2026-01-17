import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

const DEFAULT_NTFY_TOPIC = "gestor360-admin-92b1";

/**
 * sendAdminNotification
 * Tipo: HTTPS Callable (onCall)
 * Envia notificações para o serviço ntfy.sh validando permissões no Firestore.
 */
export const sendAdminNotification = functions.https.onCall(async (data, context) => {
    // Validação de autenticação
    if (!context.auth) {
        throw new functions.https.HttpsError('permission-denied', 'Usuário não autenticado.');
    }

    const db = admin.firestore();
    const profileSnap = await db.collection('profiles').doc(context.auth.uid).get();
    const profileData = profileSnap.data();

    // Validação de Role (DEV ou ADMIN)
    if (!profileSnap.exists || (profileData?.role !== 'DEV' && profileData?.role !== 'ADMIN')) {
        throw new functions.https.HttpsError('permission-denied', 'Privilégios insuficientes.');
    }

    // Validação do Payload
    const { title, message, priority, tags, topic } = data;

    if (!title || typeof title !== 'string' || title.trim() === '') {
        throw new functions.https.HttpsError('invalid-argument', 'Título obrigatório.');
    }
    if (!message || typeof message !== 'string' || message.trim() === '') {
        throw new functions.https.HttpsError('invalid-argument', 'Mensagem obrigatória.');
    }
    if (priority !== undefined && (!Number.isInteger(priority) || priority < 1 || priority > 5)) {
        throw new functions.https.HttpsError('invalid-argument', 'Prioridade deve ser entre 1 e 5.');
    }
    if (tags !== undefined && !Array.isArray(tags)) {
        throw new functions.https.HttpsError('invalid-argument', 'Tags devem ser um array.');
    }

    const ntfyTopic = topic || DEFAULT_NTFY_TOPIC;
    const url = `https://ntfy.sh/${ntfyTopic}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Title': title,
                'Priority': String(priority || 3),
                'Tags': (tags || []).join(',')
            },
            body: message
        });

        if (!response.ok) {
            throw new Error(`ntfy error: ${response.status}`);
        }

        return {
            success: true
        };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'Erro ao processar envio para o serviço ntfy.');
    }
});