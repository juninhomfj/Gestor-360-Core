import React from 'react';
import { ChatAttachment, ChatMessage } from '../../types';
import { Download, FileText } from 'lucide-react';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onOpenAttachment?: (attachment: ChatAttachment) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, onOpenAttachment }) => {
  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${isOwn ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white'}`}>
        {message.content && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.attachments.map((attachment) => (
              <button
                key={attachment.id}
                className="w-full flex items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2 text-left text-xs hover:bg-white/10"
                onClick={() => onOpenAttachment?.(attachment)}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText size={14} />
                  <span className="truncate">{attachment.fileName || attachment.path.split('/').pop()}</span>
                </div>
                <Download size={14} />
              </button>
            ))}
          </div>
        )}
      </div>
      {message.status && (
        <span className="mt-1 text-[10px] uppercase tracking-widest text-slate-400">
          {message.status === 'sending' && 'Enviando...'}
          {message.status === 'uploading' && 'Enviando anexos...'}
          {message.status === 'sent' && 'Enviado'}
          {message.status === 'failed' && 'Falhou'}
        </span>
      )}
    </div>
  );
};

export default MessageBubble;
