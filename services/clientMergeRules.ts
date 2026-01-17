
import { Client, ClientTransferRequest } from '../types';

/**
 * Verifica se um cliente é elegível para processos de mescla.
 * Regras:
 * 1. Pertencer ao usuário atual.
 * 2. Não estar deletado.
 * 3. Não possuir solicitações de transferência pendentes (Origem ou Destino).
 */
export const isClientEligibleForMerge = (
    client: Client, 
    currentUserId: string, 
    allPendingRequests: ClientTransferRequest[]
): boolean => {
    // 1. Escopo de Usuário
    if (client.userId !== currentUserId) return false;

    // 2. Status Ativo
    if (client.deleted) return false;

    // 3. Bloqueio por Transferência
    const isLocked = allPendingRequests.some(req => 
        req.clientId === client.id && req.status === 'PENDING'
    );

    return !isLocked;
};

/**
 * Valida se um conjunto de clientes pode ser mesclado.
 * Retorna lista de erros ou array vazio se OK.
 */
export const validateMergeGroup = (
    master: Client, 
    duplicates: Client[], 
    currentUserId: string
): string[] => {
    const errors: string[] = [];

    if (master.userId !== currentUserId) {
        errors.push(`O cliente mestre "${master.name}" não pertence a você.`);
    }

    duplicates.forEach(dup => {
        if (dup.userId !== currentUserId) {
            errors.push(`O cliente duplicado "${dup.name}" não pertence a você.`);
        }
        if (dup.id === master.id) {
            errors.push(`O cliente mestre não pode estar na lista de duplicados.`);
        }
    });

    return errors;
};
