/**
 * Hook: usePrefetchFirebase
 * 
 * Permite que componentes peçam para precarregar Firebase em background
 * Útil para rotas/módulos que sabem que vão precisar de Firebase em breve
 * 
 * Exemplo:
 * ```
 * const FinanceComponent = () => {
 *   usePrefetchFirebase(); // Inicia carregamento de Firebase em background
 *   // ... resto do componente
 * };
 * ```
 */

import { useEffect } from 'react';
import { ensureFirebaseLoaded } from '../services/firebaseLazy';
import { Logger } from '../services/logger';

/**
 * Hook que precarrega Firebase quando o componente monta
 * Não bloqueia renderização - carrega em background
 */
export function usePrefetchFirebase(): void {
  useEffect(() => {
    // Iniciar carregamento em background, sem await
    ensureFirebaseLoaded()
      .then(() => {
        Logger.debug('[usePrefetchFirebase] Firebase prefetch completed', { label: 'performance' });
      })
      .catch((error) => {
        Logger.warn('[usePrefetchFirebase] Firebase prefetch failed', { 
          error: error instanceof Error ? error.message : String(error),
          label: 'performance' 
        });
      });
  }, []); // Executar apenas uma vez quando o componente monta
}

/**
 * Hook que precarrega Firebase sob certas condições
 * 
 * Exemplo:
 * ```
 * const shouldLoad = user?.permissions?.finance;
 * usePrefetchFirebaseWhen(shouldLoad);
 * ```
 */
export function usePrefetchFirebaseWhen(condition: boolean): void {
  useEffect(() => {
    if (!condition) return;

    ensureFirebaseLoaded()
      .then(() => {
        Logger.debug('[usePrefetchFirebaseWhen] Firebase prefetch completed', { label: 'performance' });
      })
      .catch((error) => {
        Logger.warn('[usePrefetchFirebaseWhen] Firebase prefetch failed', { 
          error: error instanceof Error ? error.message : String(error),
          label: 'performance' 
        });
      });
  }, [condition]);
}
