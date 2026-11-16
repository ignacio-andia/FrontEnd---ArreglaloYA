import { inject } from '@angular/core';
import { CanActivateFn, GuardResult, RedirectCommand, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { WorkerEligibility } from '../../features/worker-profile/models/worker-profile.model';
import { WorkerProfileApiService } from '../../features/worker-profile/services/worker-profile-api.service';
import { loginRedirect } from './auth.guard';

/**
 * Inicio del área de trabajador, destino cuando el perfil no es elegible.
 * PROVISIONAL: corresponde a la ruta `trabajador` prevista en la arquitectura, que no debe
 * llevar approvedWorkerGuard (solo authGuard y roleGuard) para no generar ciclos.
 */
export const WORKER_HOME_PATH = '/trabajador';

/**
 * Estado de navegación que recibe la pantalla de destino cuando el acceso se deniega por
 * elegibilidad. Se lee con `Router.currentNavigation()?.extras.state` o `history.state`.
 */
export interface WorkerEligibilityNavigationState {
  workerEligibility: WorkerEligibility;
}

/**
 * Permite el acceso solo si `GET /worker-profile/me/eligibility` responde `eligible: true`.
 * No decide por el rol TRABAJADOR ni por el estado del perfil: solo por la elegibilidad efectiva.
 *
 * - No elegible: redirige al inicio del área de trabajador con la respuesta completa
 *   (`status`, `message`, `reason`) en el estado de navegación para mostrar el motivo.
 * - 401: la sesión ya fue limpiada por apiErrorInterceptor; redirige al login.
 * - Otros errores (403, red, 5xx): deniega y redirige al inicio del área de trabajador.
 */
export const approvedWorkerGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const workerHome = router.createUrlTree([WORKER_HOME_PATH]);
  const isWorkerHome = router.serializeUrl(workerHome) === state.url;

  return inject(WorkerProfileApiService)
    .getEligibility()
    .pipe(
      map((workerEligibility): GuardResult => {
        if (workerEligibility.eligible) {
          return true;
        }

        if (isWorkerHome) {
          return false;
        }

        const navigationState: WorkerEligibilityNavigationState = { workerEligibility };
        return new RedirectCommand(workerHome, { state: { ...navigationState } });
      }),
      catchError((error: unknown) => {
        if (hasStatusCode(error, 401)) {
          return of(loginRedirect(router, state.url));
        }

        return of(isWorkerHome ? false : workerHome);
      }),
    );
};

function hasStatusCode(error: unknown, statusCode: number): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    error.statusCode === statusCode
  );
}
