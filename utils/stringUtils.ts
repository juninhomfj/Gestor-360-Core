/**
 * Utilitários para evitar erros de TypeError em strings indefinidas
 */

export const safeString = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    return typeof v === 'string' ? v : String(v);
};

export const safeFirstChar = (v: unknown, fallback = '?'): string => {
    const s = safeString(v).trim();
    return s.length > 0 ? s.charAt(0).toUpperCase() : fallback;
};

export const safeShort = (v: unknown, n: number): string => {
    const s = safeString(v);
    return s.slice(0, n);
};

export const safeInitials = (v: unknown, limit = 2): string => {
    const s = safeString(v).trim();
    if (!s) return '?'.repeat(limit);
    return s.split(' ')
            .filter(Boolean)
            .map(part => part.charAt(0))
            .join('')
            .slice(0, limit)
            .toUpperCase();
};