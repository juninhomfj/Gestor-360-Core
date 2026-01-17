import { ChatAttachment, ChatMessage } from '../types';
import { getSupabase } from './supabase';
import { registerAttachment } from './chatFiles';

type CreateMessagePayload = {
  senderId: string;
  recipientId?: string | null;
  roomId?: string | null;
  content: string;
  type: ChatMessage['type'];
};

const mapMessageFromDb = (row: any, attachments?: ChatAttachment[]): ChatMessage => ({
  id: row.id,
  senderId: row.senderid,
  recipientId: row.recipientid,
  roomId: row.room_id,
  content: row.content ?? '',
  type: row.type ?? 'CHAT',
  timestamp: row.timestamp ?? row.created_at ?? new Date().toISOString(),
  read: row.read ?? false,
  readBy: row.readby ?? [],
  attachments
});

const ensureSupabase = async () => {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error('Supabase indisponível.');
  }
  return supabase;
};

export const createMessage = async (payload: CreateMessagePayload): Promise<ChatMessage> => {
  const supabase = await ensureSupabase();
  const { data, error } = await supabase
    .from('internal_messages')
    .insert([
      {
        senderid: payload.senderId,
        recipientid: payload.recipientId ?? null,
        room_id: payload.roomId ?? null,
        content: payload.content,
        type: payload.type,
        timestamp: new Date().toISOString()
      }
    ])
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapMessageFromDb(data);
};

export const fetchMessages = async (
  query: { roomId?: string; recipientId?: string; senderId?: string },
  limit = 30
) => {
  const supabase = await ensureSupabase();

  let base = supabase.from('internal_messages').select('*').order('timestamp', { ascending: true }).limit(limit);
  if (query.roomId) {
    base = base.eq('room_id', query.roomId);
  } else if (query.recipientId && query.senderId) {
    base = base.or(
      `and(senderid.eq.${query.senderId},recipientid.eq.${query.recipientId}),and(senderid.eq.${query.recipientId},recipientid.eq.${query.senderId})`
    );
  }

  const { data, error } = await base;
  if (error) {
    throw new Error(error.message);
  }

  const messages = (data || []).map(row => mapMessageFromDb(row));
  const ids = messages.map(msg => msg.id);
  if (!ids.length) return messages;

  const { data: attachmentsData } = await supabase
    .from('attachments')
    .select('*')
    .in('message_id', ids);

  const grouped = new Map<string, ChatAttachment[]>();
  (attachmentsData || []).forEach((row: any) => {
    const entry: ChatAttachment = {
      id: row.id?.toString?.() ?? crypto.randomUUID(),
      messageId: row.message_id,
      path: row.path,
      mime: row.metadata?.contentType ?? 'application/octet-stream',
      size: row.metadata?.size ?? 0,
      uploadedBy: row.user_id,
      fileName: row.metadata?.name ?? row.path?.split('/').pop(),
      metadata: row.metadata ?? undefined
    };
    const current = grouped.get(row.message_id) ?? [];
    current.push(entry);
    grouped.set(row.message_id, current);
  });

  return messages.map(msg => ({
    ...msg,
    attachments: grouped.get(msg.id) ?? []
  }));
};

export const markMessageRead = async (messageId: string, userId: string) => {
  const supabase = await ensureSupabase();
  const { error } = await supabase.rpc('mark_chat_message_read', {
    message_id: messageId,
    reader_id: userId
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const updateAttachmentRecord = async (attachment: ChatAttachment) => {
  await registerAttachment(attachment);
};
