import { Routes } from '@angular/router';

/**
 * «Quiero ofrecer mis servicios», montada en `/cliente/ofrecer-servicios` (ClientLayout).
 * Solo exige el rol CLIENTE del área: no hace falta el rol TRABAJADOR para crear el perfil.
 */
export const BECOME_WORKER_ROUTES: Routes = [
  {
    path: '',
    title: 'Ofrecer mis servicios | ArreglaloYA',
    loadComponent: () =>
      import('./pages/become-worker-page/become-worker-page.component').then(
        (m) => m.BecomeWorkerPageComponent,
      ),
  },
];

/**
 * «Mi perfil», montada en `/trabajador/perfil` (WorkerLayout). Exige el rol TRABAJADOR del área,
 * pero no un perfil aprobado: aquí se consulta precisamente el estado del perfil.
 */
export const WORKER_PROFILE_ROUTES: Routes = [
  {
    path: '',
    title: 'Mi perfil de trabajador | ArreglaloYA',
    loadComponent: () =>
      import('./pages/my-worker-profile-page/my-worker-profile-page.component').then(
        (m) => m.MyWorkerProfilePageComponent,
      ),
  },
];
