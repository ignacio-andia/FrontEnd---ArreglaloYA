import { Routes } from '@angular/router';

/**
 * «Mi cuenta». Hoy se monta en `/cliente/mi-cuenta`; las áreas de trabajador y administración
 * pueden montar estas mismas rutas (`loadChildren`) sin duplicar la página.
 */
export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    title: 'Mi cuenta | ArreglaloYA',
    loadComponent: () =>
      import('./pages/account-page/account-page.component').then((m) => m.AccountPageComponent),
  },
];
