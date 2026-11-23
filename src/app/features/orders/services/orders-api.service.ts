import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import {
  CreateOrderRequest,
  DuplicateCheckRequest,
  DuplicateCheckResponse,
  OrderWithWarnings,
} from '../models/order.model';

/**
 * Pedidos del cliente dueño (`/api/orders`, rol CLIENTE). Por ahora solo cubre la publicación:
 * la consulta previa de posibles duplicados y la creación del pedido con sus fotografías.
 */
@Service()
export class OrdersApiService {
  private readonly http = inject(HttpClient);

  /**
   * `POST /orders/duplicate-check` (JSON, 200). Devuelve avisos orientativos
   * (`POSIBLE_DUPLICADO`, `POSIBLE_DATO_PERSONAL`); nunca bloquea la publicación.
   */
  checkDuplicates(request: DuplicateCheckRequest): Observable<DuplicateCheckResponse> {
    const body: DuplicateCheckRequest = {
      categoryId: request.categoryId,
      zoneId: request.zoneId,
      description: request.description,
    };
    return this.http.post<DuplicateCheckResponse>(apiUrl('orders', 'duplicate-check'), body);
  }

  /**
   * `POST /orders` en `multipart/form-data` (201): los campos de `CreateOrderDto` como texto y
   * cada fotografía en un campo `images` repetido (1 a 4). No se fija `Content-Type`: el
   * navegador agrega el `boundary`. 400 datos o fotos inválidas; 404 categoría o zona
   * inexistente; 413 fotografía demasiado grande.
   */
  createOrder(request: CreateOrderRequest): Observable<OrderWithWarnings> {
    const form = new FormData();
    form.append('categoryId', request.categoryId);
    form.append('zoneId', request.zoneId);
    form.append('description', request.description);
    form.append('budgetAmount', request.budgetAmount);
    form.append('addressLine', request.addressLine);
    if (request.addressReference !== undefined) {
      form.append('addressReference', request.addressReference);
    }
    for (const image of request.images) {
      form.append('images', image, image.name);
    }
    return this.http.post<OrderWithWarnings>(apiUrl('orders'), form);
  }
}
