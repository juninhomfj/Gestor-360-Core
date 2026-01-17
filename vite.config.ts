/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { UserConfig } from 'vite';
import type { InlineConfig } from 'vitest';

interface VitestConfigExport extends UserConfig {
  test: InlineConfig;
}

export default defineConfig({
  // ESSENCIAL para previews que não rodam na raiz do domínio
  base: "./",
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
} as VitestConfigExport);