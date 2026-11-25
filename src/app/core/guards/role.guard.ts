import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SessionStore } from '../auth/session.store';
import { RoleName } from '../models/role.model';
import { loginRedirect } from './auth.guard';

/** Destino cuando el usuario no tiene el rol requerido. */
export const ROLE_DENIED_PATH = '/acceso-denegado';

/**
 * Permite el acceso si el usuario tiene **alguno** de los roles indicados.
 * Una misma cuenta puede tener varios roles (por ejemplo CLIENTE y TRABAJADOR).
 * Sin el rol requerido redirige sin cerrar la sesión; sin sesión, al login.
 *
 * Angular evalúa a la vez los guards de un mismo `canActivate`, por lo que este guard
 * también espera la restauración de sesión (compartida con authGuard, sin peticiones duplicadas).
 */
export function roleGuard(allowedRoles: readonly RoleName[]): CanActivateFn {
  return (_route, state) => {
    const router = inject(Router);
    const session = inject(SessionStore);

    return inject(AuthService)
      .restoreSession()
      .pipe(
        map(() => {
          const user = session.user();

          if (!session.isAuthenticated() || user === null) {
            return loginRedirect(router, state.url);
          }

          return user.roles.some((role) => allowedRoles.includes(role))
            ? true
            : router.createUrlTree([ROLE_DENIED_PATH]);
        }),
      );
  };
}
