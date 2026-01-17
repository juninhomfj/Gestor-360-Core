import React from 'react';
import { ChatAttachment, ChatAttachmentStatus } from '../../types';
import { XCircle, AlertTriangle, File, Image as ImageIcon, Loader2 } from 'lucide-react';

interface AttachmentPreviewProps {
  attachment: ChatAttachment;
  status?: ChatAttachmentStatus;
  progress?: number;
  onRemove?: (id: string) => void;
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachment, status, progress, onRemove }) => {
  const isImage = attachment.mime?.startsWith('image/');
  const showProgress = status === 'uploading' || status === 'queued';
  const showFailed = status === 'failed';

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800">
        {isImage ? <ImageIcon size={18} /> : <File size={18} />}
      </div>
      <div className="flex-1">
        <p className="font-semibold truncate">{attachment.fileName || 'Arquivo'}</p>
        <p className="text-xs text-slate-400">{Math.round((attachment.size / 1024) * 10) / 10} KB</p>
        {showProgress && (
          <div className="mt-2 h-2 rounded-full bg-slate-800">
            <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${progress ?? 0}%` }} />
          </div>
        )}
        {showFailed && <p className="mt-1 text-xs text-red-400">Falha no upload.</p>}
      </div>
      <div className="flex items-center gap-2">
        {status === 'uploading' && <Loader2 className="animate-spin text-indigo-400" size={16} />}
        {status === 'failed' && <AlertTriangle className="text-red-400" size={16} />}
        {onRemove && status !== 'uploading' && (
          <button onClick={() => onRemove(attachment.id)} className="text-slate-500 hover:text-red-400">
            <XCircle size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default AttachmentPreview;
