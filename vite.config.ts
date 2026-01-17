import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // ESSENCIAL para previews que não rodam na raiz do domínio
  base: "./",
  plugins: [react()],
});