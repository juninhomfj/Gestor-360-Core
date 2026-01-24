import admin from "firebase-admin";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import fs from "node:fs";
import path from "node:path";

const argv = yargs(hideBin(process.argv))
  .option("serviceAccount", {
    type: "string",
    demandOption: true,
    describe:
      "Caminho do JSON da service account (ex: secrets/serviceAccount.json)",
  })
  .option("dryRun", {
    type: "boolean",
    default: true,
    describe: "Se true, não deleta, só mostra o que faria",
  })
  .option("batchSize", {
    type: "number",
    default: 400,
    describe: "Tamanho do lote para logs/controle",
  })
  .option("collections", {
    type: "string",
    default: "commission_basic,commission_natal",
    describe: "Lista de coleções separadas por vírgula",
  })
  .strict().argv;

function initAdmin() {
  if (admin.apps.length) return;

  // Resolve path com segurança (Windows / Linux / Mac)
  const saPath = path.resolve(process.cwd(), argv.serviceAccount);

  if (!fs.existsSync(saPath)) {
    throw new Error(
      `Service account JSON não encontrado em: ${saPath}\n` +
        `Verifique o caminho passado em --serviceAccount=...`,
    );
  }

  const raw = fs.readFileSync(saPath, "utf8");
  const serviceAccount = JSON.parse(raw);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function deleteWhereIsActiveFalse(collectionName) {
  const db = admin.firestore();

  // Query: documentos inativos
  const snap = await db
    .collection(collectionName)
    .where("isActive", "==", false)
    .get();

  console.log(`\n[INFO] Coleção: ${collectionName}`);
  console.log(`[INFO] Encontrados ${snap.size} documentos com isActive=false`);

  if (snap.empty) return { deleted: 0 };

  // Amostra (até 10) para validar
  const sample = snap.docs.slice(0, 10).map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      path: d.ref.path,
      min: data.min,
      max: data.max,
      rate: data.rate,
      version: data.version,
      createdBy: data.createdBy,
    };
  });

  console.log(`[INFO] Amostra (até 10):`);
  console.table(sample);

  if (argv.dryRun) {
    console.log(`[DRY-RUN] Nada foi deletado em ${collectionName}.`);
    return { deleted: 0 };
  }

  // BulkWriter para deleções em massa (mais seguro e resiliente)
  const bw = db.bulkWriter();
  let deleted = 0;

  bw.onWriteError((error) => {
    console.error("[WRITE-ERROR]", {
      path: error.documentRef?.path,
      message: error.message,
      code: error.code,
      failedAttempts: error.failedAttempts,
    });
    // tenta novamente até 5 vezes
    return error.failedAttempts < 5;
  });

  for (const doc of snap.docs) {
    bw.delete(doc.ref);
    deleted++;

    if (deleted % argv.batchSize === 0) {
      console.log(`[INFO] Deletados ${deleted} em ${collectionName}...`);
    }
  }

  await bw.close();
  console.log(`[OK] Deletados ${deleted} documentos em ${collectionName}`);
  return { deleted };
}

async function main() {
  initAdmin();

  const collections = String(argv.collections)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`[START] Coleções alvo: ${collections.join(", ")}`);
  console.log(`[MODE] dryRun=${argv.dryRun}`);

  let total = 0;

  for (const col of collections) {
    const res = await deleteWhereIsActiveFalse(col);
    total += res.deleted;
  }

  console.log(`\n[DONE] Total deletado: ${total}`);
  if (argv.dryRun) {
    console.log(
      `[NEXT] Rode novamente com --dryRun=false para executar de verdade.`,
    );
  }
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
