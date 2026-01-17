import { getSupabase } from './supabase';
import { ChatAttachment } from '../types';

const EDGE_BASE = 'https://tgdboioadnuiimtuoryy.supabase.co/functions/v1/chat-signed-urls';
const CHAT_BUCKET = 'chat-attachments';

type UploadUrlResponse = {
  uploadUrl: string;
  path: string;
};

type DownloadUrlResponse = {
  downloadUrl: string;
};

const createAuthHeaders = async () => {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error('Supabase indisponível.');
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Sessão Supabase inválida.');
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const buildAttachmentPath = (userId: string, messageId: string, fileName: string) => {
  const safeName = fileName.replace(/[^\w.\-]+/g, '_');
  return `user-${userId}/${messageId}/${Date.now()}-${safeName}`;
};

export const requestUploadUrl = async (path: string, contentType: string) => {
  const headers = await createAuthHeaders();
  const response = await fetch(`${EDGE_BASE}/upload-url`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ path, contentType, expiresInSeconds: 3600 })
  });

  if (!response.ok) {
    throw new Error('Falha ao gerar URL de upload.');
  }

  return response.json() as Promise<UploadUrlResponse>;
};

export const requestDownloadUrl = async (path: string, expiresInSeconds = 120) => {
  const headers = await createAuthHeaders();
  const response = await fetch(`${EDGE_BASE}/download-url`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ path, expiresInSeconds })
  });

  if (!response.ok) {
    throw new Error('Falha ao gerar URL de download.');
  }

  return response.json() as Promise<DownloadUrlResponse>;
};

export const uploadFileToSignedUrl = async (
  uploadUrl: string,
  file: File,
  onProgress?: (progress: number) => void
) => {
  if (onProgress) onProgress(5);
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream'
    }
  });

  if (!response.ok) {
    throw new Error('Falha ao enviar arquivo.');
  }

  if (onProgress) onProgress(100);
};

export const registerAttachment = async (attachment: ChatAttachment) => {
  const headers = await createAuthHeaders();
  const response = await fetch(`${EDGE_BASE}/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      path: attachment.path,
      user_id: attachment.uploadedBy,
      message_id: attachment.messageId,
      metadata: attachment.metadata ?? {
        size: attachment.size,
        name: attachment.fileName,
        contentType: attachment.mime
      }
    })
  });

  if (!response.ok) {
    throw new Error('Falha ao registrar anexo.');
  }
};

export const resolveDownloadUrl = async (attachment: ChatAttachment) => {
  const { downloadUrl } = await requestDownloadUrl(attachment.path);
  return downloadUrl;
};

export const CHAT_ATTACHMENTS_BUCKET = CHAT_BUCKET;
