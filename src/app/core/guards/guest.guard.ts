import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { homePathForRoles } from '../auth/auth-navigation';
import { AuthService } from '../auth/auth.service';
import { SessionStore } from '../auth/session.store';

/**
 * Páginas solo para visitantes (inicio de sesión y registro). Con una sesión autenticada
 * redirige al área predeterminada del usuario, de modo que un nuevo registro o login no
 * reemplace por accidente la sesión iniciada. Si hay un token guardado, primero intenta
 * restaurar la sesión (petición compartida con authGuard y roleGuard).
 */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const session = inject(SessionStore);

  return inject(AuthService)
    .restoreSession()
    .pipe(
      map(() => {
        const user = session.user();
        return session.isAuthenticated() && user !== null
          ? router.parseUrl(homePathForRoles(user.roles))
          : true;
      }),
    );
};
