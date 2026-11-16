import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../../../core/auth/session.store';
import { CatalogsApiService } from '../../../catalogs/services/catalogs-api.service';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { ProfileDetailsFormComponent } from '../../components/profile-details-form/profile-details-form.component';
import { SchedulesFormComponent } from '../../components/schedules-form/schedules-form.component';
import { SpecialtiesFormComponent } from '../../components/specialties-form/specialties-form.component';
import { SubmitReviewComponent } from '../../components/submit-review/submit-review.component';
import { WorkerDocumentsPanelComponent } from '../../components/worker-documents-panel/worker-documents-panel.component';
import { WorkerProfileSummaryComponent } from '../../components/worker-profile-summary/worker-profile-summary.component';
import { WORKER_PROFILE_STATUS_LABELS } from '../../models/worker-profile-status.model';
import { WorkerProfile } from '../../models/worker-profile.model';
import { WorkerProfileApiService } from '../../services/worker-profile-api.service';

const PROFILE_ERROR = 'No se pudo consultar su perfil de trabajador.';
const ELIGIBILITY_ERROR =
  'No se pudo consultar si su cuenta puede usar las funciones de trabajador.';
const CATALOG_ERROR = 'No se pudieron cargar las zonas o las especialidades.';

/**
 * «Mi perfil» del área de trabajador. Coordina el perfil propio (`GET /worker-profile/me`), su
 * estado e historial (`/me/status`), la elegibilidad efectiva (`/me/eligibility`) y las
 * secciones de edición, horarios, documentos y envío a revisión. Lo que se puede editar lo
 * decide el backend (`canEdit`): tener el rol TRABAJADOR no implica un perfil aprobado.
 */
@Component({
  selector: 'app-my-worker-profile-page',
  imports: [
    DatePipe,
    RouterLink,
    ProfileDetailsFormComponent,
    SchedulesFormComponent,
    SpecialtiesFormComponent,
    SubmitReviewComponent,
    WorkerDocumentsPanelComponent,
    WorkerProfileSummaryComponent,
  ],
  templateUrl: './my-worker-profile-page.component.html',
  styleUrl: './my-worker-profile-page.component.scss',
})
export class MyWorkerProfilePageComponent {
  private readonly workerProfileApi = inject(WorkerProfileApiService);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly isClient = inject(SessionStore).user()?.roles.includes('CLIENTE') ?? false;
  protected readonly statusLabels = WORKER_PROFILE_STATUS_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;

  protected readonly profile = rxResource({
    stream: () => this.workerProfileApi.getOwnProfile(),
  });

  protected readonly eligibility = rxResource({
    stream: () => this.workerProfileApi.getEligibility(),
  });

  protected readonly status = rxResource({
    params: () => (this.profile.hasValue() ? true : undefined),
    stream: () => this.workerProfileApi.getStatus(),
  });

  /** Datos, especialidades y documentos solo se editan en BORRADOR u OBSERVADO. */
  protected readonly canEdit = computed(
    () => this.profile.hasValue() && this.profile.value().canEdit,
  );

  protected readonly statusLabel = computed(() =>
    this.profile.hasValue() ? WORKER_PROFILE_STATUS_LABELS[this.profile.value().status] : '',
  );

  protected readonly zones = rxResource({
    params: () => (this.canEdit() ? true : undefined),
    stream: () => this.catalogsApi.getZones(),
  });

  protected readonly categories = rxResource({
    params: () => (this.canEdit() ? true : undefined),
    stream: () => this.catalogsApi.getCategories(),
  });

  protected readonly catalogsError = computed(() => {
    const error = this.zones.error() ?? this.categories.error();
    return error === undefined ? null : apiErrorMessages(error, CATALOG_ERROR).join(' ');
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

  protected readonly submittedMessage = signal<string | null>(null);

  protected retry(): void {
    this.profile.reload();
    this.eligibility.reload();
  }

  protected retryCatalogs(): void {
    this.zones.reload();
    this.categories.reload();
  }

  /** Una sección guardó cambios: se muestra la versión que devolvió el backend. */
  protected onSaved(updated: WorkerProfile): void {
    this.submittedMessage.set(null);
    this.profile.set(updated);
  }

  /** El perfil pasó a revisión: cambian el estado, el historial y la elegibilidad. */
  protected onSubmitted(updated: WorkerProfile): void {
    this.profile.set(updated);
    this.status.reload();
    this.eligibility.reload();
    this.submittedMessage.set(
      `Su perfil fue enviado a revisión. Estado actual: ${WORKER_PROFILE_STATUS_LABELS[updated.status]}. ` +
        'Todavía no está aprobado: el equipo debe revisarlo.',
    );
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('#my-profile-submitted')?.focus(),
      { injector: this.injector },
    );
  }
}
