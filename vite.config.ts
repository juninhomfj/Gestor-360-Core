import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

// garante o diretório real deste arquivo (a pasta do projeto)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveAppVersion(mode: string, env: Record<string, string>) {
  // 1) Se o usuário já setou explicitamente, respeita
  const explicit = String(env["VITE_APP_VERSION"] || "").trim();
  if (explicit) return explicit;

  // 2) Vercel costuma expor esses envs no build
  const sha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  if (sha) return sha.slice(0, 12);

  const deployId = String(process.env.VERCEL_DEPLOYMENT_ID || "").trim();
  if (deployId) return deployId.slice(0, 12);

  const ref = String(process.env.VERCEL_GIT_COMMIT_REF || "").trim();
  if (ref) return ref;

  // 3) fallback: versão do package.json via npm env
  const pkgVersion = String(process.env.npm_package_version || "").trim();
  if (pkgVersion) return pkgVersion;

  // 4) dev fallback
  return mode === "production" ? "unknown" : "dev";
}

export default defineConfig(({ mode }) => {
  // força o Vite a carregar env SEMPRE desta pasta (onde está o vite.config.ts)
  const envDir = __dirname;

  // carrega tudo (prefixo vazio) só para debug no terminal.
  // o que vai para o client continua respeitando envPrefix = ['VITE_']
  const env = loadEnv(mode, envDir, "");

  // garante uma versão de build consistente para o "version gate" no index.html
  const appVersion = resolveAppVersion(mode, env);

  // garante que o Vite enxergue essa env durante o build
  if (!process.env.VITE_APP_VERSION) {
    process.env.VITE_APP_VERSION = appVersion;
  }

  const has = (k: string) => Boolean(env[k] && String(env[k]).trim());

  console.log("[Vite] mode:", mode);
  console.log("[Vite] envDir:", envDir);
  console.log("[Vite] appVersion:", process.env.VITE_APP_VERSION);
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
    // opcional: constante também disponível no TS (caso queira usar no app)
    define: {
      __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || appVersion),
    },
    build: {
      // Reduzir warning limit para forçar bundler a ser mais agressivo
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            // Firebase é a biblioteca MAIS pesada - isolar completamente
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'firebase-vendor';
            }

            // React é essencial mas pode ser separado
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
              return 'react-vendor';
            }

            // services/logic é MUITO pesado (1700+ linhas) - separar em chunk próprio
            if (id.includes('services/logic.ts')) {
              return 'logic-chunk';
            }

            // services de comissão - agrupar com logic
            if (id.includes('services/commissionCampaignOverlay') || id.includes('services/campaignService')) {
              return 'logic-chunk';
            }

            // Componentes financeiros pesados
            if (id.includes('components/FinanceDashboard') || id.includes('components/FinanceManager') || id.includes('components/FinanceReceivables')) {
              return 'finance-chunk';
            }

            // Componentes administrativos pesados
            if (id.includes('components/SettingsHub') || id.includes('components/AdminUsers') || id.includes('components/AdminMessaging')) {
              return 'admin-chunk';
            }

            // Componentes de cliente
            if (id.includes('components/ClientManagementHub') || id.includes('components/SalesList')) {
              return 'client-chunk';
            }
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./vitest.setup.ts",
    },
  };
});
