import { Routes } from '@angular/router';

/** Verificación de trabajadores, en `/admin/trabajadores` (rol ADMINISTRADOR). */
export const WORKER_VERIFICATION_ROUTES: Routes = [
  {
    path: '',
    title: 'Verificación de trabajadores | ArreglaloYA',
    loadComponent: () =>
      import('./pages/admin-workers-page/admin-workers-page.component').then(
        (m) => m.AdminWorkersPageComponent,
      ),
  },
  {
    path: ':profileId',
    title: 'Perfil del trabajador | ArreglaloYA',
    loadComponent: () =>
      import('./pages/admin-worker-page/admin-worker-page.component').then(
        (m) => m.AdminWorkerPageComponent,
      ),
  },
];
