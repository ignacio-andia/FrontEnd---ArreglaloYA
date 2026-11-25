import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { VisitPaymentConfirmation, VisitRegistration, Workflow } from '../models/workflow.model';

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
}
