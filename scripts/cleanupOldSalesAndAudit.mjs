#!/usr/bin/env node
/**
 * cleanupOldSalesAndAudit.mjs
 *
 * Uso (exemplos):
 *  # DRY RUN: apagar vendas soft-deletadas até uma data (createdAt string ISO)
 *  node scripts/cleanupOldSalesAndAudit.mjs \
 *    --serviceAccount=secrets/serviceAccount.json \
 *    --mode=sales \
 *    --salesCollection=sales \
 *    --cutoffIso=2026-01-01T00:00:00.000Z \
 *    --dryRun=true
 *
 *  # EXECUÇÃO REAL:
 *  node scripts/cleanupOldSalesAndAudit.mjs \
 *    --serviceAccount=secrets/serviceAccount.json \
 *    --mode=sales \
 *    --salesCollection=sales \
 *    --cutoffIso=2026-01-01T00:00:00.000Z
 *
 *  # Limpar audit_log > 60 dias (dry run)
 *  node scripts/cleanupOldSalesAndAudit.mjs \
 *    --serviceAccount=secrets/serviceAccount.json \
 *    --mode=audit \
 *    --auditCollection=audit_log \
 *    --olderThanDays=60 \
 *    --dryRun=true
 */

import fs from "fs";
import path from "path";
import process from "process";
import admin from "firebase-admin";

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    if (!a.startsWith("--")) continue;
    const [k, vRaw] = a.slice(2).split("=");
    const v = vRaw === undefined ? true : vRaw;
    args[k] = v;
  }
  return args;
}

function toBool(v, def = false) {
  if (v === undefined) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

function must(args, key) {
  const v = args[key];
  if (!v) {
    console.error(`[FATAL] Parâmetro obrigatório ausente: --${key}=...`);
    process.exit(1);
  }
  return v;
}

function initAdmin(serviceAccountPath) {
  const abs = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(process.cwd(), serviceAccountPath);

  if (!fs.existsSync(abs)) {
    console.error(`[FATAL] serviceAccount não encontrado em: ${abs}`);
    process.exit(1);
  }

  const json = JSON.parse(fs.readFileSync(abs, "utf-8"));
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(json),
    });
  }
  return admin.firestore();
}

async function batchedDelete(docs, dryRun) {
  if (docs.length === 0) return 0;
  const db = admin.firestore();
  const chunks = [];
  for (let i = 0; i < docs.length; i += 450) chunks.push(docs.slice(i, i + 450));

  let total = 0;
  for (const chunk of chunks) {
    if (dryRun) {
      total += chunk.length;
      continue;
    }
    const batch = db.batch();
    for (const d of chunk) batch.delete(d.ref);
    await batch.commit();
    total += chunk.length;
  }
  return total;
}

async function cleanupSales(db, opts) {
  const salesCollection = opts.salesCollection;
  const cutoffIso = opts.cutoffIso;
  const dryRun = opts.dryRun;
  const userId = opts.userId || null;
  const limit = opts.limit ?? 5000;

  // Validação simples do ISO (não trava, mas evita erro óbvio)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(cutoffIso)) {
    console.error(`[FATAL] cutoffIso inválido. Use ISO: 2026-01-01T00:00:00.000Z`);
    process.exit(1);
  }

  console.log(`[INFO] Mode=sales | collection=${salesCollection} | cutoffIso=${cutoffIso} | userId=${userId ?? "(any)"} | dryRun=${dryRun}`);

  // OBS: createdAt no seu doc é string ISO. Comparação lexicográfica funciona para ISO completo.
  let q = db.collection(salesCollection)
    .where("deleted", "==", true)
    .where("createdAt", "<=", cutoffIso)
    .orderBy("createdAt", "asc")
    .limit(500);

  // Se você quiser restringir por userId, faz sentido aqui.
  // Porém: Firestore exige índice composto para (deleted + createdAt + userId) dependendo da ordem.
  // Para ser “cirúrgico”, só aplicamos se você passar --userId e se a query funcionar.
  if (userId) {
    q = db.collection(salesCollection)
      .where("deleted", "==", true)
      .where("userId", "==", userId)
      .where("createdAt", "<=", cutoffIso)
      .orderBy("createdAt", "asc")
      .limit(500);
  }

  let scanned = 0;
  let deletedCount = 0;
  let loops = 0;

  while (true) {
    loops += 1;
    const snap = await q.get();
    if (snap.empty) break;

    scanned += snap.size;

    // Guarda refs
    const docs = snap.docs;

    // Dry-run: só imprime amostra
    if (dryRun && loops === 1) {
      console.log(`[DRY] Amostra (até 5 docs):`);
      docs.slice(0, 5).forEach((d) => {
        const data = d.data();
        console.log(` - docId=${d.id} createdAt=${data.createdAt} client=${String(data.client ?? "").slice(0, 60)}`);
      });
    }

    const n = await batchedDelete(docs, dryRun);
    deletedCount += n;

    console.log(`[INFO] page=${loops} scanned+=${snap.size} deleted+=${n} totalDeleted=${deletedCount}`);

    if (deletedCount >= limit) {
      console.log(`[INFO] Parando por limite --limit=${limit}`);
      break;
    }

    // Paginação: recomeça após o último createdAt
    const last = docs[docs.length - 1].get("createdAt");
    if (!last) break;

    if (userId) {
      q = db.collection(salesCollection)
        .where("deleted", "==", true)
        .where("userId", "==", userId)
        .where("createdAt", "<=", cutoffIso)
        .orderBy("createdAt", "asc")
        .startAfter(last)
        .limit(500);
    } else {
      q = db.collection(salesCollection)
        .where("deleted", "==", true)
        .where("createdAt", "<=", cutoffIso)
        .orderBy("createdAt", "asc")
        .startAfter(last)
        .limit(500);
    }
  }

  console.log(`[DONE] Sales cleanup завершено. scanned=${scanned} deleted=${deletedCount} dryRun=${dryRun}`);
}

async function cleanupAudit(db, opts) {
  const auditCollection = opts.auditCollection;
  const olderThanDays = Number(opts.olderThanDays ?? 60);
  const dryRun = opts.dryRun;
  const limit = opts.limit ?? 20000;

  if (!Number.isFinite(olderThanDays) || olderThanDays <= 0) {
    console.error(`[FATAL] olderThanDays inválido. Ex: --olderThanDays=60`);
    process.exit(1);
  }

  const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  console.log(`[INFO] Mode=audit | collection=${auditCollection} | olderThanDays=${olderThanDays} | cutoffMs=${cutoffMs} | dryRun=${dryRun}`);

  // Campo "timestamp" é number (ms). Isso é o ideal para limpeza.
  let q = db.collection(auditCollection)
    .where("timestamp", "<", cutoffMs)
    .orderBy("timestamp", "asc")
    .limit(500);

  let scanned = 0;
  let deletedCount = 0;
  let loops = 0;

  while (true) {
    loops += 1;
    const snap = await q.get();
    if (snap.empty) break;

    scanned += snap.size;

    const docs = snap.docs;

    if (dryRun && loops === 1) {
      console.log(`[DRY] Amostra (até 5 docs):`);
      docs.slice(0, 5).forEach((d) => {
        const data = d.data();
        console.log(` - docId=${d.id} level=${data.level} ts=${data.timestamp} msg=${String(data.message ?? "").slice(0, 80)}`);
      });
    }

    const n = await batchedDelete(docs, dryRun);
    deletedCount += n;

    console.log(`[INFO] page=${loops} scanned+=${snap.size} deleted+=${n} totalDeleted=${deletedCount}`);

    if (deletedCount >= limit) {
      console.log(`[INFO] Parando por limite --limit=${limit}`);
      break;
    }

    const lastTs = docs[docs.length - 1].get("timestamp");
    if (typeof lastTs !== "number") break;

    q = db.collection(auditCollection)
      .where("timestamp", "<", cutoffMs)
      .orderBy("timestamp", "asc")
      .startAfter(lastTs)
      .limit(500);
  }

  console.log(`[DONE] Audit cleanup завершено. scanned=${scanned} deleted=${deletedCount} dryRun=${dryRun}`);
}

async function main() {
  const args = parseArgs(process.argv);

  const serviceAccount = must(args, "serviceAccount");
  const mode = String(must(args, "mode")).toLowerCase();
  const dryRun = toBool(args.dryRun, false);
  const limit = args.limit ? Number(args.limit) : undefined;

  const db = initAdmin(serviceAccount);

  if (mode === "sales") {
    const salesCollection = args.salesCollection || "sales";
    const cutoffIso = must(args, "cutoffIso");
    const userId = args.userId ? String(args.userId) : null;

    await cleanupSales(db, { salesCollection, cutoffIso, dryRun, userId, limit });
    return;
  }

  if (mode === "audit") {
    const auditCollection = args.auditCollection || "audit_log";
    const olderThanDays = args.olderThanDays ?? 60;

    await cleanupAudit(db, { auditCollection, olderThanDays, dryRun, limit });
    return;
  }

  console.error(`[FATAL] mode inválido: ${mode}. Use --mode=sales ou --mode=audit`);
  process.exit(1);
}

main().catch((err) => {
  console.error("[FATAL] Erro inesperado:", err);
  process.exit(1);
});
