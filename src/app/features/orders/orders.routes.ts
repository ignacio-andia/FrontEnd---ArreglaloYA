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
 * (`?estado=&pagina=`), detalle y edición de un pedido propio.
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
    path: ':orderId/editar',
    title: 'Editar pedido | ArreglaloYA',
    loadComponent: () =>
      import('./pages/edit-order-page/edit-order-page.component').then(
        (m) => m.EditOrderPageComponent,
      ),
  },
  {
    path: ':orderId/seguimiento',
    title: 'Seguimiento del servicio | ArreglaloYA',
    loadComponent: () =>
      import('../workflow/pages/tracking-page/tracking-page.component').then(
        (m) => m.TrackingPageComponent,
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

/** Supervisión de pedidos, en `/admin/pedidos` (rol ADMINISTRADOR). Solo lectura. */
export const ADMIN_ORDERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Pedidos | ArreglaloYA',
    loadComponent: () =>
      import('./pages/admin-orders-page/admin-orders-page.component').then(
        (m) => m.AdminOrdersPageComponent,
      ),
  },
  {
    path: ':orderId',
    title: 'Pedido | ArreglaloYA',
    loadComponent: () =>
      import('./pages/admin-order-page/admin-order-page.component').then(
        (m) => m.AdminOrderPageComponent,
      ),
  },
];
