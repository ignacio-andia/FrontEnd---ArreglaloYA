import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { OwnerOrder } from '../../orders/models/order.model';
import {
  BudgetResult,
  ExecutionResult,
  NoShowResult,
  ProposeBudgetRequest,
  VisitPaymentConfirmation,
  VisitRegistration,
  Workflow,
} from '../models/workflow.model';

/** Ciclo del trabajo (`/api/orders/:orderId`). Un pedido ajeno responde 404. */
@Service()
export class WorkflowApiService {
  private readonly http = inject(HttpClient);

  /** `GET /orders/:orderId/workflow`: cliente dueño o trabajador asignado, en cualquier estado. */
  get(orderId: string): Observable<Workflow> {
    return this.http.get<Workflow>(apiUrl('orders', orderId, 'workflow'));
  }

  /** `POST /orders/:orderId/visit` (201), sin cuerpo: trabajador aprobado y asignado. */
  registerVisit(orderId: string): Observable<VisitRegistration> {
    return this.http.post<VisitRegistration>(apiUrl('orders', orderId, 'visit'), null);
  }

  /**
   * `POST /orders/:orderId/visit/payment-confirmation`, sin cuerpo: el monto lo fija el
   * backend. Es idempotente y no cambia el estado del pedido.
   */
  confirmVisitPayment(orderId: string): Observable<VisitPaymentConfirmation> {
    return this.http.post<VisitPaymentConfirmation>(
      apiUrl('orders', orderId, 'visit', 'payment-confirmation'),
      null,
    );
  }

  /** `POST /orders/:orderId/start`, sin cuerpo: trabajador aprobado y asignado. */
  startWork(orderId: string): Observable<ExecutionResult> {
    return this.http.post<ExecutionResult>(apiUrl('orders', orderId, 'start'), null);
  }

  /** `POST /orders/:orderId/finish`, sin cuerpo: el backend fija el plazo de conformidad. */
  finishWork(orderId: string): Observable<ExecutionResult> {
    return this.http.post<ExecutionResult>(apiUrl('orders', orderId, 'finish'), null);
  }

  /** `POST /orders/:orderId/confirm-conformity`, sin cuerpo: cliente dueño; cierra el pedido. */
  confirmConformity(orderId: string): Observable<ExecutionResult> {
    return this.http.post<ExecutionResult>(apiUrl('orders', orderId, 'confirm-conformity'), null);
  }

  /** `POST /orders/:orderId/cancel-work`: cliente dueño. Devuelve el pedido cancelado. */
  cancelWork(orderId: string, reason: string): Observable<OwnerOrder> {
    return this.http.post<OwnerOrder>(apiUrl('orders', orderId, 'cancel-work'), { reason });
  }

  /** `POST /orders/:orderId/no-show`: cliente dueño; la descripción es opcional. */
  reportNoShow(orderId: string, description: string): Observable<NoShowResult> {
    return this.http.post<NoShowResult>(
      apiUrl('orders', orderId, 'no-show'),
      description === '' ? {} : { description },
    );
  }

  /** `POST /orders/:orderId/additional-budgets` (201): trabajador aprobado y asignado. */
  proposeBudget(orderId: string, request: ProposeBudgetRequest): Observable<BudgetResult> {
    const { amount, reason, materials } = request;
    return this.http.post<BudgetResult>(apiUrl('orders', orderId, 'additional-budgets'), {
      amount,
      reason,
      materials,
    });
  }

  /** `POST …/additional-budgets/:budgetId/accept`, sin cuerpo: cliente dueño. */
  acceptBudget(orderId: string, budgetId: string): Observable<BudgetResult> {
    return this.http.post<BudgetResult>(
      apiUrl('orders', orderId, 'additional-budgets', budgetId, 'accept'),
      null,
    );
  }

  /** `POST …/additional-budgets/:budgetId/reject`: cierra el pedido. El motivo es opcional. */
  rejectBudget(orderId: string, budgetId: string, reason: string): Observable<BudgetResult> {
    return this.http.post<BudgetResult>(
      apiUrl('orders', orderId, 'additional-budgets', budgetId, 'reject'),
      reason === '' ? {} : { reason },
    );
  }
}
