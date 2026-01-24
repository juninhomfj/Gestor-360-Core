/**
 * Firebase Lazy Loader
 * 
 * Este serviço implementa carregamento sob-demanda do Firebase SDK.
 * Firebase é essencial para a aplicação, mas pode ser carregado APENAS QUANDO
 * a funcionalidade específica é necessária.
 * 
 * Benefícios:
 * - Reduz bundle inicial (Firebase é 476KB gzip)
 * - Carrega Firebase apenas para o módulo/tela em uso
 * - Implementação transparente para o resto da aplicação
 */

import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';

let firebaseInstance: {
  db: Firestore | null;
  auth: Auth | null;
} = {
  db: null,
  auth: null,
};

let firebaseLoadingPromise: Promise<void> | null = null;

/**
 * Carrega Firebase SDK sob-demanda
 * Garante que é carregado apenas UMA VEZ
 */
export async function ensureFirebaseLoaded(): Promise<void> {
  // Se já está carregado, retorna imediatamente
  if (firebaseInstance.db && firebaseInstance.auth) {
    return;
  }

  // Se já está carregando, aguarda a promise existente
  if (firebaseLoadingPromise) {
    return firebaseLoadingPromise;
  }

  // Caso contrário, inicia o carregamento
  firebaseLoadingPromise = (async () => {
    try {
      // Dynamic import de Firebase - isso permite que Vite/Rollup saiba
      // que Firebase é needed only quando esta função é chamada
      const { db, auth } = await import('./firebase');
      firebaseInstance.db = db;
      firebaseInstance.auth = auth;
    } catch (error) {
      console.error('[FirebaseLazy] Erro ao carregar Firebase:', error);
      firebaseLoadingPromise = null;
      throw error;
    }
  })();

  return firebaseLoadingPromise;
}

/**
 * Retorna instância do Firestore
 * Carrega Firebase se não estiver carregado
 */
export async function getFirestore(): Promise<Firestore> {
  await ensureFirebaseLoaded();
  if (!firebaseInstance.db) {
    throw new Error('[FirebaseLazy] Firestore não foi inicializado');
  }
  return firebaseInstance.db;
}

/**
 * Retorna instância do Firebase Auth
 * Carrega Firebase se não estiver carregado
 */
export async function getAuth(): Promise<Auth> {
  await ensureFirebaseLoaded();
  if (!firebaseInstance.auth) {
    throw new Error('[FirebaseLazy] Auth não foi inicializado');
  }
  return firebaseInstance.auth;
}

/**
 * Verifica se Firebase está carregado
 */
export function isFirebaseLoaded(): boolean {
  return !!(firebaseInstance.db && firebaseInstance.auth);
}
