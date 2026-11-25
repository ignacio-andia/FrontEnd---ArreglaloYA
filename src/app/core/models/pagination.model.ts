/** Metadatos de un listado paginado. `totalPages` es 0 cuando no hay resultados. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Respuesta paginada del backend (`Paginated<T>`): usuarios, bitácora, solicitudes de cambio de
 * zona y perfiles del administrador, pedidos, ofertas y notificaciones. Los demás listados son
 * arreglos simples.
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Parámetros de paginación. Por defecto el backend usa page = 1 y limit = 20.
 * El máximo de `limit` depende del recurso: 100 en usuarios, bitácora y solicitudes; 50 en pedidos.
 */
export interface PageQuery {
  page?: number;
  limit?: number;
}
