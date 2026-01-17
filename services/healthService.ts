import { doc, getDocFromServer } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Health check simples (Cloud). Usado apenas pela área DEV.
 * Retorna true se conseguir ler o doc config/ping no servidor.
 */
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    await getDocFromServer(doc(db, "config", "ping"));
    return true;
  } catch {
    return false;
  }
};
