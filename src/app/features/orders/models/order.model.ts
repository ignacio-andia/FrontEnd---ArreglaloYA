import { CatalogRef } from '../../catalogs/models/catalog.model';

/** Estados del pedido: literales exactos del enum `OrderStatus` del backend (04-enums-and-states). */
export const ORDER_STATUSES = [
  'PUBLICADO',
  'EN_NEGOCIACION',
  'ACORDADO',
  'ANTICIPO_REGISTRADO',
  'VISITA_REALIZADA',
  'PRESUPUESTO_ADICIONAL_PENDIENTE',
  'EN_EJECUCION',
  'TERMINADO',
  'EN_RECLAMO',
  'CERRADO',
  'SIN_ACUERDO',
  'VENCIDO',
  'CANCELADO',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Texto visible de cada estado. Solo traduce el literal. */
export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  PUBLICADO: 'Publicado',
  EN_NEGOCIACION: 'En negociación',
  ACORDADO: 'Acordado',
  ANTICIPO_REGISTRADO: 'Anticipo registrado',
  VISITA_REALIZADA: 'Visita realizada',
  PRESUPUESTO_ADICIONAL_PENDIENTE: 'Presupuesto adicional pendiente',
  EN_EJECUCION: 'En ejecución',
  TERMINADO: 'Terminado',
  EN_RECLAMO: 'En reclamo',
  CERRADO: 'Cerrado',
  SIN_ACUERDO: 'Sin acuerdo',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
};

/** Variante de una fotografía: `full` (hasta 1600 px de lado) o `thumb` (miniatura). */
export type OrderImageVariant = 'full' | 'thumb';

/**
 * Consulta de `GET /orders/me` (`ListOwnOrdersQueryDto`). `status` filtra por estado efectivo;
 * por defecto `page = 1` y `limit = 20` (máximo 50). El orden es por creación, descendente.
 */
export interface OwnOrdersQuery {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

/** Fotografía de un pedido (`OrderImageView`). Siempre WebP; los bytes se piden aparte. */
export interface OrderImage {
  id: string;
  position: number;
  width: number;
  height: number;
  sizeBytes: number;
  thumbnailSizeBytes: number;
}

/**
 * Datos comunes del pedido (`WorkerOrderView`). `status` es el estado efectivo, `budgetAmount`
 * llega con 2 decimales (`"150.50"`) y las fechas son ISO 8601 en UTC.
 */
export interface WorkerOrder {
  id: string;
  status: OrderStatus;
  category: CatalogRef;
  zone: CatalogRef;
  description: string;
  budgetAmount: string;
  images: OrderImage[];
  revision: number;
  publishedAt: string;
  expiresAt: string;
  lastEditedAt: string | null;
}

/** Dirección exacta: dato privado que solo ve el dueño (y el trabajador asignado). */
export interface OrderAddress {
  addressLine: string;
  reference: string | null;
}

/**
 * Pedido visto por su cliente dueño (`OwnerOrderView`): lo devuelven el listado, el detalle, la
 * creación y la edición. `canEdit` y `canCancel` los calcula el backend. Un pedido vencido o
 * cancelado sin acuerdo llega limpio (`anonymizedAt`): sin fotos, sin dirección y con una
 * descripción fija.
 */
export interface OwnerOrder extends WorkerOrder {
  address: OrderAddress | null;
  cancelledAt: string | null;
  anonymizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canCancel: boolean;
}

/** Aviso orientativo del backend (`OrderWarning`): nunca bloquea la publicación. */
export type OrderWarning =
  | { code: 'POSIBLE_DUPLICADO'; message: string; orderIds: string[] }
  | { code: 'POSIBLE_DATO_PERSONAL'; message: string };

/** Respuesta de `POST /orders` (`OrderWithWarnings`). */
export interface OrderWithWarnings {
  order: OwnerOrder;
  warnings: OrderWarning[];
}

/** Respuesta de `POST /orders/duplicate-check` (`DuplicateCheckResponse`). */
export interface DuplicateCheckResponse {
  warnings: OrderWarning[];
}

/** Cuerpo JSON de `POST /orders/duplicate-check` (`DuplicateCheckDto`). */
export interface DuplicateCheckRequest {
  categoryId: string;
  zoneId: string;
  description: string;
}

/**
 * Datos para `POST /orders` (`CreateOrderDto` más el campo de archivos `images`), que se envían
 * como `multipart/form-data`. `budgetAmount` es texto decimal con punto (`"150.50"`);
 * `addressReference` se omite si está vacía.
 */
export interface CreateOrderRequest {
  categoryId: string;
  zoneId: string;
  description: string;
  budgetAmount: string;
  addressLine: string;
  addressReference?: string;
  images: readonly File[];
}
