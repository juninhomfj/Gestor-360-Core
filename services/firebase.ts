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

type EnvBag = Record<string, any>;

const envBag = (): EnvBag => {
  const metaEnv = (import.meta as any)?.env;
  return metaEnv && typeof metaEnv === "object" ? metaEnv : {};
};

const cleanEnvValue = (v: unknown): string => {
  if (v == null) return "";
  const s = String(v).trim();
  // remove aspas "..." ou '...'
  return s.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();
};

const readEnv = (...keys: string[]): string => {
  const e = envBag();
  for (const k of keys) {
    const v = cleanEnvValue(e?.[k]);
    if (v !== "") return v;
  }
  return "";
};

const isValid = (v: string): boolean => cleanEnvValue(v).length > 5;

// Vite injeta DEV/PROD aqui; em dev, DEV = true.
const DEV = !!envBag()?.DEV;

export const firebaseConfig = {
  apiKey: readEnv("VITE_FIREBASE_API_KEY", "VITE_APP_FIREBASE_API_KEY"),
  authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN", "VITE_APP_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("VITE_FIREBASE_PROJECT_ID", "VITE_APP_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET", "VITE_APP_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "VITE_APP_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("VITE_FIREBASE_APP_ID", "VITE_APP_FIREBASE_APP_ID"),
  measurementId: readEnv("VITE_FIREBASE_MEASUREMENT_ID", "VITE_APP_FIREBASE_MEASUREMENT_ID")
};

const hasRequired =
  isValid(firebaseConfig.apiKey) &&
  isValid(firebaseConfig.authDomain) &&
  isValid(firebaseConfig.projectId);

// ✅ IMPORTANTE: se não tem env, NÃO inicializa o Firebase.
// Isso evita o "auth/invalid-api-key" e a tela branca sem explicação.
if (!hasRequired) {
  const e = envBag();

  console.error(
    "[Firebase] Config inválido (apiKey/authDomain/projectId). " +
      "O Vite NÃO está enxergando suas variáveis do .env.local.\n" +
      "✅ Coloque o .env.local na MESMA pasta do package.json do frontend (onde você roda npm run dev) e reinicie o Vite.\n" +
      "Esperado: VITE_FIREBASE_* (ou fallback VITE_APP_FIREBASE_*).",
    {
      mode: e?.MODE,
      baseUrl: e?.BASE_URL,
      hasApiKey: !!firebaseConfig.apiKey,
      hasAuthDomain: !!firebaseConfig.authDomain,
      hasProjectId: !!firebaseConfig.projectId,
      dica:
        "Se você editou .env.local, precisa parar e subir o Vite de novo. " +
        "Se persistir, limpe cache do navegador e apague node_modules/.vite."
    }
  );

  throw new Error(
    "Firebase não inicializou: variáveis de ambiente ausentes. " +
      "Verifique o .env.local no diretório correto do Vite e reinicie (npm run dev)."
  );
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// --- 🛡️ APP CHECK (opcional) ---
if (typeof window !== "undefined") {
  const recaptchaKey = readEnv(
    "VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY",
    "VITE_APP_FIREBASE_APPCHECK_RECAPTCHA_KEY"
  );

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

// Persistência Auth (não quebra o app se falhar)
setPersistence(auth, browserLocalPersistence).catch((e) => {
  if (DEV) console.warn("[Auth] setPersistence falhou (seguindo sem persistência local).", e);
});

// Firestore: tenta cache persistente multi-aba. Se falhar, fallback para getFirestore().
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (e) {
    if (DEV) {
      console.warn("[Firestore] Fallback para getFirestore() (cache persistente indisponível).", e);
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
