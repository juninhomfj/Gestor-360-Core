
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { logger } from "./logger";

const log = logger.child({ module: "seedBootstrap" });

/**
 * Creates placeholder documents in Firestore to materialize collections
 * on the first run for a new project.
 *
 * This should only run ONCE per project, controlled by a lock document in Firestore.
 * It's designed to be a "fire-and-forget" operation that does not block the UI
 * and will not crash the app if it fails.
 */
export async function runFirestoreSeedBootstrap(): Promise<void> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    log.warn("runFirestoreSeedBootstrap called without an authenticated user. Skipping.");
    return;
  }

  const { uid } = user;
  const lockRef = doc(db, "config/seed_lock");

  try {
    const lockSnap = await getDoc(lockRef);

    if (lockSnap.exists() && lockSnap.data()?.done === true) {
      log.info("Firestore seed bootstrap has already been run. Skipping.");
      return;
    }

    log.info("Running Firestore seed bootstrap for the first time...");

    // 1. Create config documents
    await setDoc(doc(db, "config/system"), {
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
    }, { merge: true });

    await setDoc(doc(db, "config/ping"), {
      ok: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    await setDoc(doc(db, "config/report"), {
        enabled: true,
        updatedAt: serverTimestamp(),
    }, { merge: true });

    // 2. Create placeholder documents
    const collectionsWithUserId = [
      "sales", "sales_tasks", "clients", "campaigns", "accounts", "cards",
      "categories", "transactions", "receivables", "goals", "challenges",
      "challenge_cells", "tickets"
    ];

    const placeholderBase = {
      seed: true,
      active: false,
      deleted: true,
      note: "seed placeholder - do not use",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    for (const coll of collectionsWithUserId) {
        const placeholderDocRef = doc(db, `${coll}/_seed_placeholder`);
        const specificData: { [key: string]: any } = {};

        // Add collection-specific fields to avoid breaking rules
        if (coll === 'sales') {
            specificData.value = 0;
            specificData.status = "SEED";
        }
        if (coll === 'sales_tasks') {
            specificData.title = "SEED";
            specificData.done = true;
        }
        if (coll === 'clients') {
            specificData.name = "SEED";
        }
        if (coll === 'campaigns') {
            specificData.name = "SEED";
        }
        if (coll === 'tickets') {
            specificData.title = "SEED";
            specificData.description = "SEED";
            specificData.status = "CLOSED";
        }

        await setDoc(placeholderDocRef, {
            id: "_seed_placeholder",
            userId: uid,
            ...placeholderBase,
            ...specificData,
        }, { merge: true });
    }

    // Special placeholders
    await setDoc(doc(db, "internal_messages/_seed_placeholder"), {
      id: "_seed_placeholder",
      senderId: uid,
      recipientId: uid,
      text: "SEED",
      ...placeholderBase,
    }, { merge: true });

    await setDoc(doc(db, "audit_log/_seed_placeholder"), {
      id: "_seed_placeholder",
      userId: uid,
      category: "SEED",
      level: "INFO",
      payload: { seed: true },
      ...placeholderBase,
    }, { merge: true });

    // 3. Set the lock
    await setDoc(lockRef, {
      done: true,
      seedVersion: "v1",
      createdAt: serverTimestamp(),
      createdBy: uid,
    });

    log.info("Firestore seed bootstrap completed successfully.");

  } catch (error) {
    log.error("An error occurred during Firestore seed bootstrap.", error);
    // We intentionally don't re-throw so we don't crash the app startup.
  }
}
