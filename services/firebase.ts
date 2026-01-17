import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const getEnv = (key: string): string => {
  const metaEnv = (import.meta as any)?.env;
  if (metaEnv && typeof metaEnv[key] === "string") return String(metaEnv[key]);

  // Browser-safe: só tenta process.env se existir
  const p = (globalThis as any)?.process;
  const nodeEnv = p?.env;
  if (nodeEnv && typeof nodeEnv[key] === "string") return String(nodeEnv[key]);

  return "";
};

const isValidKey = (key: string | undefined): boolean => {
  if (!key) return false;
  const k = key.trim();
  return (
    k !== "" &&
    k.length > 15 &&
    !k.includes("REPLACE_WITH") &&
    !k.includes("PLACEHOLDER")
  );
};

export const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID"),
  measurementId: getEnv("VITE_FIREBASE_MEASUREMENT_ID")
};

// Guard: evita inicializar com API key vazia (causa auth/invalid-api-key)
const isDev = !!(import.meta as any)?.env?.DEV;
if (!isValidKey(firebaseConfig.apiKey) || !firebaseConfig.projectId) {
  if (isDev) {
    console.warn(
      "[Firebase] Variáveis de ambiente incompletas. Verifique .env.local (VITE_FIREBASE_*).",
      {
        hasApiKey: !!firebaseConfig.apiKey,
        projectId: firebaseConfig.projectId || "(empty)",
        authDomain: firebaseConfig.authDomain || "(empty)"
      }
    );
  }
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// --- 🛡️ APP CHECK SHIELD (SAFE INITIALIZATION) ---
if (typeof window !== "undefined") {
  const recaptchaKey = getEnv("VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY");

  if (isValidKey(recaptchaKey)) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey),
      isTokenAutoRefreshEnabled: true
    });
  } else {
    if (isDev) {
      console.warn(
        "🛠️ [AppCheck] Inicialização ignorada: Chave VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY ausente ou placeholder."
      );
    }
  }
}

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

// Firestore: tenta usar cache persistente multi-aba. Se falhar, fallback para getFirestore().
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (e) {
    if (isDev) {
      console.warn(
        "[Firestore] Fallback para getFirestore() (cache persistente indisponível).",
        e
      );
    }
    return getFirestore(app);
  }
})();

export const functions = getFunctions(app, "us-central1");

export const initMessaging = async () => {
  if (typeof window !== "undefined" && (await isSupported())) {
    return getMessaging(app);
  }
  return null;
};
