import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

// garante o diretório real deste arquivo (a pasta do projeto)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // força o Vite a carregar env SEMPRE desta pasta (onde está o vite.config.ts)
  const envDir = __dirname;

  // carrega tudo (prefixo vazio) só para debug no terminal.
  // o que vai para o client continua respeitando envPrefix = ['VITE_']
  const env = loadEnv(mode, envDir, "");

  const has = (k: string) => Boolean(env[k] && String(env[k]).trim());

  console.log("[Vite] mode:", mode);
  console.log("[Vite] envDir:", envDir);
  console.log("[Vite] Firebase env presente?:", {
    VITE_FIREBASE_API_KEY: has("VITE_FIREBASE_API_KEY"),
    VITE_FIREBASE_AUTH_DOMAIN: has("VITE_FIREBASE_AUTH_DOMAIN"),
    VITE_FIREBASE_PROJECT_ID: has("VITE_FIREBASE_PROJECT_ID"),
    VITE_APP_FIREBASE_API_KEY: has("VITE_APP_FIREBASE_API_KEY"),
    VITE_APP_FIREBASE_AUTH_DOMAIN: has("VITE_APP_FIREBASE_AUTH_DOMAIN"),
    VITE_APP_FIREBASE_PROJECT_ID: has("VITE_APP_FIREBASE_PROJECT_ID"),
  });

  return {
    plugins: [react()],
    envDir,
    envPrefix: ["VITE_"],
  };
});
