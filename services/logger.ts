import { dbPut, dbGetAll, initDB } from '../storage/db';
import { LogEntry, LogLevel } from '../types';
import { db, auth } from './firebase';
import { collection, doc, setDoc, serverTimestamp, updateDoc, getDocs, query, where } from 'firebase/firestore';

const LOG_STORE = 'audit_log';

/**
 * Remove recursivamente chaves com valor undefined para compatibilidade com Firestore (Etapa 3).
 */
const sanitizeDeep = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeDeep);
    
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (value !== undefined) {
                newObj[key] = sanitizeDeep(value);
            }
        }
    }
    return newObj;
};

export const Logger = {
    async log(level: LogLevel, message: string, details?: any) {
        const uid = auth.currentUser?.uid || 'anonymous';
        
        // Detecção de plataforma robusta
        const ua = navigator.userAgent;
        let platform = 'Web-Generic';
        
        if (/android/i.test(ua)) platform = 'Mobile-Android';
        else if (/iphone|ipad|ipod/i.test(ua)) platform = 'Mobile-iOS';
        else if (/macintosh/i.test(ua)) platform = 'Desktop-Mac';
        else if (/windows/i.test(ua)) platform = 'Desktop-Windows';

        // Garantia de tipo booleano para isPWA (Etapa 3)
        const isPWA = !!(
            typeof window !== 'undefined' && 
            (window.matchMedia?.('(display-mode: standalone)')?.matches || (window.navigator as any).standalone)
        );

        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            message,
            details: sanitizeDeep({
                ...details,
                platform,
                isPWA,
                screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '0x0',
                appMode: localStorage.getItem('sys_last_mode') || 'unknown'
            }),
            userAgent: ua.substring(0, 100),
            deleted: false
        };

        try {
            // Persistência local (IDB)
            try {
                await dbPut(LOG_STORE, entry);
            } catch (idbErr) {
                if ((import.meta as any).env?.DEV) {
                    console.warn("[Logger] Falha ao gravar localmente:", idbErr);
                }
            }
            
            // Persistência Cloud (Principal)
            if (auth.currentUser) {
                const cloudLogRef = doc(collection(db, "audit_log"));
                await setDoc(cloudLogRef, {
                    ...entry,
                    userId: uid,
                    userName: auth.currentUser.displayName || 'System User',
                    browserInfo: platform,
                    deviceTime: new Date().toISOString(),
                    createdAt: serverTimestamp()
                });
            }

            if ((import.meta as any).env?.DEV || level === 'ERROR' || level === 'CRASH') {
                console.log(`[${level}] ${message}`, entry.details);
            }

            if (typeof window !== 'undefined' && ['WARN', 'ERROR', 'CRASH'].includes(level)) {
                window.dispatchEvent(new CustomEvent('app:bug-detected', { detail: { level, message, details: entry.details } }));
            }
        } catch (e) {
            // Silencioso em caso de falha no próprio log para não quebrar o fluxo principal do app
        }
    },

    info(message: string, details?: any) { this.log('INFO', message, details); },
    warn(message: string, details?: any) { this.log('WARN', message, details); },
    error(message: string, details?: any) { this.log('ERROR', message, details); },
    crash(error: Error, componentStack?: string) { this.log('CRASH', error.message, { stack: error.stack, componentStack }); },

    async getLogs(limitVal = 200): Promise<LogEntry[]> {
        try {
            const allLogs = await dbGetAll(LOG_STORE);
            return allLogs
                .filter((log: LogEntry) => !log.deleted)
                .sort((a: LogEntry, b: LogEntry) => b.timestamp - a.timestamp)
                .slice(0, limitVal);
        } catch (e) { return []; }
    },

    async clearLogs() {
        try {
            const dbInst = await initDB();
            await dbInst.clear(LOG_STORE);
            return true;
        } catch (e) { return false; }
    },

    async softDeleteLogsLocal() {
        try {
            const dbInst = await initDB();
            const logs = await dbInst.getAll(LOG_STORE);
            const tx = dbInst.transaction(LOG_STORE, 'readwrite');
            const store = tx.objectStore(LOG_STORE);
            logs.forEach((log: LogEntry) => {
                store.put({ ...log, deleted: true });
            });
            await tx.done;
            return true;
        } catch (e) { return false; }
    },

    async softDeleteLogsCloud() {
        try {
            if (!auth.currentUser) return false;
            const uid = auth.currentUser.uid;
            const snap = await getDocs(query(collection(db, 'audit_log'), where('userId', '==', uid)));
            await Promise.all(snap.docs.map((docRef) => updateDoc(docRef.ref, { deleted: true })));
            return true;
        } catch (e) { return false; }
    },

    async softDeleteLogsGlobal() {
        const localOk = await this.softDeleteLogsLocal();
        const cloudOk = await this.softDeleteLogsCloud();
        return localOk || cloudOk;
    },

    async downloadLogs() {
        try {
            const logs = await this.getLogs(500);
            const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gestor360_diag_${new Date().getTime()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return true;
        } catch (e) { return false; }
    }
};
