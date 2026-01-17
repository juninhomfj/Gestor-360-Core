import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

// Whitelist de coleções permitidas para deleção administrativa
const ALLOWED_TABLES = ["sales", "transactions", "accounts", "clients", "receivables", "goals", "cards"];

export const adminHardResetUserData = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const callerUid = context.auth.uid;
    const profileSnap = await db.collection('profiles').doc(callerUid).get();
    const profileData = profileSnap.data();
    
    if (!profileSnap.exists || (profileData?.role !== 'DEV' && profileData?.role !== 'ADMIN')) {
        throw new functions.https.HttpsError('permission-denied', 'Privilégios insuficientes.');
    }

    const { targetUserId, tables } = data;

    if (!targetUserId || !Array.isArray(tables)) {
        throw new functions.https.HttpsError('invalid-argument', 'Payload incompleto.');
    }

    const validTables = tables.filter(t => ALLOWED_TABLES.includes(t));
    if (validTables.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Nenhuma tabela válida selecionada.');
    }

    try {
        const deletedStats: string[] = [];

        for (const tableName of validTables) {
            const collectionRef = db.collection(tableName);
            const query = collectionRef.where('userId', '==', targetUserId);
            const snapshot = await query.limit(500).get();

            if (snapshot.empty) continue;

            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            deletedStats.push(tableName);
        }

        // SIDE EFFECT: Notificação ntfy de Reset Administrativo
        const configSnap = await db.collection('config').doc('system').get();
        const sysConfig = configSnap.data();
        if (sysConfig?.ntfyTopic) {
            await fetch(`https://ntfy.sh/${sysConfig.ntfyTopic}`, {
                method: 'POST',
                headers: {
                    'Title': '⚠️ Reset Administrativo Executado',
                    'Priority': 'urgent',
                    'Tags': 'warning,shield'
                },
                body: `O usuário ${profileData?.name} executou reset de ${deletedStats.length} tabelas para o UID ${targetUserId}.`
            }).catch(() => null); // Silencioso se falhar
        }

        return {
            success: true,
            deletedTables: deletedStats
        };

    } catch (error: any) {
        console.error(`[ADMIN RESET ERROR]`, error);
        throw new functions.https.HttpsError('internal', 'Erro interno na deleção atômica.', error.message);
    }
});