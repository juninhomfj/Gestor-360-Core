import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { dbPut, dbGetAll, dbGet } from '../storage/db';
import { InternalMessage, User } from '../types';
import { Logger } from "./logger";
import { getSupabase } from './supabase';
import { safeSetDoc } from './safeWrites';

const MESSAGE_RETRY_DELAYS_MS = [1000, 3000, 7000];
const CHAT_DEGRADED_MESSAGE =
    "Chat em modo degradado. Exibindo dados locais enquanto o Firestore está indisponível.";
let chatDegradedNotified = false;
const LOG_THROTTLE_MS = 30000;
const logCooldowns = new Map<string, number>();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const logOnce = (key: string, level: 'warn' | 'error', message: string, details?: Record<string, any>) => {
    const now = Date.now();
    const last = logCooldowns.get(key) ?? 0;
    if (now - last < LOG_THROTTLE_MS) return;
    logCooldowns.set(key, now);
    if (level === 'warn') {
        Logger.warn(message, details);
    } else {
        Logger.error(message, details);
    }
};

const notifyChatDegraded = (onDegraded?: (message: string) => void, context?: string, error?: unknown) => {
    if (chatDegradedNotified) return;
    chatDegradedNotified = true;
    logOnce("chat:degraded", 'warn', "[Chat] Chat em modo degradado", {
        context,
        error: (error as Error)?.message
    });
    onDegraded?.(CHAT_DEGRADED_MESSAGE);
};

const sendMessageToCloud = async (msg: InternalMessage, payload: Record<string, any>) => {
  try {
    // Queue payload (sem FieldValue) para garantir online-first.
    const queuePayload = {
      ...payload,
      createdAt: msg.timestamp
    };
    await safeSetDoc('internal_messages', msg.id, payload as any, { merge: true }, queuePayload as any, 'INSERT');
    return true;
  } catch (e) {
    logOnce("chat:send-failed", 'error', "[Chat] Falha ao enviar/enfileirar mensagem", {
      messageId: msg.id,
      error: (e as Error)?.message
    });
    return false;
  }
};

/**
 * Envia uma mensagem persistindo localmente e no Firestore com suporte a Soft Delete.
 */
export const sendMessage = async (
    sender: User, 
    content: string, 
    type: 'CHAT' | 'ACCESS_REQUEST' | 'BROADCAST' | 'BUG_REPORT' | 'SYSTEM' = 'CHAT',
    recipientId: string = 'ADMIN',
    image?: string,
    relatedModule?: 'sales' | 'finance',
    options?: {
        roomId?: string;
        mediaType?: InternalMessage['mediaType'];
        mediaUrl?: string;
    }
) => {
    const supabase = await getSupabase();
    const msg: InternalMessage = {
        id: crypto.randomUUID(),
        senderId: sender.id,
        senderName: sender.name,
        recipientId,
        content,
        image: image || options?.mediaUrl || "",
        mediaType: options?.mediaType,
        mediaUrl: options?.mediaUrl,
        roomId: options?.roomId,
        type,
        timestamp: new Date().toISOString(),
        read: false,
        deleted: false, // Padrão de integridade v2.5
        relatedModule
    };

    await dbPut('internal_messages', msg);

    if (!supabase && auth.currentUser) {
        try {
            const payload: any = {
                senderId: msg.senderId,
                senderName: msg.senderName,
                recipientId: msg.recipientId,
                content: msg.content,
                type: msg.type,
                timestamp: msg.timestamp,
                read: msg.read,
                deleted: false,
                userId: auth.currentUser.uid,
                createdAt: serverTimestamp()
            };

            if (msg.image) payload.image = msg.image;
            if (msg.relatedModule) payload.relatedModule = msg.relatedModule;
            if (msg.mediaType) payload.mediaType = msg.mediaType;
            if (msg.mediaUrl) payload.mediaUrl = msg.mediaUrl;
            if (msg.roomId) payload.roomId = msg.roomId;

            const sent = await sendMessageToCloud(msg, payload);
            if (!sent) {
                notifyChatDegraded(undefined, "sendMessage", new Error("Firestore indisponível ao enviar mensagem."));
            }
        } catch (e) {
            logOnce("chat:send-prepare", 'error', "[Chat] Falha inesperada ao preparar envio", {
                messageId: msg.id,
                error: (e as Error)?.message
            });
        }
    }

    const supabaseClient = await getSupabase();
    if (supabaseClient) {
        try {
            await supabaseClient.from('internal_messages').upsert({
                id: msg.id,
                senderId: msg.senderId,
                senderName: msg.senderName,
                recipientId: msg.recipientId,
                content: msg.content,
                image: msg.image || "",
                media_type: msg.mediaType || null,
                media_url: msg.mediaUrl || null,
                type: msg.type,
                timestamp: msg.timestamp,
                read: msg.read,
                deleted: false,
                relatedModule: msg.relatedModule || null,
                room_id: msg.roomId || null
            });
        } catch (e) {
            Logger.warn("[Chat] Falha ao enviar para Supabase", {
                messageId: msg.id,
                error: (e as Error)?.message
            });
        }
    }

    return msg;
};

export type ChatHistoryResult = {
    messages: InternalMessage[];
    usedFallback: boolean;
};

/**
 * Carrega histórico local de mensagens com filtro RLS e Soft Delete obrigatório.
 */
export const getMessages = async (userId: string, isAdmin: boolean): Promise<ChatHistoryResult> => {
    const all = await dbGetAll('internal_messages');
    let filtered = all;

    if (!isAdmin) {
        filtered = filtered.filter(m =>
            m.recipientId === userId || m.senderId === userId || m.recipientId === 'BROADCAST'
        );
    }

    const supabase = await getSupabase();
    let usedFallback = !supabase;
    if (supabase) {
        try {
            const baseQuery = supabase
                .from('internal_messages')
                .select('*');

            const scopedQuery = isAdmin
                ? baseQuery
                : baseQuery.or(
                    `recipientId.eq.${userId},recipientId.eq.BROADCAST,senderId.eq.${userId}`
                );

            const { data, error } = await scopedQuery
                .order('timestamp', { ascending: false })
                .limit(50);

            if (error) {
                throw error;
            }

            const cloudMsgs = (data || []) as InternalMessage[];
            const merged = [...filtered];
            cloudMsgs.forEach(cm => {
                const normalized = {
                    ...cm,
                    mediaType: (cm as any).media_type ?? cm.mediaType,
                    mediaUrl: (cm as any).media_url ?? cm.mediaUrl,
                    roomId: (cm as any).room_id ?? cm.roomId
                } as InternalMessage;
                if (!merged.find(m => m.id === normalized.id)) merged.push(normalized);
            });

            return {
                messages: merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
                usedFallback: false
            };
        } catch (e: any) {
            logOnce("chat:supabase-read", 'warn', "[Chat] Falha ao ler mensagens no Supabase", {
                error: e?.message,
                isAdmin
            });
            usedFallback = true;
        }
    }

    try {
        const queries = isAdmin
            ? [
                query(
                    collection(db, "internal_messages"),
                    orderBy("createdAt", "desc"),
                    limit(50)
                )
            ]
            : [
                query(
                    collection(db, "internal_messages"),
                    // Índice composto: recipientId + deleted + createdAt (desc)
                    where("recipientId", "in", [userId, "BROADCAST"]),
                    orderBy("createdAt", "desc"),
                    limit(50)
                ),
                query(
                    collection(db, "internal_messages"),
                    // Índice composto: senderId + deleted + createdAt (desc)
                    where("senderId", "==", userId),
                    orderBy("createdAt", "desc"),
                    limit(50)
                )
            ];

        const snaps = await Promise.all(queries.map(q => getDocs(q)));
        const cloudMsgs = snaps.flatMap(snap =>
            snap.docs.map(d => ({ ...d.data(), id: d.id } as InternalMessage))
        );

        const merged = [...filtered];
        cloudMsgs.forEach(cm => {
            if (!merged.find(m => m.id === cm.id)) merged.push(cm);
        });

        return {
            messages: merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
            usedFallback
        };
    } catch (e: any) {
        if (e.code !== 'permission-denied') {
            logOnce("chat:cloud-read", 'warn', "[Chat] Falha ao ler mensagens da nuvem", {
                error: e?.message,
                code: e?.code,
                name: e?.name,
                stack: e?.stack,
                isAdmin
            });
            notifyChatDegraded(undefined, "getMessages", e);
        }
        return {
            messages: filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
            usedFallback: true
        };
    }
};

/**
 * Subscreve ao Firestore para mensagens novas com filtro de integridade mandatório.
 */
export const subscribeToMessages = async (
    userId: string, 
    isAdmin: boolean, 
    onNewMessage: (msg: InternalMessage) => void,
    onDegraded?: (message: string) => void
) => {
    const supabaseClient = await getSupabase();
    if (supabaseClient) {
        const channel = supabaseClient.channel('internal_messages_stream');
        channel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'internal_messages' },
            async (payload) => {
                const data = {
                    ...(payload.new as InternalMessage),
                    mediaType: (payload.new as any).media_type ?? (payload.new as any).mediaType,
                    mediaUrl: (payload.new as any).media_url ?? (payload.new as any).mediaUrl,
                    roomId: (payload.new as any).room_id ?? (payload.new as any).roomId
                } as InternalMessage;
                if (data.deleted) return;
                if (
                    data.recipientId === userId ||
                    data.senderId === userId ||
                    data.recipientId === 'BROADCAST' ||
                    data.roomId ||
                    isAdmin
                ) {
                    const existing = await dbGet('internal_messages', data.id);
                    if (!existing) {
                        await dbPut('internal_messages', data);
                        onNewMessage(data);
                    }
                }
            }
        );
        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') return;
            if (status === 'CHANNEL_ERROR') {
                logOnce("chat:supabase-realtime", 'warn', "[Chat] Falha ao assinar Supabase Realtime", { status });
            }
        });

        return {
            unsubscribe: () => {
                supabaseClient.removeChannel(channel);
            }
        };
    }

    const handleSnapshot = (snapshot: any) => {
        snapshot.docChanges().forEach(async (change: any) => {
            if (change.type === "added") {
                const data = change.doc.data();
                const newMsg = {
                    ...data,
                    id: change.doc.id,
                    timestamp: data.timestamp || (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
                } as InternalMessage;

                const existing = await dbGet('internal_messages', newMsg.id);
                if (!existing) {
                    await dbPut('internal_messages', newMsg);
                    onNewMessage(newMsg);
                }
            }
        });
    };

    const handleError = (error: any) => {
        if (error.code !== 'permission-denied') {
            logOnce("chat:firestore-subscribe", 'warn', "[Chat] Falha na assinatura de mensagens", { error: error?.message, isAdmin });
            notifyChatDegraded(onDegraded, "subscribeToMessages", error);
        }
    };

    const queries = isAdmin
        ? [
            query(
                collection(db, "internal_messages"),
                // Índice composto: deleted + createdAt (desc)
                where("deleted", "==", false),
                orderBy("createdAt", "desc"),
                limit(20)
            )
        ]
        : [
            query(
                collection(db, "internal_messages"),
                // Índice composto: recipientId + deleted + createdAt (desc)
                where("recipientId", "in", [userId, "BROADCAST"]),
                where("deleted", "==", false),
                orderBy("createdAt", "desc"),
                limit(20)
            ),
            query(
                collection(db, "internal_messages"),
                // Índice composto: senderId + deleted + createdAt (desc)
                where("senderId", "==", userId),
                where("deleted", "==", false),
                orderBy("createdAt", "desc"),
                limit(20)
            )
        ];

    const unsubscribes = queries.map(q => onSnapshot(q, handleSnapshot, handleError));

    const unsubscribe = () => {
        unsubscribes.forEach(unsub => unsub());
    };

    return { unsubscribe };
};

export const getRoomMessages = async (roomId: string): Promise<InternalMessage[]> => {
    const supabase = await getSupabase();
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('internal_messages')
                .select('*')
                .eq('room_id', roomId)
                .order('timestamp', { ascending: false })
                .limit(50);
            if (error) throw error;
            return (data || []).map((msg: any) => ({
                ...msg,
                mediaType: msg.media_type ?? msg.mediaType,
                mediaUrl: msg.media_url ?? msg.mediaUrl,
                roomId: msg.room_id ?? msg.roomId
            })) as InternalMessage[];
        } catch (e: any) {
            logOnce("chat:room-read", 'warn', "[Chat] Falha ao ler mensagens da sala", { error: e?.message, roomId });
        }
    }

    const local = await dbGetAll('internal_messages', (msg) => (msg as InternalMessage).roomId === roomId);
    return local;
};

export type ChatRoom = {
    id: string;
    name: string;
    isPrivate: boolean;
    role?: string;
};

export const listRooms = async (userId: string): Promise<ChatRoom[]> => {
    const supabase = await getSupabase();
    if (!supabase) return [];
    try {
        const { data: memberRows, error } = await supabase
            .from('room_members')
            .select('room_id, role')
            .eq('user_id', userId);
        if (error) throw error;
        const roomIds = (memberRows || []).map((row: any) => row.room_id);
        if (!roomIds.length) return [];

        const { data: rooms, error: roomsError } = await supabase
            .from('rooms')
            .select('*')
            .in('id', roomIds);
        if (roomsError) throw roomsError;
        const roleByRoom = new Map((memberRows || []).map((row: any) => [row.room_id, row.role]));

        return (rooms || []).map((room: any) => ({
            id: room.id,
            name: room.name,
            isPrivate: !!room.is_private,
            role: roleByRoom.get(room.id)
        }));
    } catch (e: any) {
        Logger.warn("[Chat] Falha ao listar salas", { error: e?.message });
        return [];
    }
};

export const createRoom = async (
    name: string,
    isPrivate: boolean,
    creatorId: string,
    members: string[],
    moderators: string[]
): Promise<ChatRoom | null> => {
    const supabase = await getSupabase();
    if (!supabase) {
        throw new Error("Supabase não configurado para salas de chat.");
    }
    try {
        const { data: roomData, error } = await supabase
            .from('rooms')
            .insert([{ name, is_private: isPrivate }])
            .select()
            .single();
        if (error) throw error;

        const uniqueMembers = Array.from(new Set([creatorId, ...members]));
        const memberRows = uniqueMembers.map(userId => ({
            room_id: roomData.id,
            user_id: userId,
            role: moderators.includes(userId) || userId === creatorId ? 'moderator' : 'member'
        }));
        const { error: memberError } = await supabase
            .from('room_members')
            .insert(memberRows);
        if (memberError) throw memberError;

        return {
            id: roomData.id,
            name: roomData.name,
            isPrivate: !!roomData.is_private,
            role: moderators.includes(creatorId) ? 'moderator' : 'member'
        };
    } catch (e: any) {
        Logger.warn("[Chat] Falha ao criar sala", { error: e?.message });
        throw e;
    }
};

export const markMessageRead = async (msgId: string, userId: string) => {
    const msg = await dbGet('internal_messages', msgId);
    if (msg) {
        const updated = { ...msg, read: true };
        if (msg.recipientId === 'BROADCAST') {
            const readers = msg.readBy || [];
            if (!readers.includes(userId)) updated.readBy = [...readers, userId];
            else return;
        }

        await dbPut('internal_messages', updated);

        const supabase = await getSupabase();
        if (supabase) {
            try {
                await supabase
                    .from('internal_messages')
                    .update({ read: updated.read, readBy: updated.readBy || [] })
                    .eq('id', msgId);
            } catch (e) {
                Logger.warn("[Chat] Falha ao marcar leitura no Supabase", {
                    error: (e as Error)?.message,
                    messageId: msgId
                });
            }
            return;
        }

        if (auth.currentUser) {
            try {
                await safeSetDoc(
                    'internal_messages',
                    msgId,
                    {
                        read: updated.read,
                        readBy: updated.readBy || []
                    } as any,
                    { merge: true },
                    {
                        read: updated.read,
                        readBy: updated.readBy || []
                    } as any,
                    'UPDATE'
                );
            } catch (e) {}
        }
    }
};

export const updateMessageContent = async (messageId: string, content: string) => {
    const existing = await dbGet('internal_messages', messageId);
    if (existing) {
        await dbPut('internal_messages', { ...existing, content });
    }

    const supabase = await getSupabase();
    if (supabase) {
        const { error } = await supabase
            .from('internal_messages')
            .update({ content })
            .eq('id', messageId);
        if (error) throw error;
        return;
    }

    if (auth.currentUser) {
        await safeSetDoc(
            'internal_messages',
            messageId,
            { content } as any,
            { merge: true },
            { content } as any,
            'UPDATE'
        );
    }
};

export const softDeleteMessage = async (messageId: string) => {
    const existing = await dbGet('internal_messages', messageId);
    if (existing) {
        await dbPut('internal_messages', { ...existing, deleted: true });
    }

    const supabase = await getSupabase();
    if (supabase) {
        const { error } = await supabase
            .from('internal_messages')
            .update({ deleted: true })
            .eq('id', messageId);
        if (error) throw error;
        return;
    }

    if (auth.currentUser) {
        await safeSetDoc(
            'internal_messages',
            messageId,
            { deleted: true } as any,
            { merge: true },
            { deleted: true } as any,
            'UPDATE'
        );
    }
};
