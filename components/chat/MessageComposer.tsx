import React, { useRef } from 'react';
import { Paperclip, Send } from 'lucide-react';
import AttachmentPreview from './AttachmentPreview';
import { ChatAttachment, ChatAttachmentStatus } from '../../types';

interface MessageComposerProps {
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  isSending?: boolean;
  attachments: Array<ChatAttachment & { progress?: number; status?: ChatAttachmentStatus }>;
  onFilesSelected: (files: FileList) => void;
  onRemoveAttachment: (id: string) => void;
}

const MessageComposer: React.FC<MessageComposerProps> = ({
  message,
  onMessageChange,
  onSend,
  isSending,
  attachments,
  onFilesSelected,
  onRemoveAttachment
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="border-t border-slate-800 bg-slate-950/60 p-4">
      {attachments.length > 0 && (
        <div className="mb-4 space-y-2">
          {attachments.map((attachment) => (
            <AttachmentPreview
              key={attachment.id}
              attachment={attachment}
              status={attachment.status}
              progress={attachment.progress}
              onRemove={onRemoveAttachment}
            />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) {
              onFilesSelected(event.target.files);
              event.target.value = '';
            }
          }}
        />
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <button
            onClick={handleFileClick}
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 p-3 text-slate-300 hover:text-white sm:flex-none"
           aria-label="Anexar" title="Anexar">
            <Paperclip size={18} />
          </button>
          <button
            onClick={onSend}
            disabled={isSending}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-60 sm:flex-none"
           aria-label="Enviar" title="Enviar">
            <Send size={18} />
          </button>
        </div>
        <input
          className="w-full flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={message}
          onChange={(event) = /> onMessageChange(event.target.value)}
          placeholder="Digite sua mensagem..."
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
      </div>
    </div>
  );
};

export default MessageComposer;
