import { Routes } from '@angular/router';

/** Bitácora, en `/admin/bitacora` (rol ADMINISTRADOR). */
export const AUDIT_ROUTES: Routes = [
  {
    path: '',
    title: 'Bitácora | ArreglaloYA',
    loadComponent: () =>
      import('./pages/audit-log-page/audit-log-page.component').then(
        (m) => m.AuditLogPageComponent,
      ),
  },
];
