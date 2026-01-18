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

type EnvKey =
  | "VITE_FIREBASE_API_KEY"
  | "VITE_FIREBASE_AUTH_DOMAIN"
  | "VITE_FIREBASE_PROJECT_ID"
  | "VITE_FIREBASE_STORAGE_BUCKET"
  | "VITE_FIREBASE_MESSAGING_SENDER_ID"
  | "VITE_FIREBASE_APP_ID"
  | "VITE_FIREBASE_MEASUREMENT_ID"
  | "VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY";

const readEnv = (key: EnvKey): string => {
  const metaEnv = (import.meta as any)?.env;

  const v1 = metaEnv?.[key];
  if (typeof v1 === "string" && v1.trim() !== "") return v1.trim();

  const legacyKey = key.replace("VITE_FIREBASE_", "VITE_APP_FIREBASE_");
  const v2 = metaEnv?.[legacyKey];
  if (typeof v2 === "string" && v2.trim() !== "") return v2.trim();

  const p = (globalThis as any)?.process;
  const nodeEnv = p?.env;

  const v3 = nodeEnv?.[key];
  if (typeof v3 === "string" && v3.trim() !== "") return v3.trim();

  const v4 = nodeEnv?.[legacyKey];
  if (typeof v4 === "string" && v4.trim() !== "") return v4.trim();

  return "";
};

const isValidString = (v: string) => typeof v === "string" && v.trim().length > 0;

const firebaseConfig = {
  apiKey: readEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("VITE_FIREBASE_APP_ID"),
  measurementId: readEnv("VITE_FIREBASE_MEASUREMENT_ID")
};

const hasCoreConfig =
  isValidString(firebaseConfig.apiKey) &&
  isValidString(firebaseConfig.authDomain) &&
  isValidString(firebaseConfig.projectId);

if (!hasCoreConfig) {
  console.error(
    "[Firebase] Config inválido (apiKey/authDomain/projectId). " +
      "Confirme seu .env(.local|.development|.development.local) e reinicie o Vite. " +
      "Esperado: VITE_FIREBASE_* (ou fallback VITE_APP_FIREBASE_*).",
    {
      apiKey: firebaseConfig.apiKey ? "OK" : "MISSING",
      authDomain: firebaseConfig.authDomain ? "OK" : "MISSING",
      projectId: firebaseConfig.projectId ? "OK" : "MISSING"
    }
  );
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

if (typeof window !== "undefined") {
  const recaptchaKey = readEnv("VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY");
  const isDev = !!(import.meta as any)?.env?.DEV;

  if (isValidString(recaptchaKey) && !recaptchaKey.includes("PLACEHOLDER") && !recaptchaKey.includes("REPLACE_WITH")) {
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

export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (e) {
    const isDev = !!(import.meta as any)?.env?.DEV;
    if (isDev) {
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

export { firebaseConfig };
