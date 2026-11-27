import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { CancellationSummary } from '../models/cancellation-summary.model';
import {
  DeclarationResult,
  DeclarePaymentRequest,
  PaymentConcept,
  PaymentsOverview,
  Receipts,
} from '../models/payment.model';

/**
 * Pagos y constancias de un pedido. La plataforma no procesa dinero: solo registra las
 * declaraciones de las partes. Un pedido ajeno responde 404.
 */
@Service()
export class PaymentsApiService {
  private readonly http = inject(HttpClient);

  /** `GET /orders/:orderId/payments`. */
  getOverview(orderId: string): Observable<PaymentsOverview> {
    return this.http.get<PaymentsOverview>(apiUrl('orders', orderId, 'payments'));
  }

  /**
   * `GET /orders/:orderId/cancellation-summary`: partes y administrador. 404 si no hay resumen o
   * no hay acceso; 409 si el pedido no está cancelado.
   */
  getCancellationSummary(orderId: string): Observable<CancellationSummary> {
    return this.http.get<CancellationSummary>(apiUrl('orders', orderId, 'cancellation-summary'));
  }

  /** `GET /orders/:orderId/receipts`. */
  getReceipts(orderId: string): Observable<Receipts> {
    return this.http.get<Receipts>(apiUrl('orders', orderId, 'receipts'));
  }

  /**
   * `POST /orders/:orderId/payments/:concept/declarations` (201). La parte sale de la sesión,
   * nunca del cuerpo.
   */
  declare(
    orderId: string,
    concept: PaymentConcept,
    request: DeclarePaymentRequest,
  ): Observable<DeclarationResult> {
    return this.http.post<DeclarationResult>(
      apiUrl('orders', orderId, 'payments', concept, 'declarations'),
      { amount: request.amount, method: request.method },
    );
  }
}
