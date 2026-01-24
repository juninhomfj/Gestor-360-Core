/**
 * aiExecutor.ts
 * Executor seguro para ações de IA
 * Usa guardrails para garantir segurança e reversibilidade
 */

import { 
  AIAction, 
  createAIAction, 
  approveAIAction, 
  rejectAIAction,
  logAIActionExecution,
  createAuditTicketIfNeeded
} from './aiGuardrails';
import { User } from '../types';
import { Logger } from './logger';
import { dbPut } from '../storage/db';

/**
 * Executor seguro para operações de IA
 * Sempre requer aprovação explícita do usuário antes de executar
 */
export class SafeAIExecutor {
  /**
   * Propõe uma ação de escrita para aprovação
   */
  static async proposeWrite(
    collection: string,
    operation: string,
    proposedChanges: Record<string, any>,
    createdBy: User
  ): Promise<{ actionId: string; requiresApproval: boolean } | { error: string }> {
    const action = await createAIAction('WRITE', collection, operation, proposedChanges);

    if ('error' in action) {
      await createAuditTicketIfNeeded(
        {
          id: crypto.randomUUID(),
          type: 'WRITE',
          collection,
          operation,
          timestamp: new Date().toISOString(),
          userId: createdBy.id,
          userName: createdBy.name,
          requiresApproval: true
        },
        'HIGH',
        action.error,
        createdBy
      );
      return action;
    }

    Logger.info('SafeAIExecutor: Ação proposta (aguardando aprovação)', {
      actionId: action.id,
      collection,
      operation,
      proposedBy: createdBy.id
    });

    return {
      actionId: action.id,
      requiresApproval: action.requiresApproval
    };
  }

  /**
   * Aprova e executa uma ação proposta
   * Sempre registra no audit log
   */
  static async executeApproved(
    action: AIAction,
    approver: User
  ): Promise<{ success: boolean; error?: string }> {
    // Validar aprovação
    const approvalResult = await approveAIAction(action, approver);
    if (!approvalResult.approved) {
      await rejectAIAction(action, approver, approvalResult.reason || 'Validação falhou');
      return {
        success: false,
        error: approvalResult.reason
      };
    }

    try {
      // Executar a ação (exemplo: escrita em transactions ou receivables)
      if (action.collection === 'transactions' || action.collection === 'receivables') {
        if (action.proposedChanges) {
          const docId = `ai_${action.id}`;
          await dbPut(action.collection as any, {
            id: docId,
            ...action.proposedChanges,
            createdBy: action.userId,
            createdByAI: true,
            aiActionId: action.id,
            createdAt: new Date().toISOString()
          } as any);
        }
      }

      // Registrar execução bem-sucedida
      await logAIActionExecution(action, approver, 'EXECUTED');

      Logger.info('SafeAIExecutor: Ação executada com sucesso', {
        actionId: action.id,
        collection: action.collection,
        executedBy: approver.id
      });

      return { success: true };
    } catch (error: any) {
      // Registrar falha
      await logAIActionExecution(action, approver, 'FAILED', error?.message);

      // Criar ticket se erro crítico
      await createAuditTicketIfNeeded(
        action,
        'HIGH',
        `Erro ao executar ação: ${error?.message}`,
        approver
      );

      Logger.error('SafeAIExecutor: Erro ao executar ação', {
        actionId: action.id,
        error: error?.message
      });

      return {
        success: false,
        error: error?.message
      };
    }
  }

  /**
   * Rejeita uma ação proposta
   */
  static async reject(
    action: AIAction,
    rejector: User,
    reason: string
  ): Promise<{ rejected: boolean }> {
    const result = await rejectAIAction(action, rejector, reason);

    Logger.info('SafeAIExecutor: Ação rejeitada', {
      actionId: action.id,
      rejectionReason: reason,
      rejectedBy: rejector.id
    });

    return result;
  }
}

/**
 * Exemplo de uso:
 *
 * // 1. IA propõe uma ação
 * const proposal = await SafeAIExecutor.proposeWrite(
 *   'receivables',
 *   'create_suggested_payment',
 *   {
 *     amount: 1500.00,
 *     dueDate: '2026-02-15',
 *     description: 'Pagamento sugerido pela IA'
 *   },
 *   aiUser
 * );
 *
 * if ('error' in proposal) {
 *   console.error('Ação bloqueada:', proposal.error);
 *   return;
 * }
 *
 * // 2. Usuário humano revisa e aprova
 * const execution = await SafeAIExecutor.executeApproved(action, currentUser);
 *
 * if (!execution.success) {
 *   console.error('Execução falhou:', execution.error);
 * } else {
 *   console.log('Ação executada com sucesso');
 * }
 */
