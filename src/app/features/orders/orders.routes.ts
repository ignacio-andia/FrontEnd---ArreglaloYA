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
