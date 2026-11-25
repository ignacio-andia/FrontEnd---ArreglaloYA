import { Params } from '@angular/router';

/** Parámetros de la URL de «Mis pedidos»: el filtro y la página sobreviven a recargas y al volver. */
export const STATUS_PARAM = 'estado';
export const PAGE_PARAM = 'pagina';

/** Estado de navegación con el que el detalle vuelve al mismo filtro y la misma página. */
export interface OrdersListNavigationState {
  ordersListQuery: Params;
}

/** Lee de un estado de navegación solo los parámetros conocidos del listado. */
export function ordersListQueryFrom(state: unknown): Params {
  if (typeof state !== 'object' || state === null || !('ordersListQuery' in state)) {
    return {};
  }
  const query: unknown = (state as Partial<OrdersListNavigationState>).ordersListQuery;
  if (typeof query !== 'object' || query === null) {
    return {};
  }
  const result: Params = {};
  for (const key of [STATUS_PARAM, PAGE_PARAM]) {
    const value: unknown = (query as Params)[key];
    if (typeof value === 'string' || typeof value === 'number') {
      result[key] = value;
    }
  }
  return result;
}
