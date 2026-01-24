/**
 * ETAPA 1: Bootstrap Lock Service
 * Garante que o bootstrap execute UMA ÚNICA VEZ por sessão
 * Sem reexecuções causadas por re-render, StrictMode ou mudança de estado
 */

import { Logger } from './logger';

interface BootstrapLockState {
  isInitialized: boolean;
  isRunning: boolean;
  sessionId: string;
  startTime: number;
  error: Error | null;
  attemptCount: number;
}

class BootstrapLockService {
  private state: BootstrapLockState = {
    isInitialized: false,
    isRunning: false,
    sessionId: this.generateSessionId(),
    startTime: 0,
    error: null,
    attemptCount: 0
  };

  private bootstrapPromise: Promise<void> | null = null;
  private inProgressListeners: Set<() => void> = new Set();

  /**
   * Gera um ID único de sessão (por abas/fenestras)
   */
  private generateSessionId(): string {
    const existingId = sessionStorage.getItem('__bootstrap_session_id');
    if (existingId) return existingId;
    const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem('__bootstrap_session_id', newId);
    return newId;
  }

  /**
   * Inicia bootstrap com trava de segurança
   * Retorna promise que resolve quando bootstrap terminar (sucesso ou erro)
   */
  async runBootstrap(bootstrapFn: () => Promise<void>): Promise<void> {
    // Se já inicializado com sucesso, retorna imediatamente
    if (this.state.isInitialized && !this.state.error) {
      Logger.info('[BootstrapLock] Já inicializado. Retornando.', {
        sessionId: this.state.sessionId,
        attemptCount: this.state.attemptCount
      });
      return;
    }

    // Se está rodando, aguarda a promise anterior
    if (this.state.isRunning && this.bootstrapPromise) {
      Logger.warn('[BootstrapLock] Bootstrap já em progresso. Aguardando conclusão.', {
        sessionId: this.state.sessionId,
        attemptCount: this.state.attemptCount,
        elapsedMs: Date.now() - this.state.startTime
      });
      return this.bootstrapPromise;
    }

    // Incrementa tentativa e marca como em execução
    this.state.attemptCount++;
    this.state.isRunning = true;
    this.state.startTime = Date.now();
    this.state.error = null;

    Logger.info('[BootstrapLock] Iniciando bootstrap', {
      sessionId: this.state.sessionId,
      attempt: this.state.attemptCount
    });

    // Cria promise que será compartilhada
    this.bootstrapPromise = (async () => {
      try {
        // Executa bootstrap
        await bootstrapFn();

        // Marca como inicializado com sucesso
        this.state.isInitialized = true;
        this.state.isRunning = false;

        Logger.info('[BootstrapLock] Bootstrap concluído com sucesso', {
          sessionId: this.state.sessionId,
          attemptCount: this.state.attemptCount,
          durationMs: Date.now() - this.state.startTime
        });
      } catch (error) {
        this.state.isRunning = false;
        this.state.error = error instanceof Error ? error : new Error(String(error));

        Logger.error('[BootstrapLock] Bootstrap falhou', {
          sessionId: this.state.sessionId,
          attemptCount: this.state.attemptCount,
          durationMs: Date.now() - this.state.startTime,
          errorMessage: this.state.error.message
        });

        throw error;
      } finally {
        // Notifica listeners de conclusão
        this.inProgressListeners.forEach(listener => listener());
        this.inProgressListeners.clear();
        this.bootstrapPromise = null;
      }
    })();

    return this.bootstrapPromise;
  }

  /**
   * Verifica se bootstrap já foi inicializado
   */
  isReady(): boolean {
    return this.state.isInitialized && !this.state.error;
  }

  /**
   * Verifica se bootstrap está em progresso
   */
  isInProgress(): boolean {
    return this.state.isRunning;
  }

  /**
   * Retorna o erro de bootstrap, se houver
   */
  getError(): Error | null {
    return this.state.error;
  }

  /**
   * Registra callback para quando bootstrap terminar
   */
  onBootstrapComplete(callback: () => void): () => void {
    if (this.state.isInitialized || this.state.error) {
      // Já finalizou, executa callback imediatamente
      callback();
      return () => {};
    }

    this.inProgressListeners.add(callback);
    return () => this.inProgressListeners.delete(callback);
  }

  /**
   * Força reset do bootstrap (para testes ou reinicialização)
   * NÃO use em produção sem motivo claro
   */
  forceReset(): void {
    Logger.warn('[BootstrapLock] FORÇANDO RESET DE BOOTSTRAP', {
      sessionId: this.state.sessionId,
      wasInitialized: this.state.isInitialized
    });
    this.state = {
      isInitialized: false,
      isRunning: false,
      sessionId: this.generateSessionId(),
      startTime: 0,
      error: null,
      attemptCount: 0
    };
    this.bootstrapPromise = null;
    this.inProgressListeners.clear();
  }

  /**
   * Obtém diagnóstico do estado
   */
  getDiagnostics(): object {
    return {
      isInitialized: this.state.isInitialized,
      isRunning: this.state.isRunning,
      sessionId: this.state.sessionId,
      attemptCount: this.state.attemptCount,
      totalDurationMs: this.state.startTime > 0 ? Date.now() - this.state.startTime : 0,
      hasError: this.state.error !== null,
      errorMessage: this.state.error?.message || null
    };
  }
}

// Singleton exportado
export const bootstrapLock = new BootstrapLockService();

// Export para debugging (DEV only)
if ((import.meta as any).env?.DEV) {
  (window as any).__bootstrapLock = bootstrapLock;
}
