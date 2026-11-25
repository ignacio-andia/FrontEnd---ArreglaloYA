import { Routes } from '@angular/router';

/**
 * «Mi cuenta», montada en `mi-cuenta` de las áreas de cliente, trabajador y administración.
 */
export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    title: 'Mi cuenta | ArreglaloYA',
    loadComponent: () =>
      import('./pages/account-page/account-page.component').then((m) => m.AccountPageComponent),
  },
];
