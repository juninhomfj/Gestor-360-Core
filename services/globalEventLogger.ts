/**
 * ETAPA 3: Global Event Logger
 * Captura automaticamente TODAS as ações do usuário
 * - Navegação de telas
 * - Cliques em botões
 * - Submits
 * - Erros
 * - Requests abortadas
 * 
 * Funciona de forma silenciosa e resiliente
 */

import { Logger } from './logger';

type EventAction = 'NAVIGATION' | 'CLICK' | 'SUBMIT' | 'ERROR' | 'ABORT' | 'CUSTOM';

interface LoggedEvent {
  action: EventAction;
  screen?: string;
  element?: string;
  errorMessage?: string;
  details?: Record<string, any>;
}

class GlobalEventLogger {
  private initialized = false;
  private eventBuffer: LoggedEvent[] = [];
  private bufferMaxSize = 500;
  private flushInterval: number | null = null;
  private isFlushing = false;

  /**
   * Inicializa o logger global
   * DEVE ser chamado antes do bootstrap (ETAPA 3)
   */
  initialize(): void {
    if (this.initialized) return;

    try {
      this.initialized = true;
      
      // Captura navegação
      this.setupNavigationTracking();
      
      // Captura cliques
      this.setupClickTracking();
      
      // Captura submits
      this.setupFormTracking();
      
      // Captura erros globais
      this.setupErrorTracking();
      
      // Captura AbortErrors
      this.setupAbortTracking();
      
      // Flush periódico (a cada 30s)
      this.startPeriodicFlush();
      
      Logger.info('[GlobalEventLogger] Inicializado com sucesso');
    } catch (error) {
      console.error('[GlobalEventLogger] Falha ao inicializar:', error);
    }
  }

  /**
   * Registra navegação de telas/rotas
   */
  private setupNavigationTracking(): void {
    if (typeof window === 'undefined') return;

    // Monitoring de mudanças de tab/route
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args: any[]) {
      const result = originalPushState.apply(this, args);
      const pathname = args[2] as string;
      
      try {
        const screen = new URL(pathname, window.location.origin).pathname;
        globalEventLogger.logEvent({
          action: 'NAVIGATION',
          screen,
          details: { type: 'pushState' }
        });
      } catch {}
      
      return result;
    };

    window.history.replaceState = function (...args: any[]) {
      const result = originalReplaceState.apply(this, args);
      const pathname = args[2] as string;
      
      try {
        const screen = new URL(pathname, window.location.origin).pathname;
        globalEventLogger.logEvent({
          action: 'NAVIGATION',
          screen,
          details: { type: 'replaceState' }
        });
      } catch {}
      
      return result;
    };

    // Monitoring de mudanças de tab (usando storage events)
    window.addEventListener('storage', (e) => {
      if (e.key === 'sys_last_tab') {
        globalEventLogger.logEvent({
          action: 'NAVIGATION',
          details: { tab: e.newValue, type: 'tabChange' }
        });
      }
    });
  }

  /**
   * Captura cliques em elementos interativos
   */
  private setupClickTracking(): void {
    if (typeof window === 'undefined') return;

    document.addEventListener('click', (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement;
        
        // Ignora cliques em elementos muito genéricos
        if (!target || target.tagName === 'HTML' || target.tagName === 'BODY') return;
        
        // Captura apenas botões, links, inputs, selects
        const isInteractive = 
          target.tagName === 'BUTTON' ||
          target.tagName === 'A' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.onclick ||
          target.closest('button') ||
          target.closest('a') ||
          target.className?.includes('clickable');

        if (!isInteractive) return;

        const element = target.id || target.className || target.tagName;
        const elementText = (target.textContent || '').substring(0, 100).trim();
        
        this.logEvent({
          action: 'CLICK',
          element,
          details: {
            text: elementText,
            type: target.tagName,
            classList: target.className?.substring(0, 200)
          }
        });
      } catch {}
    }, true);
  }

  /**
   * Captura submits de formulários
   */
  private setupFormTracking(): void {
    if (typeof window === 'undefined') return;

    document.addEventListener('submit', (e: SubmitEvent) => {
      try {
        const form = e.target as HTMLFormElement;
        const formId = form.id || form.name || 'anonymous-form';
        const formAction = form.action || 'no-action';

        this.logEvent({
          action: 'SUBMIT',
          element: formId,
          details: {
            action: formAction,
            method: form.method || 'POST',
            fieldCount: form.elements.length
          }
        });
      } catch {}
    }, true);
  }

  /**
   * Captura erros globais
   */
  private setupErrorTracking(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event: ErrorEvent) => {
      try {
        this.logEvent({
          action: 'ERROR',
          errorMessage: event.message,
          details: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack?.substring(0, 500)
          }
        });
      } catch {}
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      try {
        const reason = event.reason;
        const errorMessage = reason?.message || String(reason);

        this.logEvent({
          action: 'ERROR',
          errorMessage: `UnhandledRejection: ${errorMessage}`,
          details: {
            reason: String(reason).substring(0, 500)
          }
        });
      } catch {}
    });
  }

  /**
   * Captura AbortErrors (ETAPA 3 - importante para reduzir AbortErrors)
   */
  private setupAbortTracking(): void {
    if (typeof window === 'undefined') return;

    // Hook em fetch para capturar AbortErrors
    const originalFetch = window.fetch;
    window.fetch = function (...args: any[]) {
      const urlOrRequest = args[0];
      const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest?.url;

      return originalFetch.apply(this, args).catch((error: any) => {
        if (error?.name === 'AbortError') {
          globalEventLogger.logEvent({
            action: 'ABORT',
            details: {
              url: url?.substring(0, 200),
              errorName: error.name,
              errorMessage: error.message
            }
          });
        }
        throw error;
      });
    } as any;
  }

  /**
   * Registra um evento manualmente
   */
  logEvent(event: LoggedEvent): void {
    try {
      this.eventBuffer.push({
        ...event,
        details: {
          ...event.details,
          timestamp: Date.now(),
          screen: event.screen || localStorage.getItem('sys_last_tab') || 'unknown'
        }
      });

      // Se buffer atingiu limite, faz flush
      if (this.eventBuffer.length >= this.bufferMaxSize) {
        this.flush();
      }
    } catch (error) {
      console.error('[GlobalEventLogger] Erro ao registrar evento:', error);
    }
  }

  /**
   * Flush periódico em background
   */
  private startPeriodicFlush(): void {
    if (this.flushInterval !== null) return;

    this.flushInterval = window.setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.flush();
      }
    }, 30000); // A cada 30 segundos
  }

  /**
   * Envia eventos ao Logger em background (sem bloquear)
   */
  private flush(): void {
    if (this.isFlushing || this.eventBuffer.length === 0) return;

    this.isFlushing = true;
    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    // Executa em background via microtask
    Promise.resolve().then(async () => {
      try {
        for (const event of eventsToFlush) {
          try {
            Logger.info(`[Event] ${event.action}`, event.details);
          } catch {}
        }
      } finally {
        this.isFlushing = false;
      }
    });
  }

  /**
   * Obtém buffer atual (para debugging)
   */
  getBuffer(): LoggedEvent[] {
    return [...this.eventBuffer];
  }

  /**
   * Limpa buffer (para testes)
   */
  clearBuffer(): void {
    this.eventBuffer = [];
  }

  /**
   * Destruir logger (limpeza)
   */
  destroy(): void {
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.eventBuffer = [];
    this.initialized = false;
  }
}

// Singleton exportado
export const globalEventLogger = new GlobalEventLogger();

// Export para debugging (DEV only)
if ((import.meta as any).env?.DEV) {
  (window as any).__globalEventLogger = globalEventLogger;
}
