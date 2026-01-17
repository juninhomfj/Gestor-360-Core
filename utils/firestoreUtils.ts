
import { Timestamp } from "firebase/firestore";

/**
 * sanitiza objetos para gravação no Firestore, lidando com datas e valores undefined.
 */
export function sanitizeForFirestore(obj: any): any {
    if (obj === undefined || obj === null) return null;
    if (obj instanceof Timestamp) return obj;
    if (obj instanceof Date) return Timestamp.fromDate(obj);
    if (Array.isArray(obj)) return obj.map(v => sanitizeForFirestore(v));
    if (typeof obj === 'object') {
        const cleaned: any = {};
        Object.keys(obj).forEach(key => {
            const val = sanitizeForFirestore(obj[key]);
            if (val !== undefined) cleaned[key] = val;
            else cleaned[key] = null;
        });
        return cleaned;
    }
    return obj;
}
