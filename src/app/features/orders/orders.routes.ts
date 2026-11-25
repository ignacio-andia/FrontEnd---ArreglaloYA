import { Routes } from '@angular/router';

/** «Publicar pedido», montada en `/cliente/publicar-pedido` (ClientLayout, rol CLIENTE). */
export const PUBLISH_ORDER_ROUTES: Routes = [
  {
    path: '',
    title: 'Publicar pedido | ArreglaloYA',
    loadComponent: () =>
      import('./pages/publish-order-page/publish-order-page.component').then(
        (m) => m.PublishOrderPageComponent,
      ),
  },
];

/**
 * «Mis pedidos», montada en `/cliente/mis-pedidos` (ClientLayout, rol CLIENTE): listado
 * (`?estado=&pagina=`) y detalle de un pedido propio.
 */
export const MY_ORDERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Mis pedidos | ArreglaloYA',
    loadComponent: () =>
      import('./pages/my-orders-page/my-orders-page.component').then(
        (m) => m.MyOrdersPageComponent,
      ),
  },
  {
    path: ':orderId',
    title: 'Detalle del pedido | ArreglaloYA',
    loadComponent: () =>
      import('./pages/order-detail-page/order-detail-page.component').then(
        (m) => m.OrderDetailPageComponent,
      ),
  },
];
