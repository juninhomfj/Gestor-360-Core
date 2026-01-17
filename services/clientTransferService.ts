import { dbPut, dbGet, dbGetAll, dbBulkPutSkipPending, dbDelete, enqueueSync } from '../storage/db';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { Client, ClientTransferRequest } from '../types';
import { validateTransferUserIdFilter } from './transferValidation';

/**
 * Cria uma solicitação de transferência de cliente.
 */
export const requestClientTransfer = async (
    clientId: string,
    fromUserId: string,
    toUserId: string,
    message?: string
): Promise<ClientTransferRequest> => {
    
    // Validar integridade básica
    if (fromUserId === toUserId) {
        throw new Error("Origem e destino não podem ser iguais.");
    }

    // Verificar duplicidade de solicitações pendentes
    const existingRequests = await dbGetAll('client_transfer_requests');
    const duplicate = existingRequests.find(r => 
        r.clientId === clientId && 
        r.toUserId === toUserId && 
        r.status === 'PENDING'
    );

    if (duplicate) {
        throw new Error("Já existe uma solicitação pendente para este cliente.");
    }

    const newRequest: ClientTransferRequest = {
        id: crypto.randomUUID(),
        clientId,
        fromUserId,
        toUserId,
        status: 'PENDING',
        message: message || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Persistir Local (Cache)
    await dbPut('client_transfer_requests', newRequest);

    // Enfileirar Sync (Firebase Native lida com isso via Firestore SDK)
    await enqueueSync({
        table: 'client_transfer_requests',
        type: 'INSERT',
        data: newRequest,
        rowId: newRequest.id
    } as any);
    
    return newRequest;
};

/**
 * Aprova a transferência, alterando o dono do cliente.
 */
export const approveClientTransfer = async (
    requestId: string,
    approverUserId: string
): Promise<void> => {
    const request = await dbGet('client_transfer_requests', requestId);
    if (!request) throw new Error("Solicitação não encontrada.");

    if (request.status !== 'PENDING') throw new Error("Solicitação não está pendente.");

    if (request.toUserId !== approverUserId) {
        throw new Error("Apenas o destinatário pode aprovar esta transferência.");
    }

    const client = await dbGet('clients', request.clientId);
    if (!client) throw new Error("Cliente não encontrado.");

    // 1. Atualizar Solicitação
    const updatedRequest: ClientTransferRequest = {
        ...request,
        status: 'APPROVED',
        updatedAt: new Date().toISOString()
    };

    // 2. Atualizar Cliente (Troca de Propriedade)
    const updatedClient: Client = {
        ...client,
        userId: request.toUserId, // Novo dono
        updatedAt: new Date().toISOString()
    };

    await dbPut('client_transfer_requests', updatedRequest);
    await dbPut('clients', updatedClient);

    await enqueueSync({
        table: 'client_transfer_requests',
        type: 'UPDATE',
        data: updatedRequest,
        rowId: updatedRequest.id
    } as any);

    await enqueueSync({
        table: 'clients',
        type: 'UPDATE',
        data: updatedClient,
        rowId: updatedClient.id
    } as any);
};

/**
 * Rejeita a transferência.
 */
export const rejectClientTransfer = async (
    requestId: string,
    rejectorUserId: string
): Promise<void> => {
    const request = await dbGet('client_transfer_requests', requestId);
    if (!request) throw new Error("Solicitação não encontrada.");

    if (request.status !== 'PENDING') throw new Error("Solicitação não está pendente.");

    const updatedRequest: ClientTransferRequest = {
        ...request,
        status: 'REJECTED',
        updatedAt: new Date().toISOString()
    };

    await dbPut('client_transfer_requests', updatedRequest);

    await enqueueSync({
        table: 'client_transfer_requests',
        type: 'UPDATE',
        data: updatedRequest,
        rowId: updatedRequest.id
    } as any);
};

/**
 * Observa solicitações de transferência pendentes para o usuário destinatário.
 */
export const subscribeToClientTransferRequests = (
    userId: string,
    onUpdate?: (requests: ClientTransferRequest[]) => void
) => {
    const validatedUserId = validateTransferUserIdFilter(userId, 'subscribeToClientTransferRequests');
    const q = query(
        collection(db, 'client_transfer_requests'),
        where('toUserId', '==', validatedUserId),
        where('status', '==', 'PENDING')
    );

    return onSnapshot(q, async (snapshot) => {
        const requests = snapshot.docs.map(docSnap => ({
            ...(docSnap.data() as ClientTransferRequest),
            id: docSnap.id
        }));

        await dbBulkPutSkipPending('client_transfer_requests', requests);

        const deletions = snapshot.docChanges().filter(change => change.type === 'removed');
        await Promise.all(deletions.map(change => dbDelete('client_transfer_requests', change.doc.id)));

        onUpdate?.(requests);
    });
};
