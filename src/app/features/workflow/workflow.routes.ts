import { Routes } from '@angular/router';

/**
 * «Trabajos asignados», en `/trabajador/trabajos` (rol TRABAJADOR). No exige el perfil aprobado:
 * el historial se conserva y el backend decide qué datos entrega.
 */
export const ASSIGNED_JOBS_ROUTES: Routes = [
  {
    path: '',
    title: 'Trabajos asignados | ArreglaloYA',
    loadComponent: () =>
      import('./pages/assigned-jobs-page/assigned-jobs-page.component').then(
        (m) => m.AssignedJobsPageComponent,
      ),
  },
  {
    path: ':orderId',
    title: 'Seguimiento del trabajo | ArreglaloYA',
    loadComponent: () =>
      import('./pages/job-page/job-page.component').then((m) => m.JobPageComponent),
  },
];
