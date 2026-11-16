import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/guest.guard';

/**
 * Rutas de la feature de autenticación, montadas en `/auth` dentro de PublicLayout.
 * Son solo para visitantes: con sesión iniciada, guestGuard redirige al área del usuario.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: '',
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        title: 'Iniciar sesión | ArreglaloYA',
        loadComponent: () =>
          import('./pages/login-page/login-page.component').then((m) => m.LoginPageComponent),
      },
      {
        path: 'registro',
        title: 'Crear cuenta | ArreglaloYA',
        loadComponent: () =>
          import('./pages/register-page/register-page.component').then(
            (m) => m.RegisterPageComponent,
          ),
      },
    ],
  },
];
