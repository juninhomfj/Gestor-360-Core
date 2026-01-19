
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import { NtfyPayload } from '../../types';

/**
 * sendNtfyNotification
 * HTTPS Callable para envio de notificações via ntfy.sh.
 * Realiza o push como side effect desacoplado do fluxo principal.
 */
export const sendNtfyNotification = functions.https.onCall(async (data: NtfyPayload, context) => {
    // 1. Validação de Autenticação
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated", 
            "A solicitação deve estar autenticada."
        );
    }

    const db = admin.firestore();
    const callerUid = context.auth.uid;

    // 2. Validação de Autoridade (Role-Based Access Control)
    const profileSnap = await db.collection('profiles').doc(callerUid).get();
    const userData = profileSnap.data();

    if (!profileSnap.exists || (userData?.role !== 'DEV' && userData?.role !== 'ADMIN')) {
        console.warn(`[SECURITY] Tentativa de disparo NTfy negada para UID: ${callerUid}`);
        throw new functions.https.HttpsError(
            "permission-denied", 
            "Privilégios insuficientes para disparar notificações administrativas."
        );
    }

    // 3. Validação do Payload e Tópico
    const { topic, message, title, priority, tags } = data;

    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
        throw new functions.https.HttpsError("invalid-argument", "O campo 'topic' é obrigatório.");
    }
    if (!message || typeof message !== 'string' || message.trim() === '') {
        throw new functions.https.HttpsError("invalid-argument", "O campo 'message' é obrigatório.");
    }

    // Validação do Tópico contra config/system
    const configSnap = await db.collection('config').doc('system').get();
    const systemConfig = configSnap.data();
    
    // Se o tópico não estiver cadastrado no sistema, bloqueia o envio
    if (!systemConfig || systemConfig.ntfyTopic !== topic) {
        console.warn(`[SECURITY] Tentativa de envio para tópico não autorizado: ${topic}`);
        throw new functions.https.HttpsError("invalid-argument", "O tópico fornecido não está autorizado nas configurações do sistema.");
    }

    // 4. Preparação do Envio HTTP (ntfy.sh)
    // Body deve ser texto puro conforme requisito
    const url = `https://ntfy.sh/${topic}`;
    const headers: Record<string, string> = {
        'Content-Type': 'text/plain'
    };

    if (title) headers['Title'] = title;
    // Conversão explícita para string exigida pela biblioteca fetch
    if (priority) headers['Priority'] = String(priority);
    if (tags && Array.isArray(tags)) headers['Tags'] = tags.join(',');

    try {
        // O envio é assíncrono e não bloqueante para o solicitante (side effect)
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: message
        });

        if (!response.ok) {
            console.error(`[NTFY_SERVICE_ERROR] ${response.status} ${response.statusText}`);
            // Não jogamos erro para o frontend para garantir que o push seja descartável
            return { success: false, status: response.status };
        }

        return { success: true };

    } catch (error: any) {
        console.error("[NTFY_FUNCTION_CRASH]", error);
        // Falha no push é silenciosa para o fluxo do app
        return { success: false, error: error.message };
    }
});
