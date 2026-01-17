import { useCallback, useMemo, useState } from 'react';
import { ChatAttachment, ChatAttachmentStatus } from '../types';
import {
  buildAttachmentPath,
  requestUploadUrl,
  uploadFileToSignedUrl
} from '../services/chatFiles';
import { updateAttachmentRecord } from '../services/chatMessages';

type PendingAttachment = ChatAttachment & {
  file: File;
  status: ChatAttachmentStatus;
  progress: number;
};

type UploadResult = {
  attachments: ChatAttachment[];
  hasFailures: boolean;
};

const CONCURRENCY_LIMIT = 3;

export const useChatAttachments = (userId: string | undefined) => {
  const [items, setItems] = useState<PendingAttachment[]>([]);

  const pendingFiles = useMemo(() => items, [items]);

  const addFiles = useCallback((files: FileList | File[]) => {
    if (!userId) return;
    const list = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      messageId: '',
      path: '',
      mime: file.type || 'application/octet-stream',
      size: file.size,
      uploadedBy: userId,
      fileName: file.name,
      file,
      progress: 0,
      status: 'queued' as ChatAttachmentStatus
    }));

    setItems((prev) => [...prev, ...list]);
  }, [userId]);

  const removeFile = useCallback((id: string) => {
    setItems((prev) => prev.filter(item => item.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const uploadAll = useCallback(async (messageId: string): Promise<UploadResult> => {
    if (!userId) {
      return { attachments: [], hasFailures: true };
    }

    const working = [...items];
    const completed: ChatAttachment[] = [];
    let hasFailures = false;

    const runUpload = async (attachment: PendingAttachment) => {
      try {
        setItems(prev => prev.map(item => item.id === attachment.id ? { ...item, status: 'uploading', progress: 10 } : item));
        const path = buildAttachmentPath(userId, messageId, attachment.fileName || attachment.file.name);
        const { uploadUrl, path: storedPath } = await requestUploadUrl(path, attachment.mime);
        await uploadFileToSignedUrl(uploadUrl, attachment.file, (progress) => {
          setItems(prev => prev.map(item => item.id === attachment.id ? { ...item, progress } : item));
        });
        const persisted: ChatAttachment = {
          id: attachment.id,
          messageId,
          path: storedPath,
          mime: attachment.mime,
          size: attachment.size,
          uploadedBy: userId,
          fileName: attachment.fileName,
          metadata: {
            size: attachment.size,
            name: attachment.fileName,
            contentType: attachment.mime
          }
        };
        await updateAttachmentRecord(persisted);
        completed.push(persisted);
        setItems(prev => prev.map(item => item.id === attachment.id ? { ...item, status: 'complete', progress: 100 } : item));
      } catch (error) {
        hasFailures = true;
        setItems(prev => prev.map(item => item.id === attachment.id ? { ...item, status: 'failed', progress: 0 } : item));
      }
    };

    const queue = working.filter(item => item.status !== 'canceled');
    let cursor = 0;
    const runners = new Array(Math.min(CONCURRENCY_LIMIT, queue.length)).fill(null).map(async () => {
      while (cursor < queue.length) {
        const current = queue[cursor];
        cursor += 1;
        await runUpload(current);
      }
    });

    await Promise.all(runners);

    return { attachments: completed, hasFailures };
  }, [items, userId]);

  return {
    pendingFiles,
    addFiles,
    removeFile,
    clear,
    uploadAll
  };
};
