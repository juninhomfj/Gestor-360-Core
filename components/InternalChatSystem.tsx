import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Image as ImageIcon, X, Users, BarChart, Plus, Mic, GalleryHorizontal, Bug, Sparkles, Play, Pause, Camera, Pencil, Trash2 } from 'lucide-react';

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
import { base64ToBlob, fileToBase64 } from '../utils/fileHelper';
import { getSupabase } from '../services/supabase';
import { klipySearch, klipyTrending, resolveKlipyPreviewUrl, KlipyItem } from '../services/klipy';

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

const WAVEFORM_BARS = 48;

const formatTime = (totalSeconds: number) => {
  if (!totalSeconds || Number.isNaN(totalSeconds)) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const getAudioContext = (ref: React.MutableRefObject<AudioContext | null>) => {
  if (!ref.current) ref.current = new AudioContext();
  return ref.current;
};

const decodeAudioBuffer = async (url: string, audioCtx: AudioContext) => {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return await audioCtx.decodeAudioData(buffer.slice(0));
};

const buildWaveform = (audioBuffer: AudioBuffer, bars = WAVEFORM_BARS) => {
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / bars) || 1;
  const waveform: number[] = [];
  let max = 0;

  for (let i = 0; i < bars; i += 1) {
    let peak = 0;
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channelData.length);
    for (let j = start; j < end; j += 1) {
      const val = Math.abs(channelData[j]);
      if (val > peak) peak = val;
    }
    waveform.push(peak);
    if (peak > max) max = peak;
  }

  if (max === 0) return waveform.map(() => 0);
  return waveform.map((v) => v / max);
};

const drawWaveform = (
  canvas: HTMLCanvasElement | null,
  bars: number[],
  progress: number,
  baseColor: string,
  progressColor: string
) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 1;
  const height = canvas.clientHeight || 1;
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const safeProgress = Math.max(0, Math.min(1, progress));
  if (!bars.length) return;
  const barWidth = width / bars.length;

  for (let i = 0; i < bars.length; i += 1) {
    const barHeight = Math.max(2, bars[i] * height);
    const x = i * barWidth;
    const y = (height - barHeight) / 2;
    ctx.fillStyle = i / bars.length <= safeProgress ? progressColor : baseColor;
    ctx.fillRect(x, y, barWidth * 0.7, barHeight);
  }
};

type AudioBubbleProps = {
  url: string;
  darkMode: boolean;
  audioCtxRef: React.MutableRefObject<AudioContext | null>;
  waveformCacheRef: React.MutableRefObject<Map<string, number[]>>;
};

const AudioBubble: React.FC<AudioBubbleProps> = ({ url, darkMode, audioCtxRef, waveformCacheRef }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bars, setBars] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    let active = true;
    const cached = waveformCacheRef.current.get(url);
    if (cached) {
      setBars(cached);
      return;
    }
    const load = async () => {
      try {
        const audioCtx = getAudioContext(audioCtxRef);
        const buffer = await decodeAudioBuffer(url, audioCtx);
        const waveform = buildWaveform(buffer);
        waveformCacheRef.current.set(url, waveform);
        if (active) setBars(waveform);
      } catch {
        if (active) setBars(Array.from({ length: WAVEFORM_BARS }, () => 0.3));
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [url, audioCtxRef, waveformCacheRef]);

  useEffect(() => {
    const progress = duration ? current / duration : 0;
    drawWaveform(
      canvasRef.current,
      bars,
      progress,
      darkMode ? 'rgba(148, 163, 184, 0.5)' : 'rgba(100, 116, 139, 0.4)',
      darkMode ? '#22d3ee' : '#2563eb'
    );
  }, [bars, current, duration, darkMode]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setCurrent(audioRef.current.currentTime);
  };

  const cycleSpeed = () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
  };

  return (
    <div className={`mt-3 w-full rounded-2xl border p-3 flex items-center gap-3 ${darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
      <button
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center ${isPlaying ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'}`}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className="flex-1">
        <canvas ref={canvasRef} onClick={handleSeek} className="w-full h-10 cursor-pointer" />
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
          <span>{formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <button
        onClick={cycleSpeed}
        className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-slate-800 text-white"
      >
        {speed}x
      </button>
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime || 0)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrent(0);
        }}
        onPause={() => setIsPlaying(false)}
      />
    </div>
  );
};

const CHAT_MEDIA_BUCKET = 'chat-attachments';

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
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoRecordingTime, setVideoRecordingTime] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const [ticketCount, setTicketCount] = useState(0);
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  const [klipyOpen, setKlipyOpen] = useState(false);
  const [klipyTab, setKlipyTab] = useState<'gifs' | 'stickers' | 'emojis'>('gifs');
  const [klipyItems, setKlipyItems] = useState<KlipyItem[]>([]);
  const [klipyQuery, setKlipyQuery] = useState('');
  const [klipyLoading, setKlipyLoading] = useState(false);
  const [klipyError, setKlipyError] = useState<string | null>(null);
  const [klipyHasNext, setKlipyHasNext] = useState(false);
  const [klipyPage, setKlipyPage] = useState(1);
  const [floatingVideo, setFloatingVideo] = useState<{ url: string; x: number; y: number } | null>(null);
  const [draggingVideo, setDraggingVideo] = useState(false);

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomPrivate, setRoomPrivate] = useState(true);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedModerators, setSelectedModerators] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<{ unsubscribe: () => void } | null>(null);
  const klipyPanelRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const waveformCacheRef = useRef<Map<string, number[]>>(new Map());
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingAnalyserRef = useRef<AnalyserNode | null>(null);
  const recordingAnimationRef = useRef<number | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<BlobPart[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoTimerRef = useRef<number | null>(null);
  const videoStartRef = useRef<number | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

  useEffect(() => {
    if (!klipyOpen) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (klipyPanelRef.current?.contains(target)) return;
      setKlipyOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [klipyOpen]);
  useEffect(() => {
    if (!isOpen && isRecording) {
      stopRecording();
    }
  }, [isOpen, isRecording]);

  useEffect(() => {
    if (!isRecordingVideo) return;
    const video = videoPreviewRef.current;
    const stream = videoStreamRef.current;
    if (video && stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
    return () => {
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
    };
  }, [isRecordingVideo]);

  useEffect(() => {
    if (!draggingVideo) return;
    const handleMove = (event: MouseEvent) => {
      setFloatingVideo((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          x: event.clientX - dragOffsetRef.current.x,
          y: event.clientY - dragOffsetRef.current.y
        };
      });
    };
    const handleUp = () => setDraggingVideo(false);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [draggingVideo]);


  const handleSend = async () => {
    if (!inputText.trim() && !selectedMedia) return;

    setIsSending(true);
    try {
      let mediaType = selectedMedia?.type;
      let mediaUrl = selectedMedia?.url;

      if (mediaUrl && mediaUrl.startsWith('data:') && (mediaType === 'audio' || mediaType === 'video')) {
        try {
          const mimeMatch = mediaUrl.match(/^data:(.+?);base64,/);
          const mime = mimeMatch ? mimeMatch[1] : (mediaType === 'audio' ? 'audio/webm' : 'video/webm');
          mediaUrl = await uploadMediaToSupabase(mediaUrl, mime);
        } catch (err: any) {
          onNotify('ERROR', err?.message || 'Falha ao enviar m?dia.');
          setIsSending(false);
          return;
        }
      }

      const options = mediaType && mediaUrl
        ? {
            mediaType,
            mediaUrl,
            roomId: activeChatType === 'ROOM' ? activeRoomId || undefined : undefined
          }
        : { roomId: activeChatType === 'ROOM' ? activeRoomId || undefined : undefined };

      const recipient = activeChatType === 'ROOM' ? 'ROOM' : isAdmin ? activeChatId : 'ADMIN';
      const relatedModule = activeChatType === 'ROOM' ? 'rooms' : undefined;

      const sentMsg = await sendMessage(currentUser, inputText, 'CHAT', recipient, undefined, relatedModule, options);

      setMessages((prev) => [...prev, sentMsg]);
      setInputText('');
      setSelectedMedia(null);
      setKlipyOpen(false);
      setKlipyQuery('');
    } catch (err: any) {
      if (isPermissionDenied(err)) {
        onNotify('ERROR', 'Sem permiss?o para enviar mensagem (FireStore rules/perfil).');
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
    if (file.type.startsWith('video/')) {
      setSelectedMedia({ url: dataUrl, type: 'video' });
      return;
    }
    if (file.type === 'image/gif') {
      setSelectedMedia({ url: dataUrl, type: 'gif' });
      return;
    }
    if (file.type.startsWith('image/')) {
      setSelectedMedia({ url: dataUrl, type: 'image' });
      return;
    }
    setSelectedMedia({ url: dataUrl, type: 'other' });
  };
  const openFloatingVideo = (url: string) => {
    const width = 280;
    const height = 180;
    const x = Math.max(20, window.innerWidth - width - 20);
    const y = Math.max(20, window.innerHeight - height - 120);
    setFloatingVideo({ url, x, y });
  };

  const handleVideoDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!floatingVideo) return;
    setDraggingVideo(true);
    dragOffsetRef.current = {
      x: event.clientX - floatingVideo.x,
      y: event.clientY - floatingVideo.y
    };
  };


  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordChunksRef.current = [];
      recordingStreamRef.current = stream;
      recordingStartRef.current = Date.now();
      recordingTimerRef.current = window.setInterval(() => {
        if (!recordingStartRef.current) return;
        setRecordingTime(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 200);

      const audioCtx = getAudioContext(audioCtxRef);
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      recordingAnalyserRef.current = analyser;

      const draw = () => {
        const canvas = recordingCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth || 1;
        const height = canvas.clientHeight || 1;
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#22d3ee';
        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i += 1) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        recordingAnimationRef.current = requestAnimationFrame(draw);
      };
      draw();

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (recordingAnimationRef.current) {
          cancelAnimationFrame(recordingAnimationRef.current);
          recordingAnimationRef.current = null;
        }
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        recordingAnalyserRef.current = null;
        recordingStreamRef.current = null;
        recordingStartRef.current = null;
        setRecordingTime(0);
        const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const file = new File([blob], 'chat-audio.webm', { type: blob.type });
        const dataUrl = await fileToBase64(file);
        setSelectedMedia({ url: dataUrl, type: 'audio' });
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      onNotify('ERROR', 'Permiss?o de microfone negada ou indispon?vel.');
      setIsRecording(false);
    }
  };


  const startVideoRecording = async () => {
    if (isRecordingVideo || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const recorder = new MediaRecorder(stream);
      videoChunksRef.current = [];
      videoStreamRef.current = stream;
      videoStartRef.current = Date.now();
      videoTimerRef.current = window.setInterval(() => {
        if (!videoStartRef.current) return;
        setVideoRecordingTime(Math.floor((Date.now() - videoStartRef.current) / 1000));
      }, 200);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (videoTimerRef.current) {
          clearInterval(videoTimerRef.current);
          videoTimerRef.current = null;
        }
        videoStartRef.current = null;
        setVideoRecordingTime(0);
        const blob = new Blob(videoChunksRef.current, { type: recorder.mimeType || 'video/webm' });
        const file = new File([blob], 'chat-video.webm', { type: blob.type });
        const dataUrl = await fileToBase64(file);
        setSelectedMedia({ url: dataUrl, type: 'video' });
        setIsRecordingVideo(false);
      };

      videoRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingVideo(true);
    } catch (err: any) {
      onNotify('ERROR', 'Permiss?o de c?mera negada ou indispon?vel.');
      setIsRecordingVideo(false);
    }
  };

  const stopVideoRecording = () => {
    if (!videoRecorderRef.current || videoRecorderRef.current.state === 'inactive') return;
    videoRecorderRef.current.stop();
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    mediaRecorderRef.current.stop();
  };


  const uploadMediaToSupabase = async (dataUrl: string, mime: string) => {
    const supabase = await getSupabase();
    if (!supabase) {
      throw new Error('Supabase indispon?vel para upload de m?dia.');
    }
    const blob = await base64ToBlob(dataUrl);
    const ext = (mime.split('/')[1] || 'bin').split(';')[0];
    const path = `internal-chat/${currentUser.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, blob, {
      contentType: mime,
      upsert: false
    });
    if (error) {
      throw new Error(error.message || 'Falha ao enviar m?dia.');
    }
    const { data } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error('Falha ao obter URL p?blica do arquivo.');
    }
    return data.publicUrl;
  };

  const loadKlipy = async (page = 1, append = false) => {
    if (!currentUser?.id) return;
    setKlipyLoading(true);
    setKlipyError(null);
    try {
      const result = klipyQuery.trim()
        ? await klipySearch(klipyTab, currentUser.id, klipyQuery.trim(), page)
        : await klipyTrending(klipyTab, currentUser.id, page);
      setKlipyHasNext(result.hasNext);
      setKlipyPage(result.page);
      setKlipyItems((prev) => (append ? [...prev, ...result.items] : result.items));
    } catch (err: any) {
      setKlipyItems([]);
      setKlipyError(err?.message || 'Falha ao carregar conteúdo do Klipy.');
    } finally {
      setKlipyLoading(false);
    }
  };

  useEffect(() => {
    if (!klipyOpen) return;
    const delay = klipyQuery.trim() ? 350 : 0;
    const handle = setTimeout(() => {
      loadKlipy(1, false);
    }, delay);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klipyOpen, klipyTab, klipyQuery]);

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
        onNotify('ERROR', err?.message || 'Falha ao criar grupo.');
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

  const canViewDeleted = () => {
    if (isAdmin) return true;
    if (activeChatType === 'ROOM' && activeRoomId) {
      const room = rooms.find((r) => r.id === activeRoomId);
      return room?.role === 'moderator';
    }
    return false;
  };

  const canEditMessage = (msg: InternalMessage) => {
    if (msg.deleted) return false;
    const canModerate = canViewDeleted();
    const isOwner = msg.senderId === currentUser.id;
    const hasMedia = Boolean(msg.mediaType || msg.mediaUrl || (msg as any).image);
    return (isOwner || canModerate) && !hasMedia;
  };

  const canDeleteMessage = (msg: InternalMessage) => {
    if (msg.deleted) return false;
    const canModerate = canViewDeleted();
    const isOwner = msg.senderId === currentUser.id;
    return isOwner || canModerate;
  };

  const startEditMessage = (msg: InternalMessage) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content || '');
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const saveEditMessage = async (msg: InternalMessage) => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;
    try {
      await updateMessageContent(msg.id, trimmed);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, content: trimmed } : m)));
      cancelEditMessage();
      onNotify('SUCCESS', 'Mensagem atualizada.');
    } catch (err: any) {
      onNotify('ERROR', err?.message || 'Falha ao editar mensagem.');
    }
  };

  const handleDeleteMessage = async (msg: InternalMessage) => {
    try {
      await softDeleteMessage(msg.id);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, deleted: true } : m)));
      onNotify('SUCCESS', 'Mensagem removida.');
    } catch (err: any) {
      onNotify('ERROR', err?.message || 'Falha ao remover mensagem.');
    }
  };

  const handleKlipySelect = (item: KlipyItem) => {
    const resolved = resolveKlipyPreviewUrl(item);
    if (!resolved.url) {
      onNotify('ERROR', 'Falha ao carregar mídia do Klipy.');
      return;
    }
    const isVideo = resolved.format === 'mp4' || resolved.format === 'webm';
    const mediaType: InternalMessage['mediaType'] =
      klipyTab === 'gifs'
        ? isVideo
          ? 'video'
          : 'gif'
        : klipyTab === 'stickers'
          ? 'sticker'
          : 'image';
    setSelectedMedia({ url: resolved.url, type: mediaType });
    setKlipyOpen(false);
    setKlipyQuery('');
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
              messages.map((msg) => {
                const allowDeleted = canViewDeleted();
                if (msg.deleted && !allowDeleted) return null;
                const isOwn = msg.senderId === currentUser.id;
                const isEditing = editingMessageId === msg.id;
                const showEdit = canEditMessage(msg);
                const showDelete = canDeleteMessage(msg);

                return (
                  <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                        isOwn ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
                      }`}
                    >
                      {msg.deleted ? (
                        <p className="text-xs italic text-slate-300">Mensagem removida</p>
                      ) : (
                        <>
                          {msg.type === 'BUG_REPORT' && (
                            <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-[10px] uppercase">
                              <Bug size={14} /> Ticket de Suporte
                            </div>
                          )}

                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                className="w-full rounded-xl p-2 text-sm text-slate-900"
                                rows={3}
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={cancelEditMessage}
                                  className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase bg-slate-700 text-white"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => saveEditMessage(msg)}
                                  className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-white"
                                >
                                  Salvar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm">{msg.content}</p>
                          )}

                          {(msg.mediaUrl || (msg as any).image) && msg.mediaType === 'audio' && (
                            <AudioBubble
                              url={msg.mediaUrl || (msg as any).image}
                              darkMode={darkMode}
                              audioCtxRef={audioCtxRef}
                              waveformCacheRef={waveformCacheRef}
                            />
                          )}

                          {(msg.mediaUrl || (msg as any).image) && msg.mediaType === 'video' && (
                            <div className="mt-3 w-full">
                              <div className="relative">
                                <video
                                  className="rounded-xl w-full max-h-56 object-cover"
                                  controls
                                  preload="metadata"
                                  src={msg.mediaUrl || (msg as any).image}
                                />
                                <button
                                  onClick={() => openFloatingVideo(msg.mediaUrl || (msg as any).image)}
                                  className="absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] font-black uppercase bg-black/70 text-white"
                                >
                                  Destacar
                                </button>
                              </div>
                            </div>
                          )}

                          {(msg.mediaUrl || (msg as any).image) &&
                            msg.mediaType !== 'audio' &&
                            msg.mediaType !== 'video' && (
                            <img
                              src={msg.mediaUrl || (msg as any).image}
                              alt="M?dia"
                              className="mt-3 rounded-xl max-h-64 object-cover"
                            />
                          )}

                          {!isEditing && (showEdit || showDelete) && (
                            <div className="mt-2 flex items-center justify-end gap-2 text-[10px] font-black uppercase">
                              {showEdit && (
                                <button
                                  onClick={() => startEditMessage(msg)}
                                  className="px-2 py-1 rounded-full bg-slate-700 text-white flex items-center gap-1"
                                >
                                  <Pencil size={12} /> Editar
                                </button>
                              )}
                              {showDelete && (
                                <button
                                  onClick={() => handleDeleteMessage(msg)}
                                  className="px-2 py-1 rounded-full bg-rose-600 text-white flex items-center gap-1"
                                >
                                  <Trash2 size={12} /> Excluir
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4 border-t dark:border-slate-800">
            {isRecordingVideo && (
              <div className={`mb-3 p-3 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200'}`}>
                <div className="flex flex-col gap-3">
                  <video ref={videoPreviewRef} autoPlay muted playsInline className="w-full max-h-56 rounded-xl object-cover" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">{formatTime(videoRecordingTime)}</span>
                    <button
                      onClick={stopVideoRecording}
                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-rose-600 text-white"
                    >
                      Parar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isRecording && (
              <div className={`mb-3 p-3 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <canvas ref={recordingCanvasRef} className="flex-1 h-10" />
                  <span className="text-xs font-bold text-emerald-400">{formatTime(recordingTime)}</span>
                  <button
                    onClick={stopRecording}
                    className="px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-rose-600 text-white"
                  >
                    Parar
                  </button>
                </div>
              </div>
            )}

            {selectedMedia && (
              <div className="mb-3 p-3 rounded-xl bg-slate-800/60 text-white flex flex-col gap-3">
                {selectedMedia.type === 'audio' && (
                  <AudioBubble
                    url={selectedMedia.url}
                    darkMode={darkMode}
                    audioCtxRef={audioCtxRef}
                    waveformCacheRef={waveformCacheRef}
                  />
                )}
                {selectedMedia.type === 'video' && (
                  <video className="w-full max-h-56 rounded-xl object-cover" controls src={selectedMedia.url} />
                )}
                {selectedMedia.type !== 'audio' && selectedMedia.type !== 'video' && (
                  <div className="flex items-center gap-3">
                    <ImageIcon size={18} />
                    <div>
                      <p className="text-xs font-bold">M?dia selecionada</p>
                      <p className="text-[10px] text-slate-300">{selectedMedia.type}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-end">
                  <button onClick={() => setSelectedMedia(null)} className="text-xs font-bold uppercase text-rose-400">
                    Remover
                  </button>
                </div>
              </div>
            )}

            {klipyOpen && (
              <div
                ref={klipyPanelRef}
                className={`mb-3 p-3 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex gap-2">
                    {(['gifs', 'stickers', 'emojis'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setKlipyTab(tab)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase ${klipyTab === tab ? 'bg-emerald-600 text-white' : darkMode ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {tab === 'gifs' ? 'GIFs' : tab === 'stickers' ? 'Stickers' : 'Emojis'}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                    Powered by KLIPY
                  </span>
                </div>

                <input
                  className={`w-full p-2.5 rounded-lg outline-none text-sm ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}
                  placeholder="Search KLIPY"
                  value={klipyQuery}
                  onChange={(e) => setKlipyQuery(e.target.value)}
                />

                {klipyError && (
                  <div className="mt-2 text-xs text-red-400 font-semibold">{klipyError}</div>
                )}

                <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-56 overflow-y-auto">
                  {klipyItems.map((item) => {
                    const preview = resolveKlipyPreviewUrl(item);
                    if (!preview.url) return null;
                    return (
                      <button
                        key={item.slug || item.id}
                        onClick={() => handleKlipySelect(item)}
                        className="rounded-lg overflow-hidden border border-transparent hover:border-emerald-500/60"
                        title={item.title || item.slug}
                      >
                        <img src={preview.url} alt={item.title || 'Klipy'} className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>

                {klipyLoading && (
                  <div className="mt-2 text-xs text-slate-400">Carregando...</div>
                )}

                {!klipyLoading && klipyItems.length === 0 && (
                  <div className="mt-2 text-xs text-slate-400">Nenhum resultado encontrado.</div>
                )}

                {klipyHasNext && !klipyLoading && (
                  <button
                    onClick={() => loadKlipy(klipyPage + 1, true)}
                    className="mt-3 w-full px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-emerald-600 text-white"
                  >
                    Carregar mais
                  </button>
                )}
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
                accept="image/*,audio/*,video/*"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleMediaPick(file);
                  e.currentTarget.value = '';
                }}
              />

              <button
                onClick={() => (isRecording ? stopRecording() : startRecording())}
                className={`p-3 rounded-xl ${isRecording ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-700 text-slate-200'}`}
                title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
              >
                <Mic size={20} />
              </button>

              <button
                onClick={() => (isRecordingVideo ? stopVideoRecording() : startVideoRecording())}
                className={`p-3 rounded-xl ${isRecordingVideo ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-700 text-slate-200'}`}
                title={isRecordingVideo ? 'Parar grava??o de v?deo' : 'Gravar v?deo'}
              >
                <Camera size={20} />
              </button>

              <button
                onClick={() => setKlipyOpen((prev) => !prev)}
                className={`p-3 rounded-xl ${klipyOpen ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}
                title="Klipy"
              >
                <Sparkles size={20} />
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
    
      {floatingVideo && (
        <div
          className={`fixed z-[2105] w-[280px] rounded-2xl border shadow-2xl ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
          style={{ left: floatingVideo.x, top: floatingVideo.y }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 cursor-move border-b border-white/10"
            onMouseDown={handleVideoDragStart}
          >
            <span className="text-[10px] font-black uppercase tracking-widest">Video</span>
            <button
              onClick={() => setFloatingVideo(null)}
              className="text-[10px] font-black uppercase text-red-400"
            >
              Fechar
            </button>
          </div>
          <video className="w-full rounded-b-2xl" controls src={floatingVideo.url} />
        </div>
      )}

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
