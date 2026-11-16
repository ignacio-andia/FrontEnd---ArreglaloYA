import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map } from 'rxjs';
import { isAuthAreaUrl } from '../auth/auth-navigation';
import { AuthService } from '../auth/auth.service';
import { SessionStore } from '../auth/session.store';

/** Ruta de inicio de sesión (feature `auth`, montada en `/auth` dentro de PublicLayout). */
export const LOGIN_PATH = '/auth/login';

/**
 * Redirección al login conservando la URL solicitada en `returnUrl`.
 * No se conserva cuando la URL pertenece al área de autenticación ni cuando es la raíz,
 * para evitar ciclos (`/auth/login?returnUrl=/auth/login...`).
 */
export function loginRedirect(router: Router, requestedUrl: string): UrlTree {
  const keepReturnUrl = !isAuthAreaUrl(requestedUrl) && requestedUrl !== '/' && requestedUrl !== '';

  return router.createUrlTree([LOGIN_PATH], {
    queryParams: keepReturnUrl ? { returnUrl: requestedUrl } : {},
  });
}

/**
 * Permite el acceso solo con una sesión autenticada (token y usuario cargado).
 * Si hay token sin usuario (por ejemplo, la restauración inicial falló por red),
 * vuelve a intentarlo con AuthService antes de decidir. Es un control de experiencia:
 * el backend sigue validando cada petición.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const session = inject(SessionStore);

  return inject(AuthService)
    .restoreSession()
    .pipe(map(() => (session.isAuthenticated() ? true : loginRedirect(router, state.url))));
};
