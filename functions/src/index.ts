import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { adminHardResetUserData } from './adminHardReset';
export { sendAdminNotification } from './admin/sendAdminNotification';
export { sendFcmNotification } from './notifications/sendFcmNotification';
export { sendNtfyNotification } from './ntfy';
export { onTransferWrite, onTicketWrite, onMessageWrite, onSaleWrite, sendWebhookTest } from './webhooks';
