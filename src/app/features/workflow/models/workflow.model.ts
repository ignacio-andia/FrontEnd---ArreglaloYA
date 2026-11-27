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

/** Respuesta de `POST /orders/:orderId/visit`. */
export interface VisitRegistration {
  status: OrderStatus;
  visit: Visit;
}

/** Respuesta de `POST /orders/:orderId/visit/payment-confirmation`. */
export interface VisitPaymentConfirmation {
  visit: Visit;
}

/** Respuesta de iniciar, terminar o confirmar la conformidad. */
export interface ExecutionResult {
  status: OrderStatus;
  execution: Execution;
}

/** Límite de `CancelWorkDto`. */

/** Estados en los que el backend admite «Cancelar trabajo»: acordado y sin terminar. */
export const CANCELLABLE_WORK_STATUSES: readonly OrderStatus[] = ORDER_AGREED_STATUSES;

/** Límite de `ReportNoShowDto`. */
export const NO_SHOW_DESCRIPTION_MAX_LENGTH = 1000;

/** Estados en los que el backend admite reportar que el trabajador no llegó. */
export const NO_SHOW_STATUSES: readonly OrderStatus[] = ['ACORDADO', 'ANTICIPO_REGISTRADO'];

/** Respuesta de `POST /orders/:orderId/no-show`; `created: false` si ya había un reporte. */
export interface NoShowResult {
  created: boolean;
  report: NoShowReport;
}

/** Límites de `CreateAdditionalBudgetDto` y `RejectAdditionalBudgetDto`. */
export const BUDGET_TEXT_MAX_LENGTH = 1000;
export const BUDGET_REJECT_REASON_MAX_LENGTH = 400;

/** Estados en los que el backend admite proponer un adicional. */
export const BUDGET_ORIGIN_STATUSES: readonly OrderStatus[] = ['VISITA_REALIZADA', 'EN_EJECUCION'];

/** Cuerpo de `POST /orders/:orderId/additional-budgets`. */
export interface ProposeBudgetRequest {
  amount: string;
  reason: string;
  materials: string;
}

/** Respuesta de proponer, aceptar o rechazar un adicional. */
export interface BudgetResult {
  status: OrderStatus;
  budget: AdditionalBudget;
}

/** La visita tiene un cobro: `null` y `"0.00"` son visitas sin costo. */
export function hasVisitCost(cost: string | null): cost is string {
  return cost !== null && Number(cost) > 0;
}

/**
 * Si el trabajador que mira puede usar las acciones de un trabajo acordado, según la
 * elegibilidad que responde el backend. El backend vuelve a decidir en cada acción.
 */
export type WorkerClearance =
  | { state: 'checking' }
  | { state: 'approved' }
  | { state: 'denied'; message: string }
  | { state: 'unavailable'; message: string };

/** Respuestas a una acción que indican que lo mostrado puede estar desactualizado. */
export const STALE_ACTION_STATUSES: readonly number[] = [403, 404, 409];

/** `GET /orders/:orderId/workflow` (`WorkflowView`), para el cliente dueño o el asignado. */
export interface Workflow {
  orderId: string;
  status: OrderStatus;
  visit: Visit | null;
  additionalBudgets: AdditionalBudget[];
  execution: Execution | null;
  noShowReport: NoShowReport | null;
}
