import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { SessionStore } from '../../../../core/auth/session.store';
import { ActionCardComponent } from '../../../../shared/components/action-card/action-card.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { WorkerProfileApiService } from '../../../worker-profile/services/worker-profile-api.service';

const ELIGIBILITY_ERROR = 'No se pudo consultar el estado de su perfil de trabajador.';

/**
 * Inicio del área de trabajador: elegibilidad efectiva (`GET /worker-profile/me/eligibility`) y
 * accesos. También es el destino de approvedWorkerGuard cuando el perfil no es elegible.
 */
@Component({
  selector: 'app-worker-home-page',
  imports: [DatePipe, ActionCardComponent, ErrorAlertComponent, LoadingStateComponent],
  templateUrl: './worker-home-page.component.html',
  styleUrls: ['../../home-page.scss', './worker-home-page.component.scss'],
})
export class WorkerHomePageComponent {
  private readonly workerProfileApi = inject(WorkerProfileApiService);
  private readonly session = inject(SessionStore);

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly firstName = computed(() => this.session.user()?.firstName ?? '');

  protected readonly eligibility = rxResource({
    stream: () => this.workerProfileApi.getEligibility(),
  });

  protected readonly eligibilityError = computed(() => {
    const error = this.eligibility.error();
    return error === undefined ? null : apiErrorMessages(error, ELIGIBILITY_ERROR).join(' ');
  });
}
