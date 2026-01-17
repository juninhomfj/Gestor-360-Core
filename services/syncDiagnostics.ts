import { collection, getDocsFromServer, limit, query, where } from "firebase/firestore";
import { db } from "./firebase";

export interface SyncDiagnosticsResult {
  collection: string;
  ok: boolean;
  count: number;
  ms: number;
  errorMessage?: string;
}

const collectionsToCheck = [
  "sales",
  "clients",
  "transactions",
  "accounts",
  "receivables",
  "goals",
  "cards",
  "categories",
  "sales_tasks"
];

export const runSyncDiagnostics = async (uid: string): Promise<SyncDiagnosticsResult[]> => {
  const results = await Promise.all(
    collectionsToCheck.map(async (collectionName) => {
      const start = performance.now();
      try {
        const q = query(
          collection(db, collectionName),
          where("userId", "==", uid),
          limit(1)
        );
        const snap = await getDocsFromServer(q);
        const ms = Math.round(performance.now() - start);
        return {
          collection: collectionName,
          ok: true,
          count: snap.size,
          ms
        };
      } catch (error: any) {
        const ms = Math.round(performance.now() - start);
        return {
          collection: collectionName,
          ok: false,
          count: 0,
          ms,
          errorMessage: error?.message || "Falha ao consultar coleção."
        };
      }
    })
  );

  return results;
};
