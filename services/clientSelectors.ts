
import { collection, endAt, getDocs, getDocsFromServer, limit, orderBy, query, startAt, where } from 'firebase/firestore';
import { db } from './firebase';
import { dbBulkPutSkipPending, dbGetAll } from '../storage/db';
import { Client, ClientTransferRequest } from '../types';
import { validateTransferUserIdFilter } from './transferValidation';

const mergeById = <T extends { id: string }>(remote: T[], local: T[]) => {
    const merged = new Map<string, T>();
    local.forEach(item => merged.set(item.id, item));
    remote.forEach(item => merged.set(item.id, item));
    return Array.from(merged.values());
};

/**
 * Retorna todos os clientes que pertencem ao usuário fornecido.
 */
export const getMyClients = async (userId: string): Promise<Client[]> => {
    let remoteClients: Client[] = [];
    const validatedUserId = validateTransferUserIdFilter(userId, 'getMyClients');
    try {
        const q = query(
            collection(db, 'clients'),
            where('userId', '==', validatedUserId),
            where('deleted', '==', false)
        );
        const snap = await getDocsFromServer(q);
        remoteClients = snap.docs.map(docSnap => ({ ...(docSnap.data() as Client), id: docSnap.id }));
        if (remoteClients.length) await dbBulkPutSkipPending('clients', remoteClients);
    } catch (e) {}

    const localClients = await dbGetAll('clients', c => c.userId === validatedUserId && !c.deleted);
    return mergeById(remoteClients, localClients);
};

/**
 * Retorna as solicitações de transferência pendentes DIRECIONADAS ao usuário.
 * (Situação onde alguém quer transferir um cliente PARA mim, e eu preciso aprovar)
 */
export const getClientsSharedWithMe = async (userId: string): Promise<ClientTransferRequest[]> => {
    let remoteRequests: ClientTransferRequest[] = [];
    const validatedUserId = validateTransferUserIdFilter(userId, 'getClientsSharedWithMe');
    try {
        const q = query(
            collection(db, 'client_transfer_requests'),
            where('toUserId', '==', validatedUserId),
            where('status', '==', 'PENDING')
        );
        const snap = await getDocs(q);
        remoteRequests = snap.docs.map(docSnap => ({
            ...(docSnap.data() as ClientTransferRequest),
            id: docSnap.id
        }));
        if (remoteRequests.length) await dbBulkPutSkipPending('client_transfer_requests', remoteRequests);
    } catch (e) {}

    const localRequests = await dbGetAll(
        'client_transfer_requests',
        req => req.toUserId === validatedUserId && req.status === 'PENDING'
    );
    return mergeById(remoteRequests, localRequests);
};

/**
 * Retorna solicitações que EU fiz para outros usuários (aguardando aprovação deles).
 */
export const getMySentTransferRequests = async (userId: string): Promise<ClientTransferRequest[]> => {
    let remoteRequests: ClientTransferRequest[] = [];
    const validatedUserId = validateTransferUserIdFilter(userId, 'getMySentTransferRequests');
    try {
        const q = query(
            collection(db, 'client_transfer_requests'),
            where('fromUserId', '==', validatedUserId),
            where('status', '==', 'PENDING')
        );
        const snap = await getDocs(q);
        remoteRequests = snap.docs.map(docSnap => ({
            ...(docSnap.data() as ClientTransferRequest),
            id: docSnap.id
        }));
        if (remoteRequests.length) await dbBulkPutSkipPending('client_transfer_requests', remoteRequests);
    } catch (e) {}

    const localRequests = await dbGetAll(
        'client_transfer_requests',
        req => req.fromUserId === validatedUserId && req.status === 'PENDING'
    );
    return mergeById(remoteRequests, localRequests);
};

/**
 * Busca clientes pelo nome para fins de solicitação de transferência.
 * Retorna apenas dados públicos/seguros (ID, Nome, ID do Dono).
 * Ignora clientes que já são do próprio usuário ou estão deletados.
 */
export const searchClientsByName = async (
    term: string, 
    currentUserId: string
): Promise<Pick<Client, 'id' | 'name' | 'userId'>[]> => {
    if (!term || term.length < 2) return [];

    let remoteResults: Client[] = [];
    try {
        const q = query(
            collection(db, 'clients'),
            orderBy('name'),
            startAt(term),
            endAt(`${term}\uf8ff`),
            limit(10)
        );
        const snap = await getDocs(q);
        remoteResults = snap.docs.map(docSnap => ({ ...(docSnap.data() as Client), id: docSnap.id }));
        if (remoteResults.length) await dbBulkPutSkipPending('clients', remoteResults);
    } catch (e) {}

    const allClients = await dbGetAll('clients');
    const lowerTerm = term.toLowerCase();

    const localResults = allClients.filter(c =>
        c.name.toLowerCase().includes(lowerTerm) &&
        c.userId !== currentUserId &&
        !c.deleted
    );

    return mergeById(remoteResults, localResults)
        .filter(c => c.userId !== currentUserId && !c.deleted)
        .map(c => ({
            id: c.id,
            name: c.name,
            userId: c.userId
        }))
        .slice(0, 10);
};
