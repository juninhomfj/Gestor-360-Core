export const validateTransferUserIdFilter = (userId: string, context: string) => {
    if (typeof userId !== 'string' || !userId.trim()) {
        const message = `[Transfers] Filtro userId inválido em ${context}: ${String(userId)}`;
        console.warn(message);
        throw new Error('Filtro de usuário inválido para transferências.');
    }
    return userId.trim();
};
