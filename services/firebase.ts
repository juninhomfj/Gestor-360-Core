import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const getEnv = (key: string): string => {
  return (import.meta as any).env?.[key] || (process as any).env?.[key] || "";
};

/**
 * Validação rigorosa de chaves para evitar inicialização com placeholders
 */
const isValidKey = (key: string | undefined): boolean => {
  if (!key) return false;
  const k = key.trim();
  return k !== "" && 
         k.length > 15 && 
         !k.includes("REPLACE_WITH") && 
         !k.includes("PLACEHOLDER");
};

export const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || "AIzaSyAoHj36s8WBZlzjC1ekCa0evr4N7Eb8jhY",
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || "gestor360-app.firebaseapp.com",
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || "gestor360-app",
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || "gestor360-app.firebasestorage.app",
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || "461678740958",
  appId: getEnv('VITE_FIREBASE_APP_ID') || "1:461678740958:web:ecb53b055eddd70413494f",
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID') || "G-LMLPQN2PHQ"
};

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// --- 🛡️ APP CHECK SHIELD (SAFE INITIALIZATION) ---
if (typeof window !== "undefined") {
    const recaptchaKey = getEnv('VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY');
    const isDev = (import.meta as any).env?.DEV;
    
    if (isValidKey(recaptchaKey)) {
        initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(recaptchaKey),
            isTokenAutoRefreshEnabled: true
        });
    } else {
        // Silêncio total em produção para chaves inválidas (Etapa 3)
        if (isDev) {
            console.warn("🛠️ [AppCheck] Inicialização ignorada: Chave VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY ausente ou placeholder.");
        }
    }
}

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

// Firestore: tenta usar cache persistente multi-aba. Se falhar (ex.: lock/persistência), faz fallback.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (e) {
    const isDev = (import.meta as any).env?.DEV;
    if (isDev) {
      console.warn('[Firestore] Fallback para getFirestore() (cache persistente indisponível).', e);
    }
    return getFirestore(app);
  }
})();

export const functions = getFunctions(app, 'us-central1');

export const initMessaging = async () => {
    if (typeof window !== "undefined" && await isSupported()) {
        return getMessaging(app);
    }
    return null;
};