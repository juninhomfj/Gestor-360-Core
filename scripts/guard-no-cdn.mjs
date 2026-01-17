import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const indexPath = resolve(process.cwd(), "index.html");
const html = readFileSync(indexPath, "utf-8");

const forbiddenSnippets = [
  "importmap",
  "esm.sh",
  "unpkg",
  "skypack",
  "cdn",
  "https://"
];

const matches = forbiddenSnippets.filter((snippet) => html.includes(snippet));

if (matches.length > 0) {
  console.error(
    `[guard-no-cdn] build bloqueado: index.html contém padrões proibidos (${matches.join(
      ", "
    )}). Remova CDN/importmap antes de continuar.`
  );
  process.exit(1);
}

console.log("[guard-no-cdn] OK: nenhum CDN/importmap encontrado em index.html.");
