import { User } from '../types';

export type ChatContext = {
  roomId?: string;
  recipientId?: string;
};

export const resolveChatContext = (currentUser: User, activeChatId: string, isAdmin: boolean): ChatContext => {
  if (activeChatId.startsWith('room:')) {
    return { roomId: activeChatId.replace('room:', '') };
  }

  if (activeChatId === 'BROADCAST') {
    return { roomId: 'broadcast' };
  }

  if (isAdmin) {
    return { recipientId: activeChatId };
  }

  return { recipientId: 'ADMIN' };
};
