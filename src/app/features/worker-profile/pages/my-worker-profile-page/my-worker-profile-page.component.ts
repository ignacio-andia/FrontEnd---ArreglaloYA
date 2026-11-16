import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { WorkerProfileSummaryComponent } from '../../components/worker-profile-summary/worker-profile-summary.component';
import { WorkerProfileApiService } from '../../services/worker-profile-api.service';

const PROFILE_ERROR = 'No se pudo consultar su perfil de trabajador.';
const ELIGIBILITY_ERROR =
  'No se pudo consultar si su cuenta puede usar las funciones de trabajador.';

/**
 * «Mi perfil» del área de trabajador: perfil propio (`GET /worker-profile/me`) y elegibilidad
 * efectiva (`GET /worker-profile/me/eligibility`), tal como los informa el backend.
 * Tener el rol TRABAJADOR no implica un perfil aprobado.
 */
@Component({
  selector: 'app-my-worker-profile-page',
  imports: [RouterLink, WorkerProfileSummaryComponent],
  templateUrl: './my-worker-profile-page.component.html',
  styleUrl: './my-worker-profile-page.component.scss',
})
export class MyWorkerProfilePageComponent {
  private readonly workerProfileApi = inject(WorkerProfileApiService);

  protected readonly isClient = inject(SessionStore).user()?.roles.includes('CLIENTE') ?? false;

  protected readonly profile = rxResource({
    stream: () => this.workerProfileApi.getOwnProfile(),
  });

  protected readonly eligibility = rxResource({
    stream: () => this.workerProfileApi.getEligibility(),
  });

  /** La cuenta tiene el rol, pero todavía no tiene perfil (404). */
  protected readonly noProfile = computed(() => apiErrorStatus(this.profile.error()) === 404);

  protected readonly profileError = computed(() => {
    const error = this.profile.error();
    return error === undefined || this.noProfile()
      ? null
      : apiErrorMessages(error, PROFILE_ERROR).join(' ');
  });

  protected readonly eligibilityError = computed(() => {
    const error = this.eligibility.error();
    return error === undefined ? null : apiErrorMessages(error, ELIGIBILITY_ERROR).join(' ');
  });

  protected retry(): void {
    this.profile.reload();
    this.eligibility.reload();
  }
}
