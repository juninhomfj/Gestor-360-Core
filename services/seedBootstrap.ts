// services/seedBootstrap.ts
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { Logger } from "./logger";

let running = false;

type SeedResult = { ok: string[]; skipped: string[]; failed: Array<{ key: string; error: any }> };

function isPermissionDenied(e: any) {
  const code = e?.code || e?.message || "";
  return String(code).includes("permission-denied");
}

async function safeSet(key: string, ref: any, data: any, merge = true, result?: SeedResult) {
  try {
    await setDoc(ref, data, merge ? { merge: true } : undefined);
    result?.ok.push(key);
  } catch (e) {
    result?.failed.push({ key, error: e });
    Logger.warn(`[Seed] Falhou ao criar "${key}"`, { error: String((e as any)?.message || e) });
  }
}

/**
 * Seed bootstrap: cria docs placeholders inativos para materializar coleções.
 * - Lock fica em users/{uid}.seedBootstrap (compatível com suas rules)
 * - config/* só é criado se o usuário for DEV (suas rules exigem)
 * - Não cria/edita profiles (seu pedido)
 */
export async function runFirestoreSeedBootstrap(): Promise<void> {
  if (running) return;
  running = true;

  const user = auth.currentUser;
  if (!user) {
    running = false;
    return;
  }

  const uid = user.uid;
  const result: SeedResult = { ok: [], skipped: [], failed: [] };

  try {
    // LOCK em users/{uid} -> permitido por rules (o próprio user pode criar/atualizar)
    const userMetaRef = doc(db, "users", uid);
    const userMetaSnap = await getDoc(userMetaRef);

    const alreadyDone = userMetaSnap.exists() && userMetaSnap.data()?.seedBootstrap?.done === true;
    if (alreadyDone) {
      Logger.info("[Seed] Já executado (users/{uid}.seedBootstrap.done=true). Pulando.");
      running = false;
      return;
    }

    // Descobre role (para decidir se pode escrever em config/*)
    let role: string | null = null;
    try {
      const profileSnap = await getDoc(doc(db, "profiles", uid));
      role = profileSnap.exists() ? (profileSnap.data()?.role || null) : null;
    } catch (e) {
      // Se não conseguir ler profile por algum motivo, segue sem config
      Logger.warn("[Seed] Não foi possível ler profiles/{uid} para checar role.", { error: String((e as any)?.message || e) });
    }

    const isDEV = role === "DEV";

    Logger.info("[Seed] Iniciando seed bootstrap...", { uid, role });

    // (A) Config docs - APENAS DEV (suas rules exigem)
    if (isDEV) {
      await safeSet(
        "config/system",
        doc(db, "config", "system"),
        {
          modules: {
            sales: true,
            finance: true,
            receivables: true,
            distribution: true,
            imports: true,
            chat: true,
            logs: true,
            users: true,
          },
          updatedAt: serverTimestamp(),
        },
        true,
        result
      );

      await safeSet(
        "config/ping",
        doc(db, "config", "ping"),
        { ok: true, updatedAt: serverTimestamp() },
        true,
        result
      );

      await safeSet(
        "config/report",
        doc(db, "config", "report"),
        { enabled: true, updatedAt: serverTimestamp() },
        true,
        result
      );
    } else {
      result.skipped.push("config/* (apenas DEV pode escrever por rules)");
      Logger.warn("[Seed] Pulando criação de config/*: rules permitem write somente para DEV.");
    }

    // Base do placeholder (inativo)
    const base = {
      seed: true,
      active: false,
      deleted: true,
      note: "seed placeholder - do not use",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Coleções com userId
    const withUserId = [
      "sales",
      "sales_tasks",
      "clients",
      "campaigns",
      "accounts",
      "cards",
      "categories",
      "transactions",
      "receivables",
      "goals",
      "challenges",
      "challenge_cells",
      "tickets",
    ];

    for (const coll of withUserId) {
      const ref = doc(db, coll, "_seed_placeholder");
      const specific: Record<string, any> = { id: "_seed_placeholder", userId: uid };

      if (coll === "sales") {
        specific.value = 0;
        specific.status = "SEED";
      }
      if (coll === "sales_tasks") {
        specific.title = "SEED";
        specific.done = true;
      }
      if (coll === "clients") {
        specific.name = "SEED";
      }
      if (coll === "campaigns") {
        specific.name = "SEED";
      }
      if (coll === "transactions") {
        specific.value = 0;
        specific.description = "SEED";
        specific.reconciled = true;
        specific.date = serverTimestamp();
      }
      if (coll === "receivables") {
        specific.value = 0;
        specific.status = "PAID";
        specific.dueDate = serverTimestamp();
      }
      if (coll === "tickets") {
        specific.title = "SEED";
        specific.description = "SEED";
        specific.status = "CLOSED";
      }

      await safeSet(`${coll}/_seed_placeholder`, ref, { ...base, ...specific }, true, result);
    }

    // internal_messages (precisa respeitar rules: senderId == uid)
    await safeSet(
      "internal_messages/_seed_placeholder",
      doc(db, "internal_messages", "_seed_placeholder"),
      {
        ...base,
        id: "_seed_placeholder",
        senderId: uid,
        recipientId: uid,
        text: "SEED",
      },
      true,
      result
    );

    // audit_log (suas rules permitem CREATE para qualquer auth)
    await safeSet(
      "audit_log/_seed_placeholder",
      doc(db, "audit_log", "_seed_placeholder"),
      {
        ...base,
        id: "_seed_placeholder",
        userId: uid,
        category: "SEED",
        level: "INFO",
        payload: { seed: true },
      },
      true,
      result
    );

    // Marca lock no users/{uid}
    await safeSet(
      "users/{uid}.seedBootstrap",
      userMetaRef,
      {
        seedBootstrap: {
          done: true,
          seedVersion: "v1",
          createdAt: serverTimestamp(),
          createdBy: uid,
          roleDetected: role || "unknown",
        },
        updatedAt: serverTimestamp(),
      },
      true,
      result
    );

    Logger.info("[Seed] Seed bootstrap concluído.", {
      ok: result.ok.length,
      skipped: result.skipped,
      failed: result.failed.map(f => f.key),
    });
  } catch (e: any) {
    // Nunca crasha a inicialização
    Logger.error("[Seed] Falha geral no seed bootstrap.", { error: String(e?.message || e) });
  } finally {
    running = false;
  }
}
