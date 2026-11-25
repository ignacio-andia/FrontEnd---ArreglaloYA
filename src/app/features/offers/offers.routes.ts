import { Routes } from '@angular/router';
import { approvedWorkerGuard } from '../../core/guards/approved-worker.guard';

const offersPage = () =>
  import('./pages/offers-page/offers-page.component').then((m) => m.OffersPageComponent);
const offerDetailPage = () =>
  import('./pages/offer-detail-page/offer-detail-page.component').then(
    (m) => m.OfferDetailPageComponent,
  );

/** «Ofertas recibidas», en `/cliente/ofertas` (rol CLIENTE). */
export const RECEIVED_OFFERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Ofertas recibidas | ArreglaloYA',
    data: { party: 'CLIENTE' },
    loadComponent: offersPage,
  },
  {
    path: ':offerId',
    title: 'Oferta recibida | ArreglaloYA',
    data: { party: 'CLIENTE' },
    loadComponent: offerDetailPage,
  },
];

/** «Mis ofertas», en `/trabajador/ofertas` (rol TRABAJADOR, cualquier estado del perfil). */
export const OWN_OFFERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Mis ofertas | ArreglaloYA',
    data: { party: 'TRABAJADOR' },
    loadComponent: offersPage,
  },
  {
    path: ':offerId',
    title: 'Mi oferta | ArreglaloYA',
    data: { party: 'TRABAJADOR' },
    loadComponent: offerDetailPage,
  },
];

/** «Pedidos disponibles», en `/trabajador/pedidos`: exige un perfil aprobado. */
export const AVAILABLE_ORDERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [approvedWorkerGuard],
    children: [
      {
        path: '',
        title: 'Pedidos disponibles | ArreglaloYA',
        loadComponent: () =>
          import('./pages/available-orders-page/available-orders-page.component').then(
            (m) => m.AvailableOrdersPageComponent,
          ),
      },
      {
        path: ':orderId',
        title: 'Pedido disponible | ArreglaloYA',
        loadComponent: () =>
          import('./pages/available-order-page/available-order-page.component').then(
            (m) => m.AvailableOrderPageComponent,
          ),
      },
      {
        path: ':orderId/ofertar',
        title: 'Enviar oferta | ArreglaloYA',
        loadComponent: () =>
          import('./pages/create-offer-page/create-offer-page.component').then(
            (m) => m.CreateOfferPageComponent,
          ),
      },
    ],
  },
];
