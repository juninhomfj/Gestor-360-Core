import {
  collection,
  getDocsFromServer,
  orderBy,
  query,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { dbGet, dbGetAll, dbPut } from '../storage/db';
import { Ticket, TicketPriority, TicketStatus, TicketAttachment, LogEntry, User } from '../types';
import { getSession } from './auth';
import { safeSetDoc } from './safeWrites';

interface CreateTicketPayload {
    title: string;
    description: string;
    module: string;
    priority: TicketPriority;
    createdBy: User;
    logs?: LogEntry[];
    attachments?: TicketAttachment[];
}

export const createTicket = async ({
    title,
    description,
    module,
    priority,
    createdBy,
    logs = [],
    attachments = []
}: CreateTicketPayload) => {
    const now = new Date().toISOString();
    const ticket: Ticket = {
        id: crypto.randomUUID(),
        title,
        description,
        module,
        status: 'OPEN',
        priority,
        createdById: createdBy.id,
        createdByName: createdBy.name,
        createdByEmail: createdBy.email,
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        logs,
        attachments
    };

    await dbPut('tickets', ticket);

    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await safeSetDoc(
          'tickets',
          ticket.id,
          {
            ...ticket,
            userId: uid,
            createdAtServer: serverTimestamp(),
            updatedAtServer: serverTimestamp()
          } as any,
          { merge: true },
          {
            ...ticket,
            userId: uid
          } as any,
          'INSERT'
        );
      } catch (e) {
        console.error('[Tickets] Falha ao enviar ticket para nuvem', e);
      }
    }

    return ticket;
};

export const getTickets = async (): Promise<Ticket[]> => {
    let local: Ticket[] = [];
    let localError: unknown = null;
    const session = getSession();
    const uid = auth.currentUser?.uid;
    const isPrivileged = session?.role === 'DEV' || session?.role === 'ADMIN';

    try {
        local = await dbGetAll('tickets');
    } catch (e) {
        localError = e;
    }
    try {
        if (!uid && !isPrivileged) {
            return local.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        const baseQuery = isPrivileged
            ? query(collection(db, 'tickets'), orderBy('createdAt', 'desc'))
            : query(collection(db, 'tickets'), where('userId', '==', uid), orderBy('createdAt', 'desc'));
        const snap = await getDocsFromServer(baseQuery);
        const cloudTickets = snap.docs.map(d => ({ ...d.data(), id: d.id } as Ticket));
        const merged = [...local];
        for (const ticket of cloudTickets) {
            if (!merged.find(t => t.id === ticket.id)) {
                merged.push(ticket);
                await dbPut('tickets', ticket);
            }
        }
        return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
        if (localError) {
            throw new Error('Falha ao carregar tickets.');
        }
        return local.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
};

export const updateTicket = async (ticketId: string, updates: Partial<Ticket>) => {
    const existing = await dbGet('tickets', ticketId);
    const updated: Ticket = {
        ...(existing || { id: ticketId } as Ticket),
        ...updates,
        updatedAt: new Date().toISOString()
    } as Ticket;

    await dbPut('tickets', updated);

    if (auth.currentUser) {
      try {
        await safeSetDoc(
          'tickets',
          ticketId,
          {
            ...updates,
            updatedAt: updated.updatedAt,
            updatedAtServer: serverTimestamp()
          } as any,
          { merge: true },
          {
            ...updates,
            updatedAt: updated.updatedAt,
            updatedAtServer: updated.updatedAt
          } as any,
          'UPDATE'
        );
      } catch (e) {
        console.error('[Tickets] Falha ao atualizar ticket na nuvem', e);
      }
    }

    return updated;
};

export const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    const closedAt = status === 'CLOSED' ? new Date().toISOString() : null;
    return updateTicket(ticketId, { status, closedAt });
};

export const updateTicketAssignee = async (ticketId: string, assigneeId?: string, assigneeName?: string) => {
    return updateTicket(ticketId, { assigneeId, assigneeName });
};

export const getOpenTicketCount = async (): Promise<number> => {
    try {
        const session = getSession();
        const uid = auth.currentUser?.uid;
        const isPrivileged = session?.role === 'DEV' || session?.role === 'ADMIN';
        if (!uid && !isPrivileged) return 0;
        const baseQuery = isPrivileged
            ? query(collection(db, 'tickets'), where('status', 'in', ['OPEN', 'IN_PROGRESS']))
            : query(collection(db, 'tickets'), where('userId', '==', uid), where('status', 'in', ['OPEN', 'IN_PROGRESS']));
        const snap = await getDocsFromServer(baseQuery);
        return snap.size;
    } catch (e) {
        return 0;
    }
};
