import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { Claim, CreateClaimRequest } from '../models/claim.model';

/** Reclamos de un pedido. Un pedido ajeno responde 404. */
@Service()
export class ClaimsApiService {
  private readonly http = inject(HttpClient);

  /**
   * `POST /orders/:orderId/claims` (201): cliente dueño. Se envía como `multipart/form-data`; el
   * navegador fija el `Content-Type` con su separador.
   */
  create(orderId: string, request: CreateClaimRequest): Observable<Claim> {
    const form = new FormData();
    form.append('description', request.description);
    for (const image of request.images) {
      form.append('images', image, image.name);
    }
    return this.http.post<Claim>(apiUrl('orders', orderId, 'claims'), form);
  }
}
