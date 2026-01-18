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

const clean = (v: unknown): string => {
  if (v == null) return "";
  const s = String(v).trim();
  return s.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();
};

const DEV = import.meta.env.DEV;

// ✅ leitura estática (correta pro Vite em dev e build)
const env = {
  FIREBASE_API_KEY: clean(import.meta.env.VITE_FIREBASE_API_KEY) || clean(import.meta.env.VITE_APP_FIREBASE_API_KEY),
  FIREBASE_AUTH_DOMAIN:
    clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || clean(import.meta.env.VITE_APP_FIREBASE_AUTH_DOMAIN),
  FIREBASE_PROJECT_ID:
    clean(import.meta.env.VITE_FIREBASE_PROJECT_ID) || clean(import.meta.env.VITE_APP_FIREBASE_PROJECT_ID),
  FIREBASE_STORAGE_BUCKET:
    clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || clean(import.meta.env.VITE_APP_FIREBASE_STORAGE_BUCKET),
  FIREBASE_MESSAGING_SENDER_ID:
    clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
    clean(import.meta.env.VITE_APP_FIREBASE_MESSAGING_SENDER_ID),
  FIREBASE_APP_ID: clean(import.meta.env.VITE_FIREBASE_APP_ID) || clean(import.meta.env.VITE_APP_FIREBASE_APP_ID),
  FIREBASE_MEASUREMENT_ID:
    clean(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) || clean(import.meta.env.VITE_APP_FIREBASE_MEASUREMENT_ID),

  // AppCheck (opcional)
  APPCHECK_RECAPTCHA_KEY:
    clean((import.meta.env as any).VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY) ||
    clean((import.meta.env as any).VITE_APP_FIREBASE_APPCHECK_RECAPTCHA_KEY)
};

export const firebaseConfig = {
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN,
  projectId: env.FIREBASE_PROJECT_ID,
  storageBucket: env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
  appId: env.FIREBASE_APP_ID,
  measurementId: env.FIREBASE_MEASUREMENT_ID
};

const hasRequired = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);

if (!hasRequired) {
  console.error(
    "[Firebase] Variáveis ausentes. Confirme .env/.env.local e reinicie o Vite.",
    {
      hasApiKey: Boolean(firebaseConfig.apiKey),
      hasAuthDomain: Boolean(firebaseConfig.authDomain),
      hasProjectId: Boolean(firebaseConfig.projectId),
      mode: import.meta.env.MODE,
      baseUrl: import.meta.env.BASE_URL
    }
  );

  throw new Error(
    "Firebase não inicializou: variáveis de ambiente ausentes. Verifique o .env/.env.local e reinicie (npm run dev)."
  );
}

// marcador para você ter certeza que ESTE arquivo está sendo usado
console.log("[Firebase] bootstrap OK (arquivo firebase.ts correto carregado).", {
  apiKeyPreview: firebaseConfig.apiKey.slice(0, 6),
  apiKeyLen: firebaseConfig.apiKey.length,
  projectId: firebaseConfig.projectId
});

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

if (typeof window !== "undefined") {
  const recaptchaKey = env.APPCHECK_RECAPTCHA_KEY;

  if (recaptchaKey && recaptchaKey.length > 10 && !recaptchaKey.includes("PLACEHOLDER")) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey),
      isTokenAutoRefreshEnabled: true
    });
  } else if (DEV) {
    console.warn("🛠️ [AppCheck] Ignorado: chave reCAPTCHA ausente.");
  }
}

export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch((e) => {
  if (DEV) console.warn("[Auth] setPersistence falhou (seguindo sem persistência local).", e);
});

export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (e) {
    if (DEV) console.warn("[Firestore] Fallback para getFirestore() (cache persistente indisponível).", e);
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
