/**
 * aiGuardrails.ts
 * Implementa guardrails (restrições e validações) para ações de IA
 * Etapa 8: Proteção contra acesso irrestrito + audit log
 */

import { Logger } from './logger';
import { createTicket } from './tickets';
import { getSession } from './auth';
import { User } from '../types';

// === ALLOWLIST DE COLLECTIONS PERMITIDAS ===
const ALLOWED_COLLECTIONS = {
  transactions: {
    allowed: true,
    writableFields: ['amount', 'type', 'description', 'date', 'category', 'status']
  },
  receivables: {
    allowed: true,
    writableFields: ['amount', 'dueDate', 'status', 'description', 'date']
  },
  // Bloqueado: commissions, profiles, users, config, system
};

const BLOCKED_COLLECTIONS = ['commissions', 'profiles', 'users', 'config', 'system', 'audit_logs'];

// === TIPOS E INTERFACES ===
export interface AIAction {
  id: string;
  type: 'READ' | 'WRITE' | 'CALCULATE' | 'SUGGEST';
  collection: string;
  operation: string;
  proposedChanges?: Record<string, any>;
  timestamp: string;
  userId: string;
  userName: string;
  requiresApproval: boolean;
}

export interface AIAuditLog {
  id: string;
  action: AIAction;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  executedAt?: string;
  result: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED';
  reason?: string;
  timestamp: string;
}

// === VALIDADORES ===

/**
 * Valida se a coleção é permitida para escrita
 */
export const validateCollectionAllowed = (collection: string): { allowed: boolean; reason?: string } => {
  if (BLOCKED_COLLECTIONS.includes(collection)) {
    return {
      allowed: false,
      reason: `Coleção '${collection}' está na lista de bloqueio de IA. Acesso irrestrito negado.`
    };
  }

  const config = (ALLOWED_COLLECTIONS as any)[collection];
  if (!config || !config.allowed) {
    return {
      allowed: false,
      reason: `Coleção '${collection}' não está na allowlist de IA.`
    };
  }

  return { allowed: true };
};

/**
 * Valida se os campos propostos são permitidos para a coleção
 */
export const validateFieldsAllowed = (
  collection: string,
  fields: Record<string, any>
): { valid: boolean; invalidFields?: string[] } => {
  const config = (ALLOWED_COLLECTIONS as any)[collection];
  if (!config) {
    return { valid: false, invalidFields: Object.keys(fields) };
  }

  const invalidFields = Object.keys(fields).filter(field => !config.writableFields.includes(field));

  if (invalidFields.length > 0) {
    return { valid: false, invalidFields };
  }

  return { valid: true };
};

/**
 * Valida o tipo e valores dos campos
 */
export const validateFieldTypes = (
  collection: string,
  fields: Record<string, any>
): { valid: boolean; errors?: string[] } => {
  const errors: string[] = [];

  Object.entries(fields).forEach(([key, value]) => {
    // Validações simples por tipo
    if (key.includes('amount') && typeof value !== 'number') {
      errors.push(`Campo '${key}' deve ser número (tipo: ${typeof value})`);
    }
    if (key.includes('date') && !(value instanceof Date || typeof value === 'string')) {
      errors.push(`Campo '${key}' deve ser data válida`);
    }
    if (key.includes('status') && typeof value !== 'string') {
      errors.push(`Campo '${key}' deve ser string`);
    }
  });

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
};

// === CRIAÇÃO DE AÇÃO ===

/**
 * Cria uma ação de IA para validação/aprovação
 */
export const createAIAction = async (
  type: 'READ' | 'WRITE' | 'CALCULATE' | 'SUGGEST',
  collection: string,
  operation: string,
  proposedChanges?: Record<string, any>
): Promise<AIAction | { error: string }> => {
  const session = getSession();
  if (!session) {
    return { error: 'Usuário não autenticado' };
  }

  // Validação de coleção
  const collectionCheck = validateCollectionAllowed(collection);
  if (!collectionCheck.allowed) {
    Logger.warn('IA Guardrails: Acesso negado', {
      collection,
      reason: collectionCheck.reason,
      userId: session.id
    });
    return { error: collectionCheck.reason };
  }

  // Validação de campos (se WRITE)
  if (type === 'WRITE' && proposedChanges) {
    const fieldsCheck = validateFieldsAllowed(collection, proposedChanges);
    if (!fieldsCheck.valid) {
      Logger.warn('IA Guardrails: Campos bloqueados', {
        collection,
        invalidFields: fieldsCheck.invalidFields,
        userId: session.id
      });
      return {
        error: `Campos não permitidos para '${collection}': ${fieldsCheck.invalidFields?.join(', ')}`
      };
    }

    const typeCheck = validateFieldTypes(collection, proposedChanges);
    if (!typeCheck.valid) {
      Logger.warn('IA Guardrails: Erro de validação de tipo', {
        collection,
        errors: typeCheck.errors,
        userId: session.id
      });
      return { error: `Erros de validação: ${typeCheck.errors?.join('; ')}` };
    }
  }

  // Criar ação
  const action: AIAction = {
    id: crypto.randomUUID(),
    type,
    collection,
    operation,
    proposedChanges,
    timestamp: new Date().toISOString(),
    userId: session.id,
    userName: session.name,
    requiresApproval: type === 'WRITE' // Escritas sempre requerem aprovação
  };

  Logger.info('IA Guardrails: Ação criada', {
    actionId: action.id,
    type,
    collection,
    operation,
    userId: session.id
  });

  return action;
};

// === APROVAÇÃO ===

/**
 * Aprova uma ação de IA após revisão do usuário
 * Registra no audit log
 */
export const approveAIAction = async (
  action: AIAction,
  approverUser: User
): Promise<{ approved: boolean; reason?: string }> => {
  // Revalidar antes de aprovar
  const collectionCheck = validateCollectionAllowed(action.collection);
  if (!collectionCheck.allowed) {
    Logger.warn('IA Guardrails: Ação rejeitada na aprovação', {
      actionId: action.id,
      reason: 'Coleção não mais permitida',
      approver: approverUser.id
    });
    return { approved: false, reason: 'Coleção não está mais permitida' };
  }

  if (action.proposedChanges) {
    const fieldsCheck = validateFieldsAllowed(action.collection, action.proposedChanges);
    if (!fieldsCheck.valid) {
      Logger.warn('IA Guardrails: Ação rejeitada - campos inválidos', {
        actionId: action.id,
        invalidFields: fieldsCheck.invalidFields,
        approver: approverUser.id
      });
      return { approved: false, reason: `Campos não permitidos: ${fieldsCheck.invalidFields?.join(', ')}` };
    }
  }

  // Registrar no audit log
  const auditLog: AIAuditLog = {
    id: crypto.randomUUID(),
    action,
    approved: true,
    approvedBy: approverUser.id,
    approvedAt: new Date().toISOString(),
    result: 'APPROVED',
    timestamp: new Date().toISOString()
  };

  Logger.info('IA Guardrails: Ação aprovada', {
    actionId: action.id,
    auditLogId: auditLog.id,
    approver: approverUser.id
  });

  // TODO: Persistir auditLog em collection 'ai_audit_logs' ou 'audit_logs'

  return { approved: true };
};

/**
 * Rejeita uma ação de IA
 */
export const rejectAIAction = async (
  action: AIAction,
  rejectorUser: User,
  reason: string
): Promise<{ rejected: boolean }> => {
  const auditLog: AIAuditLog = {
    id: crypto.randomUUID(),
    action,
    approved: false,
    approvedBy: rejectorUser.id,
    approvedAt: new Date().toISOString(),
    result: 'REJECTED',
    reason,
    timestamp: new Date().toISOString()
  };

  Logger.info('IA Guardrails: Ação rejeitada', {
    actionId: action.id,
    auditLogId: auditLog.id,
    rejector: rejectorUser.id,
    reason
  });

  // TODO: Persistir auditLog

  return { rejected: true };
};

/**
 * Registra a execução de uma ação aprovada
 */
export const logAIActionExecution = async (
  action: AIAction,
  executorUser: User,
  result: 'EXECUTED' | 'FAILED',
  error?: string
): Promise<void> => {
  const auditLog: AIAuditLog = {
    id: crypto.randomUUID(),
    action,
    approved: true,
    executedAt: new Date().toISOString(),
    result,
    reason: error,
    timestamp: new Date().toISOString()
  };

  if (result === 'FAILED') {
    Logger.error('IA Guardrails: Execução falhou', {
      actionId: action.id,
      auditLogId: auditLog.id,
      error
    });
  } else {
    Logger.info('IA Guardrails: Ação executada', {
      actionId: action.id,
      auditLogId: auditLog.id,
      collection: action.collection,
      operation: action.operation
    });
  }

  // TODO: Persistir auditLog
};

/**
 * Cria um ticket de auditoria se algo suspeito for detectado
 */
export const createAuditTicketIfNeeded = async (
  action: AIAction,
  severity: 'LOW' | 'MEDIUM' | 'HIGH',
  reason: string,
  createdBy: User
): Promise<void> => {
  if (severity === 'HIGH') {
    // Criar ticket de segurança
    try {
      await createTicket({
        title: `[SEGURANÇA] Atividade suspeita de IA: ${action.collection}`,
        description: `Ação bloqueada/rejeitada:\n\n${reason}\n\nCollection: ${action.collection}\nOperation: ${action.operation}\nUsuário: ${action.userName}\nTimestamp: ${action.timestamp}`,
        module: 'dev',
        priority: 'HIGH',
        createdBy,
        route: '/admin',
        screen: 'AdminAudit',
        action: 'IA_security_alert',
        collectionPath: `ai_audit_logs/${action.id}`
      });

      Logger.warn('IA Guardrails: Ticket de segurança criado', {
        actionId: action.id,
        severity,
        reason
      });
    } catch (e) {
      Logger.error('IA Guardrails: Erro ao criar ticket de segurança', e);
    }
  }
};
