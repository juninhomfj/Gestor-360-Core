import { SalesTaskType } from '../types';

export const SALES_TASK_LABELS: Record<SalesTaskType, string> = {
  ENVIAR_BOLETO: 'Enviar boleto',
  COBRAR: 'Cobrar',
  AVISAR_ENTREGA: 'Avisar entrega'
};

export const SALES_TASK_OPTIONS = Object.entries(SALES_TASK_LABELS).map(([value, label]) => ({
  value: value as SalesTaskType,
  label
}));
