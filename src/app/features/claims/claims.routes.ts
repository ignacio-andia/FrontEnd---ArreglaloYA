import { Routes } from '@angular/router';

/** Gestión de reclamos, en `/admin/reclamos` (rol ADMINISTRADOR, como toda el área). */
export const ADMIN_CLAIMS_ROUTES: Routes = [
  {
    path: '',
    title: 'Reclamos | ArreglaloYA',
    loadComponent: () =>
      import('./pages/admin-claims-page/admin-claims-page.component').then(
        (m) => m.AdminClaimsPageComponent,
      ),
  },
  {
    path: ':claimId',
    title: 'Detalle del reclamo | ArreglaloYA',
    loadComponent: () =>
      import('./pages/admin-claim-page/admin-claim-page.component').then(
        (m) => m.AdminClaimPageComponent,
      ),
  },
];
