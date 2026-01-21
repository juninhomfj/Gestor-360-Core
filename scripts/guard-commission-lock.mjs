import { readFile } from "fs/promises";
import { createHash } from "crypto";

const lockPath = new URL("../commission.lock", import.meta.url);
const targetPath = new URL("../services/logic.ts", import.meta.url);

const hashFile = async (url) => {
  const content = await readFile(url, "utf8");
  const normalized = content.replace(/\r\n/g, "\n");
  return createHash("sha256").update(normalized).digest("hex");
};

try {
  const expected = (await readFile(lockPath, "utf8")).trim();
  const actual = await hashFile(targetPath);

  if (!expected) {
    console.error("Commission engine is locked; do not modify");
    console.error("[commission-lock] Missing expected hash in commission.lock");
    process.exit(1);
  }

  if (actual !== expected) {
    console.error("Commission engine is locked; do not modify");
    console.error(`[commission-lock] expected=${expected} actual=${actual}`);
    process.exit(1);
  }

  console.log("[commission-lock] OK");
} catch (err) {
  console.error("Commission engine is locked; do not modify");
  console.error("[commission-lock] Failed to validate lock file.", err);
  process.exit(1);
}
