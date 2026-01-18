import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Image as ImageIcon, X, Users, BarChart, Plus, Mic, Sticker, GalleryHorizontal, Bug } from 'lucide-react';

import { User, InternalMessage } from '../types';
import {
  sendMessage,
  getMessages,
  getRoomMessages,
  subscribeToMessages,
  listRooms,
  createRoom,
  ChatRoom
} from '../services/internalChat';
import { getTicketStats } from '../services/logic';
import { listUsers } from '../services/auth';
import { fileToBase64 } from '../utils/fileHelper';

interface InternalChatSystemProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onNotify: (type: 'SUCCESS' | 'ERROR' | 'INFO', message: string) => void;
}

/**
 * Correção crítica: o componente estava crashando com "messages is not defined".
 * Agora:
 * - `messages` é um state (sempre definido como array)
 * - `channelRef` é um useRef com unsubscribe
 * - `loadData()` busca mensagens com `getMessages()` e usa fallback seguro se der permission-denied
 */
const InternalChatSystem: React.FC<InternalChatSystemProps> = ({
  currentUser,
  isOpen,
  onClose,
  darkMode,
  onNotify
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);

  const [activeChatId, setActiveChatId] = useState<string>('ADMIN');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeChatType, setActiveChatType] = useState<'DIRECT' | 'ROOM'>('DIRECT');

  const [inputText, setInputText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: InternalMessage['mediaType'] } | null>(null);
  const [stickerMode, setStickerMode] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [ticketCount, setTicketCount] = useState(0);
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomPrivate, setRoomPrivate] = useState(true);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedModerators, setSelectedModerators] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<{ unsubscribe: () => void } | null>(null);

  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'DEV';

  const isPermissionDenied = (err: any) => {
    const code = String(err?.code || '');
    const msg = String(err?.message || '');
    return code === 'permission-denied' || msg.includes('Missing or insufficient permissions');
  };

  // Mantém a rolagem no fim quando chegam mensagens.
  useEffect(() => {
    if (!isOpen) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [isOpen, messages.length]);

  const loadData = async () => {
    try {
      const allUsers = await listUsers();
      setUsers(allUsers);

      try {
        const r = await listRooms(currentUser.id);
        setRooms(r);
      } catch {
        // rooms opcionais
      }

      getTicketStats().then(setTicketCount).catch(() => {});

      if (activeChatType === 'ROOM' && activeRoomId) {
        const roomMessages = await getRoomMessages(activeRoomId);
        setMessages(
          [...(roomMessages || [])].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
        );
        return;
      }

      const allMsgs = await getMessages(currentUser.id, isAdmin);
      setIsFallbackMode(Boolean(allMsgs?.usedFallback));

      const base = Array.isArray(allMsgs?.messages) ? allMsgs.messages : [];

      const filtered = isAdmin
        ? base.filter(
            (m) =>
              (m.senderId === activeChatId && m.recipientId === 'ADMIN') ||
              (m.senderId === currentUser.id && m.recipientId === activeChatId) ||
              (m.recipientId === 'BROADCAST' && activeChatId === 'BROADCAST')
          )
        : base;

      setMessages(
        [...filtered].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      );
    } catch (err: any) {
      if (isPermissionDenied(err)) {
        setIsFallbackMode(true);
        setMessages([]);
        onNotify('INFO', 'Chat em modo degradado: sem permissão no Firestore (profiles/isActive/modules).');
        return;
      }
      setMessages([]);
      onNotify('ERROR', 'Falha ao carregar chat interno.');
      console.error('[Chat] loadData falhou', err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    loadData();

    const startSubscription = async () => {
      try {
        const channel = await subscribeToMessages(currentUser.id, isAdmin, (newMsg) => {
          const isDirectChat =
            activeChatType === 'DIRECT' &&
            (
              (newMsg.recipientId === 'ADMIN' && newMsg.senderId === activeChatId) ||
              newMsg.recipientId === activeChatId ||
              (newMsg.recipientId === 'BROADCAST' && activeChatId === 'BROADCAST')
            );

          const isRoomChat =
            activeChatType === 'ROOM' &&
            Boolean(newMsg.roomId) &&
            Boolean(activeRoomId) &&
            newMsg.roomId === activeRoomId;

          if (isDirectChat || isRoomChat) {
            setMessages((prev) =>
              [...prev, newMsg].sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              )
            );
          }
        });

        channelRef.current = channel;
      } catch (err: any) {
        if (isPermissionDenied(err)) {
          setIsFallbackMode(true);
          onNotify('INFO', 'Chat sem assinatura realtime: sem permissão no Firestore.');
          return;
        }
        onNotify('ERROR', 'Falha ao iniciar chat realtime.');
      }
    };

    startSubscription();
    return () => {
      try {
        channelRef.current?.unsubscribe();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeChatId, activeRoomId, activeChatType]);

  const handleSend = async () => {
    if (!inputText.trim() && !selectedMedia) return;

    setIsSending(true);
    try {
      const options = selectedMedia
        ? {
            mediaType: selectedMedia.type,
            mediaUrl: selectedMedia.url,
            roomId: activeChatType === 'ROOM' ? activeRoomId || undefined : undefined
          }
        : { roomId: activeChatType === 'ROOM' ? activeRoomId || undefined : undefined };

      const recipient = activeChatType === 'ROOM' ? 'ROOM' : isAdmin ? activeChatId : 'ADMIN';
      const relatedModule = activeChatType === 'ROOM' ? 'rooms' : undefined;

      const sentMsg = await sendMessage(currentUser, inputText, 'CHAT', recipient, undefined, relatedModule, options);

      setMessages((prev) => [...prev, sentMsg]);
      setInputText('');
      setSelectedMedia(null);
      setStickerMode(false);
    } catch (err: any) {
      if (isPermissionDenied(err)) {
        onNotify('ERROR', 'Sem permissão para enviar mensagem (FireStore rules/perfil).');
      } else {
        onNotify('ERROR', 'Erro ao enviar mensagem.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectRoom = (roomId: string) => {
    setActiveChatType('ROOM');
    setActiveRoomId(roomId);
    setActiveChatId('ADMIN');
  };

  const handleSelectDirect = (userId: string) => {
    setActiveChatType('DIRECT');
    setActiveChatId(userId);
    setActiveRoomId(null);
  };

  const handleMediaPick = async (file: File) => {
    const dataUrl = await fileToBase64(file);
    if (file.type.startsWith('audio/')) {
      setSelectedMedia({ url: dataUrl, type: 'audio' });
      return;
    }
    if (file.type === 'image/gif') {
      setSelectedMedia({ url: dataUrl, type: 'gif' });
      return;
    }
    if (file.type.startsWith('image/')) {
      setSelectedMedia({ url: dataUrl, type: stickerMode ? 'sticker' : 'image' });
      return;
    }
    setSelectedMedia({ url: dataUrl, type: 'other' });
  };

  const handleRoomCreate = async () => {
    if (!roomName.trim()) return;

    try {
      const newRoom = await createRoom(
        roomName.trim(),
        roomPrivate,
        currentUser.id,
        selectedMembers,
        selectedModerators
      );

      if (!newRoom) {
        onNotify('ERROR', 'Falha ao criar grupo.');
        return;
      }

      setRooms((prev) => [newRoom, ...prev]);
      setRoomName('');
      setRoomPrivate(true);
      setSelectedMembers([]);
      setSelectedModerators([]);
      setIsRoomModalOpen(false);
      handleSelectRoom(newRoom.id);
      onNotify('SUCCESS', 'Grupo criado!');
    } catch (err: any) {
      if (isPermissionDenied(err)) {
        onNotify('ERROR', 'Sem permissão para criar grupo (rules/perfil).');
      } else {
        onNotify('ERROR', 'Falha ao criar grupo.');
      }
    }
  };

  if (!isOpen) return null;

  const title = useMemo(() => {
    if (activeChatType === 'ROOM') {
      const room = rooms.find((r) => r.id === activeRoomId);
      return room?.name ? `Chat • ${room.name}` : 'Chat • Sala';
    }
    if (!isAdmin) return 'Chat • Admin';
    const u = users.find((u) => u.id === activeChatId);
    if (activeChatId === 'BROADCAST') return 'Chat • Broadcast';
    return u?.name ? `Chat • ${u.name}` : 'Chat • Direto';
  }, [activeChatType, activeRoomId, activeChatId, rooms, users, isAdmin]);

  const modalContent = (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 animate-in fade-in">
      <div
        className={`w-full md:max-w-4xl h-[100dvh] md:h-[80vh] flex overflow-hidden md:rounded-2xl shadow-2xl border ${
          darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200'
        }`}
      >
        <div className={`hidden md:flex w-1/3 border-r flex-col ${darkMode ? 'border-slate-800 bg-slate-900' : 'bg-gray-50'}`}>
          <div className="p-4 border-b dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Conversas</h3>
              <button
                onClick={() => setIsRoomModalOpen(true)}
                className="text-xs font-black uppercase text-emerald-500 flex items-center gap-1"
              >
                <Plus size={14} /> Novo grupo
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <BarChart size={14} className="text-indigo-500" />
              <span className="text-[10px] font-black uppercase">Tickets Ativos: {ticketCount}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-4 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Diretos</div>
            {users
              .filter((u) => u.id !== currentUser.id)
              .map((user) => {
                const initials = (user?.name || '??').substring(0, 2).toUpperCase();
                return (
                  <button
                    key={user.id}
                    onClick={() => handleSelectDirect(user.id)}
                    className={`w-full p-4 flex items-center gap-3 border-b dark:border-slate-800 ${
                      activeChatType === 'DIRECT' && activeChatId === user.id ? 'bg-indigo-900/20' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-xs">
                      {initials}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">{user?.name || 'Usuário'}</p>
                    </div>
                  </button>
                );
              })}

            <div className="px-4 pt-6 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Grupos</div>
            {rooms.length === 0 && <p className="px-4 pb-4 text-xs text-slate-400">Nenhum grupo criado ainda.</p>}
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleSelectRoom(room.id)}
                className={`w-full p-4 flex items-center gap-3 border-b dark:border-slate-800 ${
                  activeChatType === 'ROOM' && activeRoomId === room.id ? 'bg-emerald-900/20' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/80 flex items-center justify-center font-bold text-xs">
                  <Users size={14} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">{room.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {room.isPrivate ? 'Privado' : 'Público'} • {room.role === 'moderator' ? 'Moderador' : 'Membro'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
            <div className="flex items-center gap-2">
              <h3 className="font-bold">{title}</h3>
              {activeChatType === 'ROOM' && activeRoomId && (
                <span className="text-[10px] uppercase font-black px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Sala
                </span>
              )}
              {isFallbackMode && (
                <span className="text-[10px] uppercase font-black px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Modo degradado
                </span>
              )}
            </div>
            <button onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="text-xs text-slate-400">Nenhuma mensagem ainda.</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.senderId === currentUser.id ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                      msg.senderId === currentUser.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
                    }`}
                  >
                    {msg.type === 'BUG_REPORT' && (
                      <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-[10px] uppercase">
                        <Bug size={14} /> Ticket de Suporte
                      </div>
                    )}
                    <p className="text-sm">{msg.content}</p>

                    {(msg.mediaUrl || (msg as any).image) && msg.mediaType === 'audio' && (
                      <audio className="mt-3 w-full" controls src={msg.mediaUrl || (msg as any).image} />
                    )}

                    {(msg.mediaUrl || (msg as any).image) && msg.mediaType !== 'audio' && (
                      <img
                        src={msg.mediaUrl || (msg as any).image}
                        alt="Mídia"
                        className="mt-3 rounded-xl max-h-64 object-cover"
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t dark:border-slate-800">
            {selectedMedia && (
              <div className="mb-3 p-3 rounded-xl bg-slate-800/60 text-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selectedMedia.type === 'audio' ? <Mic size={18} /> : <ImageIcon size={18} />}
                  <div>
                    <p className="text-xs font-bold">Mídia selecionada</p>
                    <p className="text-[10px] text-slate-300">{selectedMedia.type}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedMedia(null)} className="text-xs font-bold uppercase text-rose-400">
                  Remover
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                className={`flex-1 p-3 rounded-xl outline-none ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Digite..."
                onKeyDown={(e) => e.key === 'Enter' && !isSending && handleSend()}
              />

              <input
                type="file"
                accept="image/*,audio/*"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleMediaPick(file);
                  e.currentTarget.value = '';
                }}
              />

              <button
                onClick={() => setStickerMode((prev) => !prev)}
                className={`p-3 rounded-xl ${stickerMode ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}
                title="Sticker mode"
              >
                <Sticker size={20} />
              </button>

              <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-slate-700 text-white rounded-xl" title="Anexar">
                <GalleryHorizontal size={20} />
              </button>

              <button
                onClick={handleSend}
                disabled={isSending}
                className={`p-3 rounded-xl ${isSending ? 'bg-blue-800 text-white/70' : 'bg-blue-600 text-white'}`}
                title="Enviar"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const roomModal = isRoomModalOpen ? (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-2xl border p-6 ${darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-lg">Criar grupo</h4>
          <button onClick={() => setIsRoomModalOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-black uppercase text-slate-400">Nome do grupo</label>
            <input
              className={`mt-2 w-full p-3 rounded-xl outline-none ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={roomPrivate} onChange={(e) => setRoomPrivate(e.target.checked)} />
            Grupo privado
          </label>

          <div>
            <p className="text-xs font-black uppercase text-slate-400">Participantes</p>
            <div className="mt-2 max-h-36 overflow-y-auto space-y-2">
              {users
                .filter((u) => u.id !== currentUser.id)
                .map((user) => {
                  const checked = selectedMembers.includes(user.id);
                  return (
                    <label key={user.id} className="flex items-center justify-between text-sm">
                      <span>{user.name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedMembers((prev) =>
                            e.target.checked ? [...prev, user.id] : prev.filter((id) => id !== user.id)
                          );
                        }}
                      />
                    </label>
                  );
                })}
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase text-slate-400">Moderadores</p>
            <div className="mt-2 max-h-36 overflow-y-auto space-y-2">
              {users
                .filter((u) => u.id !== currentUser.id)
                .map((user) => {
                  const checked = selectedModerators.includes(user.id);
                  return (
                    <label key={user.id} className="flex items-center justify-between text-sm">
                      <span>{user.name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedModerators((prev) =>
                            e.target.checked ? [...prev, user.id] : prev.filter((id) => id !== user.id)
                          );
                        }}
                      />
                    </label>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setIsRoomModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-700 text-white text-xs font-black uppercase"
          >
            Cancelar
          </button>
          <button
            onClick={handleRoomCreate}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase"
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return createPortal(
    <>
      {modalContent}
      {roomModal}
    </>,
    document.body
  );
};

export default InternalChatSystem;
