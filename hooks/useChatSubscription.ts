import { useEffect, useMemo, useRef } from 'react';
import { getSupabase } from '../services/supabase';
import { ChatMessage } from '../types';

type SubscriptionOptions = {
  roomId?: string;
  userId: string;
  onMessage: (message: ChatMessage) => void;
  onReceipt?: (message: ChatMessage) => void;
  onStatusChange?: (status: 'subscribed' | 'error' | 'closed' | 'unavailable') => void;
};

export const useChatSubscription = ({
  roomId,
  userId,
  onMessage,
  onReceipt,
  onStatusChange
}: SubscriptionOptions) => {
  const channelRef = useRef<ReturnType<any> | null>(null);

  const channelName = useMemo(() => {
    if (roomId) return `chat:room:${roomId}`;
    return `user:${userId}:inbox`;
  }, [roomId, userId]);

  useEffect(() => {
    let active = true;

    const subscribe = async () => {
      const supabase = await getSupabase();
      if (!supabase || !active) {
        onStatusChange?.('unavailable');
        return;
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase.channel(channelName, { config: { private: true } });
      channel
        .on('broadcast', { event: 'message_created' }, (payload: any) => {
          if (!payload?.payload) return;
          onMessage(payload.payload as ChatMessage);
        })
        .on('broadcast', { event: 'message_read' }, (payload: any) => {
          if (!payload?.payload) return;
          onReceipt?.(payload.payload as ChatMessage);
        })
        .subscribe((status) => {
          if (!active) return;
          if (status === 'SUBSCRIBED') {
            onStatusChange?.('subscribed');
          } else if (status === 'CHANNEL_ERROR') {
            onStatusChange?.('error');
          } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
            onStatusChange?.('closed');
          }
        });

      channelRef.current = channel;
    };

    subscribe();

    return () => {
      active = false;
      if (channelRef.current) {
        getSupabase().then((supabase) => {
          if (supabase) supabase.removeChannel(channelRef.current!);
        });
      }
      onStatusChange?.('closed');
    };
  }, [channelName, onMessage, onReceipt, onStatusChange]);
};
