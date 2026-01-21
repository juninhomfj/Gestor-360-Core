import { getToken } from "firebase/messaging";
import { initMessaging } from "./firebase";
import { updateUser } from "./auth";
import { httpsCallable } from "firebase/functions";
import { functions, firebaseConfig, auth } from "./firebase";
import { networkFetch } from "./networkControl";

// Chave VAPID para notificações push
const VAPID_KEY = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || "BPEW_REPLACE_WITH_YOUR_ACTUAL_PUBLIC_VAPID_KEY_FROM_FIREBASE_CONSOLE";

/**
 * Validação de integridade da chave VAPID (Etapa 3)
 */
const isValidVapid = (key: string): boolean => {
    return !!key && 
           key.trim() !== "" && 
           key.length > 20 &&
           !key.includes("REPLACE_WITH") && 
           !key.includes("PLACEHOLDER");
};

/**
 * Solicita permissão e retorna o Token FCM do dispositivo atual
 */
export const requestAndSaveToken = async (userId: string): Promise<string | null> => {
    try {
        if (!isValidVapid(VAPID_KEY)) {
            // Silencioso em produção para não poluir o console do usuário
            if ((import.meta as any).env?.DEV) {
                console.warn("⚠️ [Push] Registro cancelado: Chave VAPID inválida ou em modo placeholder.");
            }
            return null;
        }

        const messaging = await initMessaging();
        if (!messaging) return null;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            return null;
        }

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
            // Salva o token no perfil do usuário
            await updateUser(userId, { fcmToken: token });
            return token;
        }
        return null;
    } catch (error) {
        if ((import.meta as any).env?.DEV) {
            console.error("[Push] Erro crítico ao registrar token:", error);
        }
        return null;
    }
};

/**
 * Envia uma notificação para um usuário específico ou para todos os Admins
 */
export const sendPushNotification = async (
    targetUserId: string | 'ADMIN_GROUP', 
    title: string, 
    body: string,
    data: any = {}
) => {
    const call = httpsCallable(functions, 'sendFcmNotification');
    const payload = {
        targetUserId,
        title,
        body,
        data: {
            ...data,
            url: data?.url || window.location.origin
        }
    };

    try {
        await call(payload);
    } catch (e) {
        const projectId = firebaseConfig?.projectId;
        const token = await auth.currentUser?.getIdToken();
        if (!projectId || !token) {
            if ((import.meta as any).env?.DEV) {
                console.error("[Push] Falha ao enviar notificacao:", e);
            }
            return;
        }
        try {
            const url = `https://us-central1-${projectId}.cloudfunctions.net/sendFcmNotificationHttp`;
            const res = await networkFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            }, { lockKey: `push:${targetUserId}:${title}` });
            if (!res.ok && (import.meta as any).env?.DEV) {
                console.error("[Push] Falha ao enviar notificacao (http):", res.status);
            }
        } catch (httpError) {
            if ((import.meta as any).env?.DEV) {
                console.error("[Push] Falha ao enviar notificacao (http):", httpError);
            }
        }
        if ((import.meta as any).env?.DEV) {
            console.error("[Push] Falha ao enviar notificacao:", e);
        }
    }
};
