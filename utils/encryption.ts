
import CryptoJS from 'crypto-js';

const SECRET_SALT = 'Gestor360_S3cr3t_S@lt_KEY_2024';

export const encryptData = (text: string): string => {
    if (!text) return '';
    return CryptoJS.AES.encrypt(text, SECRET_SALT).toString();
};

export const decryptData = (cipherText: string): string => {
    if (!cipherText) return '';
    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_SALT);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error("Decryption failed", e);
        return '';
    }
};
