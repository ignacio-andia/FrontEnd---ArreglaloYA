import { ORDER_AGREED_STATUSES, OrderStatus } from '../../orders/models/order.model';

/**
 * Estados con el acuerdo vigente para el backend: solo en ellos entrega al asignado los datos
 * del pedido (#80) y el contacto. `CERRADO` y `CANCELADO` conservan flujo e historial.
 */
export const SERVICE_AGREEMENT_STATUSES: readonly OrderStatus[] = [
  ...ORDER_AGREED_STATUSES,
  'TERMINADO',
  'EN_RECLAMO',
];

export type AdditionalBudgetStatus =
  'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'SIN_EFECTO_POR_CANCELACION';

export const BUDGET_STATUS_LABELS: Readonly<Record<AdditionalBudgetStatus, string>> = {
  PENDIENTE: 'Pendiente de respuesta',
  ACEPTADO: 'Aceptado',
  RECHAZADO: 'Rechazado',
  SIN_EFECTO_POR_CANCELACION: 'Sin efecto por la cancelación',
};

export interface Visit {
  orderId: string;
  performedAt: string;
  visitCost: string | null;
}

export interface AdditionalBudget {
  id: string;
  orderId: string;
  amount: string;
  reason: string;
  materials: string;
  status: AdditionalBudgetStatus;
  respondedAt: string | null;
  createdAt: string;
}

export interface Execution {
  orderId: string;
  startedAt: string | null;
  finishedAt: string | null;
  conformityDeadline: string | null;
  conformedAt: string | null;
}

export interface NoShowReport {
  id: string;
  orderId: string;
  description: string | null;
  reportedAt: string;
}

/** `GET /orders/:orderId/workflow` (`WorkflowView`), para el cliente dueño o el asignado. */
export interface Workflow {
  orderId: string;
  status: OrderStatus;
  visit: Visit | null;
  additionalBudgets: AdditionalBudget[];
  execution: Execution | null;
  noShowReport: NoShowReport | null;
}
