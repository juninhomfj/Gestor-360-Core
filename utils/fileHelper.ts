
/**
 * Utilitário para manipulação de arquivos e conversão para Base64
 */

/**
 * Converte um arquivo para Base64 (Data URL)
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Falha na conversão para Base64'));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Converte uma string Base64 de volta para um Blob.
 * Essencial para colocar imagens na área de transferência.
 */
export const base64ToBlob = async (base64: string): Promise<Blob> => {
    const res = await fetch(base64);
    return await res.blob();
};

/**
 * Otimiza uma imagem redimensionando e comprimindo
 */
export const optimizeImage = (
    file: File, 
    maxSize: number = 200, 
    quality: number = 0.8
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            reject(new Error('Canvas não suportado'));
            return;
        }

        img.onload = () => {
            // Calcula novas dimensões mantendo proporção
            let width = img.width;
            let height = img.height;

            if (width > height && width > maxSize) {
                height = Math.round((height * maxSize) / width);
                width = maxSize;
            } else if (height > maxSize) {
                width = Math.round((width * maxSize) / height);
                height = maxSize;
            }

            // Define dimensões do canvas
            canvas.width = width;
            canvas.height = height;

            // Desenha a imagem redimensionada
            ctx.drawImage(img, 0, 0, width, height);

            // Converte para Data URL com compressão
            const optimizedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(optimizedBase64);
        };

        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
};

/**
 * Formata o tamanho do arquivo para leitura humana
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Valida se um arquivo é uma imagem
 */
export const isImageFile = (file: File): boolean => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    return imageTypes.includes(file.type);
};

/**
 * Valida se um arquivo é um áudio
 */
export const isAudioFile = (file: File): boolean => {
    const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'];
    return audioTypes.includes(file.type);
};

/**
 * Extrai o tipo MIME de uma string Base64
 */
export const getMimeTypeFromBase64 = (base64: string): string | null => {
    const match = base64.match(/^data:(.+?);base64,/);
    return match ? match[1] : null;
};

/**
 * Verifica se uma string é um Base64 válido
 */
export const isValidBase64 = (str: string): boolean => {
    try {
        // Remove o prefixo data URL se existir
        const base64 = str.includes(',') ? str.split(',')[1] : str;
        return btoa(atob(base64)) === base64;
    } catch (error) {
        return false;
    }
};
