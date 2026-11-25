import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { PaginatedResponse } from '../../../core/models/pagination.model';
import {
  AssignedOrder,
  AvailableOrdersQuery,
  AdminOrder,
  AdminOrdersQuery,
  CancelOrderRequest,
  CreateOrderRequest,
  DuplicateCheckRequest,
  DuplicateCheckResponse,
  OrderImageVariant,
  OrderPhotoSource,
  OrderWithWarnings,
  OwnOrdersQuery,
  OwnerOrder,
  UpdateOrderRequest,
  WorkerOrder,
} from '../models/order.model';

/** Cuerpo multipart de una fotografía; el navegador agrega el `boundary`. */
function imageForm(image: File): FormData {
  const form = new FormData();
  form.append('image', image, image.name);
  return form;
}

/**
 * Pedidos del cliente dueño (`/api/orders` y `/api/orders/me`, rol CLIENTE): publicación (con la
 * consulta previa de posibles duplicados), listado, detalle, edición, cancelación y fotografías
 * privadas. Un pedido ajeno responde 404, igual que uno inexistente. Editar, cambiar fotografías
 * y cancelar exigen estado efectivo PUBLICADO o EN_NEGOCIACION (409 en otro caso).
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

  /** `GET /orders/me`: pedidos propios paginados; solo envía los parámetros indicados. */
  listOwn(query: OwnOrdersQuery = {}): Observable<PaginatedResponse<OwnerOrder>> {
    let params = new HttpParams();
    if (query.status !== undefined) {
      params = params.set('status', query.status);
    }
    if (query.page !== undefined) {
      params = params.set('page', query.page);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', query.limit);
    }
    return this.http.get<PaginatedResponse<OwnerOrder>>(apiUrl('orders', 'me'), { params });
  }

  /** `GET /orders/me/:orderId`: 404 si no existe o no es del cliente; 400 si no es un UUID. */
  getOwn(orderId: string): Observable<OwnerOrder> {
    return this.http.get<OwnerOrder>(apiUrl('orders', 'me', orderId));
  }

  /**
   * `PATCH /orders/me/:orderId` (200): envía solo las propiedades definidas del DTO. Los avisos
   * solo llegan si cambió la descripción o la categoría. 400 datos o categoría inactiva; 404
   * pedido o categoría inexistente; 409 estado.
   */
  update(orderId: string, request: UpdateOrderRequest): Observable<OrderWithWarnings> {
    const body: UpdateOrderRequest = {};
    if (request.categoryId !== undefined) {
      body.categoryId = request.categoryId;
    }
    if (request.description !== undefined) {
      body.description = request.description;
    }
    if (request.budgetAmount !== undefined) {
      body.budgetAmount = request.budgetAmount;
    }
    if (request.addressLine !== undefined) {
      body.addressLine = request.addressLine;
    }
    if (request.addressReference !== undefined) {
      body.addressReference = request.addressReference;
    }
    return this.http.patch<OrderWithWarnings>(apiUrl('orders', 'me', orderId), body);
  }

  /** `POST /orders/me/:orderId/images`, campo `image` (201). 409 si ya tiene 4 fotografías. */
  addImage(orderId: string, image: File): Observable<OwnerOrder> {
    return this.http.post<OwnerOrder>(apiUrl('orders', 'me', orderId, 'images'), imageForm(image));
  }

  /** `PUT /orders/me/:orderId/images/:imageId`, campo `image` (200): ocupa el mismo lugar. */
  replaceImage(orderId: string, imageId: string, image: File): Observable<OwnerOrder> {
    return this.http.put<OwnerOrder>(
      apiUrl('orders', 'me', orderId, 'images', imageId),
      imageForm(image),
    );
  }

  /** `DELETE /orders/me/:orderId/images/:imageId` (200 con el pedido). 409 si es la única. */
  deleteImage(orderId: string, imageId: string): Observable<OwnerOrder> {
    return this.http.delete<OwnerOrder>(apiUrl('orders', 'me', orderId, 'images', imageId));
  }

  /** `GET /orders/admin`: solo administradores; registro mínimo, sin dirección ni fotos. */
  listForAdmin({
    status,
    page,
    limit,
  }: AdminOrdersQuery): Observable<PaginatedResponse<AdminOrder>> {
    let params = new HttpParams();
    if (status !== undefined) {
      params = params.set('status', status);
    }
    if (page !== undefined) {
      params = params.set('page', page);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<PaginatedResponse<AdminOrder>>(apiUrl('orders', 'admin'), { params });
  }

  /** `GET /orders/admin/:orderId`: solo administradores. */
  getForAdmin(orderId: string): Observable<AdminOrder> {
    return this.http.get<AdminOrder>(apiUrl('orders', 'admin', orderId));
  }

  /** `POST /orders/me/:orderId/cancel` (200): devuelve el pedido ya cancelado. 409 estado. */
  cancel(orderId: string, request: CancelOrderRequest = {}): Observable<OwnerOrder> {
    const body: CancelOrderRequest = {};
    if (request.reason !== undefined) {
      body.reason = request.reason;
    }
    return this.http.post<OwnerOrder>(apiUrl('orders', 'me', orderId, 'cancel'), body);
  }

  /** `GET /orders/available` (trabajador aprobado): pedidos que puede ver y ofertar. */
  listAvailable(query: AvailableOrdersQuery = {}): Observable<PaginatedResponse<WorkerOrder>> {
    let params = new HttpParams();
    if (query.categoryId !== undefined) {
      params = params.set('categoryId', query.categoryId);
    }
    if (query.page !== undefined) {
      params = params.set('page', query.page);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', query.limit);
    }
    return this.http.get<PaginatedResponse<WorkerOrder>>(apiUrl('orders', 'available'), {
      params,
    });
  }

  /** `GET /orders/available/:orderId`: 404 si no le corresponde verlo. */
  getAvailable(orderId: string): Observable<WorkerOrder> {
    return this.http.get<WorkerOrder>(apiUrl('orders', 'available', orderId));
  }

  /** `GET /orders/assigned/:orderId`: solo el trabajador asignado con el acuerdo vigente. */
  getAssigned(orderId: string): Observable<AssignedOrder> {
    return this.http.get<AssignedOrder>(apiUrl('orders', 'assigned', orderId));
  }

  /** Fotografía como Blob por la ruta que corresponde a quien la consulta. */
  getImage(
    source: OrderPhotoSource,
    orderId: string,
    imageId: string,
    variant: OrderImageVariant,
  ): Observable<Blob> {
    const owner = source === 'own' ? 'me' : source;
    return this.http.get(apiUrl('orders', owner, orderId, 'images', imageId), {
      params: { variant },
      responseType: 'blob',
    });
  }

  /**
   * `GET /orders/me/:orderId/images/:imageId?variant=` como Blob (`image/webp`). Es privada:
   * `<img src>` no enviaría el token Bearer, por eso se descarga con HttpClient.
   */
  getOwnImage(orderId: string, imageId: string, variant: OrderImageVariant): Observable<Blob> {
    return this.getImage('own', orderId, imageId, variant);
  }
}
