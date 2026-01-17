import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChatAttachment, ChatMessage, User } from '../../types';
import { createMessage, fetchMessages, markMessageRead } from '../../services/chatMessages';
import { resolveDownloadUrl } from '../../services/chatFiles';
import { useChatAttachments } from '../../hooks/useChatAttachments';
import { useChatSubscription } from '../../hooks/useChatSubscription';
import MessageComposer from './MessageComposer';
import MessageBubble from './MessageBubble';
import { Loader2 } from 'lucide-react';

interface ChatWindowProps {
  currentUser: User;
  roomId?: string;
  recipientId?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ currentUser, roomId, recipientId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pendingFiles, addFiles, removeFile, clear, uploadAll } = useChatAttachments(currentUser.uid || currentUser.id);
  const pollTimeoutRef = useRef<number | null>(null);
  const pollingActiveRef = useRef(false);
  const pollingStoppedRef = useRef(false);
  const pollAttemptRef = useRef(0);
  const idleCyclesRef = useRef(0);
  const pushStateRef = useRef<'subscribed' | 'error' | 'closed' | 'unavailable' | 'idle'>('idle');

  const POLL_BACKOFF_MS = [3000, 6000, 12000, 20000, 30000];
  const MAX_IDLE_CYCLES = 6;

  const chatLabel = useMemo(() => {
    if (roomId) return `Sala ${roomId}`;
    return `Conversa com ${recipientId}`;
  }, [roomId, recipientId]);

  const stopPolling = () => {
    if (pollTimeoutRef.current) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    pollingActiveRef.current = false;
  };

  const schedulePoll = (delayMs: number, run: () => void) => {
    if (pollTimeoutRef.current) {
      window.clearTimeout(pollTimeoutRef.current);
    }
    pollTimeoutRef.current = window.setTimeout(run, delayMs);
  };

  const runPoll = async () => {
    if (pushStateRef.current === 'subscribed' || pollingStoppedRef.current) {
      stopPolling();
      return;
    }

    const senderId = currentUser.uid || currentUser.id;
    try {
      const data = await fetchMessages({ roomId, recipientId, senderId });
      let hasNew = false;

      setMessages((prev) => {
        const byId = new Map(prev.map((msg) => [msg.id, msg]));
        const next = prev.map((msg) => data.find((item) => item.id === msg.id) ?? msg);
        data.forEach((msg) => {
          if (!byId.has(msg.id)) {
            next.push(msg);
            hasNew = true;
          }
        });
        if (hasNew) {
          return next.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        }
        return next;
      });

      if (hasNew) {
        pollAttemptRef.current = 0;
        idleCyclesRef.current = 0;
      } else {
        pollAttemptRef.current = Math.min(pollAttemptRef.current + 1, POLL_BACKOFF_MS.length - 1);
        idleCyclesRef.current += 1;
      }
    } catch {
      pollAttemptRef.current = Math.min(pollAttemptRef.current + 1, POLL_BACKOFF_MS.length - 1);
      idleCyclesRef.current += 1;
    }

    if (idleCyclesRef.current >= MAX_IDLE_CYCLES) {
      pollingStoppedRef.current = true;
      stopPolling();
      return;
    }

    schedulePoll(POLL_BACKOFF_MS[pollAttemptRef.current], runPoll);
  };

  const startPolling = () => {
    if (pollingActiveRef.current || pushStateRef.current === 'subscribed' || pollingStoppedRef.current) return;
    pollingActiveRef.current = true;
    schedulePoll(POLL_BACKOFF_MS[0], runPoll);
  };

  useEffect(() => {
    let active = true;
    pollingStoppedRef.current = false;
    pollAttemptRef.current = 0;
    idleCyclesRef.current = 0;

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchMessages({
          roomId,
          recipientId,
          senderId: currentUser.uid || currentUser.id
        });
        if (active) {
          setMessages(data);
        }
      } catch {
        if (active) {
          setMessages([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    load().finally(() => {
      if (active && pushStateRef.current !== 'subscribed') {
        startPolling();
      }
    });

    return () => {
      active = false;
      stopPolling();
    };
  }, [roomId, recipientId, currentUser.id, currentUser.uid]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pendingFiles]);

  useChatSubscription({
    roomId,
    userId: currentUser.uid || currentUser.id,
    onMessage: (incoming) => {
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
    },
    onReceipt: (incoming) => {
      setMessages((prev) => prev.map((msg) => (msg.id === incoming.id ? { ...msg, readBy: incoming.readBy } : msg)));
    },
    onStatusChange: (status) => {
      pushStateRef.current = status;
      if (status === 'subscribed') {
        pollAttemptRef.current = 0;
        idleCyclesRef.current = 0;
        pollingStoppedRef.current = false;
        stopPolling();
      } else if (status === 'error' || status === 'closed' || status === 'unavailable') {
        startPolling();
      }
    }
  });

  const handleSend = async () => {
    if (!messageText.trim() && pendingFiles.length === 0) return;
    setIsSending(true);

    const tempId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: tempId,
      senderId: currentUser.uid || currentUser.id,
      recipientId: recipientId ?? null,
      roomId: roomId ?? null,
      content: messageText,
      type: 'CHAT',
      timestamp: new Date().toISOString(),
      attachments: pendingFiles.map((file) => ({
        ...file,
        messageId: tempId
      })),
      status: pendingFiles.length ? 'uploading' : 'sending'
    };

    setMessages((prev) => [...prev, optimistic]);
    setMessageText('');

    try {
      const created = await createMessage({
        senderId: currentUser.uid || currentUser.id,
        recipientId: recipientId ?? null,
        roomId: roomId ?? null,
        content: optimistic.content,
        type: optimistic.type
      });

      let attachments: ChatAttachment[] = [];
      if (pendingFiles.length > 0) {
        const result = await uploadAll(created.id);
        attachments = result.attachments;
        if (result.hasFailures) {
          created.status = 'failed';
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? { ...created, attachments, status: attachments.length ? 'sent' : 'sent' }
            : msg
        )
      );
      clear();
    } catch (error) {
      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? { ...msg, status: 'failed' } : msg)));
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenAttachment = async (attachment: ChatAttachment) => {
    try {
      const downloadUrl = await resolveDownloadUrl(attachment);
      window.open(downloadUrl, '_blank');
    } catch (error) {
      alert('Não foi possível obter o arquivo.');
    }
  };

  const markUnreadVisible = async () => {
    const unread = messages.filter(
      (msg) =>
        msg.senderId !== (currentUser.uid || currentUser.id) &&
        !msg.readBy?.includes(currentUser.uid || currentUser.id)
    );

    if (!unread.length) return;
    try {
      await Promise.all(unread.map((msg) => markMessageRead(msg.id, currentUser.uid || currentUser.id)));
    } catch {
      // Falha silenciosa ao marcar leitura
    }
  };

  useEffect(() => {
    if (!messages.length) return;
    markUnreadVisible();
  }, [messages]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/50">
      <div className="border-b border-slate-800 p-4 text-sm font-bold text-slate-200">{chatLabel}</div>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {isLoading && (
          <div className="flex items-center justify-center text-slate-400">
            <Loader2 className="mr-2 animate-spin" size={16} />
            Carregando mensagens...
          </div>
        )}
        {!isLoading &&
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === (currentUser.uid || currentUser.id)}
              onOpenAttachment={handleOpenAttachment}
            />
          ))}
      </div>
      <MessageComposer
        message={messageText}
        onMessageChange={setMessageText}
        onSend={handleSend}
        isSending={isSending}
        attachments={pendingFiles}
        onFilesSelected={addFiles}
        onRemoveAttachment={removeFile}
      />
    </div>
  );
};

export default ChatWindow;
