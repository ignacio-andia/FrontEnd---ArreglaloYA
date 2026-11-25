import { Routes } from '@angular/router';

const profilePage = () =>
  import('./pages/public-worker-page/public-worker-page.component').then(
    (m) => m.PublicWorkerPageComponent,
  );

/** «Buscar trabajadores», en `/cliente/buscar-trabajadores` (rol CLIENTE). */
export const WORKER_SEARCH_ROUTES: Routes = [
  {
    path: '',
    title: 'Buscar trabajadores | ArreglaloYA',
    loadComponent: () =>
      import('./pages/worker-search-page/worker-search-page.component').then(
        (m) => m.WorkerSearchPageComponent,
      ),
  },
  {
    path: ':workerId',
    title: 'Perfil del trabajador | ArreglaloYA',
    data: { fromSearch: true },
    loadComponent: profilePage,
  },
];

/** Perfil público para cualquier visitante, en `/trabajadores/:workerId`. */
export const PUBLIC_WORKER_ROUTES: Routes = [
  {
    path: ':workerId',
    title: 'Perfil del trabajador | ArreglaloYA',
    loadComponent: profilePage,
  },
];
