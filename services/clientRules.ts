
import { Client, ClientTransferRequest } from '../types';

/**
 * Regra: Usuário só pode ver detalhes completos se for o proprietário.
 */
export const canUserSeeClient = (client: Client, userId: string): boolean => {
    return client.userId === userId;
};

/**
 * Regra: Usuário pode solicitar transferência se:
 * 1. Não for o dono atual.
 * 2. Não houver solicitação pendente dele para este cliente.
 */
export const canUserRequestTransfer = (
    client: Client, 
    userId: string, 
    existingRequests: ClientTransferRequest[] = []
): boolean => {
    // Se já é o dono, não faz sentido pedir transferência
    if (client.userId === userId) return false;

    // Verifica se já existe um pedido PENDING deste usuário para este cliente
    const hasPending = existingRequests.some(req => 
        req.clientId === client.id && 
        req.toUserId === userId && 
        req.status === 'PENDING'
    );

    return !hasPending;
};

/**
 * Regra: Apenas o destinatário (novo dono proposto) pode aprovar (aceitar) a transferência.
 * (Nota: O fluxo reverso onde o dono atual inicia a transferência para alguém também cairia aqui, 
 * mas seguindo o prompt, o foco é 'Request' e 'Approve').
 */
export const canUserApproveTransfer = (
    request: ClientTransferRequest,
    userId: string
): boolean => {
    if (request.status !== 'PENDING') return false;
    // Quem aprova é quem vai receber o cliente (no modelo "Solicitar Acesso")
    // OU quem é o dono atual (no modelo "Transferir Para").
    // O prompt especifica: "true se request.toUserId === userId".
    // Isso implica um modelo onde eu peço para assumir a conta de alguém (ou alguém me enviou e eu aceito).
    // Assumindo estritamente a regra do prompt:
    return request.toUserId === userId;
};
