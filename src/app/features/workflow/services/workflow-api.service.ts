import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { Workflow } from '../models/workflow.model';

/** Ciclo del trabajo (`/api/orders/:orderId`). Un pedido ajeno responde 404. */
@Service()
export class WorkflowApiService {
  private readonly http = inject(HttpClient);

  /** `GET /orders/:orderId/workflow`: cliente dueño o trabajador asignado, en cualquier estado. */
  get(orderId: string): Observable<Workflow> {
    return this.http.get<Workflow>(apiUrl('orders', orderId, 'workflow'));
  }
}
