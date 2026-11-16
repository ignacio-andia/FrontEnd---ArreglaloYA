import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, map, of, switchMap } from 'rxjs';
import { User } from '../../../../core/auth/auth.models';
import { AuthService } from '../../../../core/auth/auth.service';
import { SessionStore } from '../../../../core/auth/session.store';
import { CatalogsApiService } from '../../../catalogs/services/catalogs-api.service';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import {
  SERVER_FIELD_MESSAGE,
  applyServerValidationErrors,
  setServerError,
} from '../../../../shared/utils/server-validation';
import { trimmedMaxLength } from '../../../../shared/validators/text.validators';
import { WorkerProfileSummaryComponent } from '../../components/worker-profile-summary/worker-profile-summary.component';
import { CreateWorkerProfileRequest, WorkerProfile } from '../../models/worker-profile.model';
import { WorkerProfileApiService } from '../../services/worker-profile-api.service';
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_SPECIALTIES,
  MAX_YEARS_OF_EXPERIENCE,
  MIN_SPECIALTIES,
  MIN_YEARS_OF_EXPERIENCE,
  integer,
  selectionCount,
} from '../../validators/worker-profile.validators';
import { ScheduleEditorComponent } from '../../components/schedule-editor/schedule-editor.component';
import {
  createScheduleArray,
  toScheduleRequests,
} from '../../components/schedule-editor/schedule-form';

type FormField = 'yearsOfExperience' | 'zoneId' | 'categoryIds' | 'description';

/** Raíz del área de trabajador (sin approvedWorkerGuard): destino tras crear el perfil. */
const WORKER_AREA_PATH = '/trabajador';

const CATALOG_ERROR = 'No se pudieron cargar las zonas o las especialidades.';
const PROFILE_ERROR = 'No se pudo consultar su perfil de trabajador.';
const INVALID_FORM_MESSAGE = 'No se pudo crear el perfil. Revise los campos marcados.';
const UNEXPECTED_MESSAGE = 'Ocurrió un error inesperado. Inténtelo de nuevo más tarde.';

/**
 * «Quiero ofrecer mis servicios» (área de cliente). Una cuenta CLIENTE crea su perfil de
 * trabajador con la misma cuenta (`POST /worker-profile`), sin registrarse otra vez.
 *
 * - Si la cuenta ya tiene el rol TRABAJADOR, se consulta `GET /worker-profile/me` y se muestra
 *   el perfil; solo si responde 404 (rol sin perfil) se ofrece el formulario.
 * - Las zonas y especialidades salen de los catálogos públicos; sin zonas o especialidades
 *   activas el formulario no se puede enviar.
 * - Tras crear el perfil se vuelve a pedir `/auth/me` y solo se navega al área de trabajador
 *   si la respuesta confirma el rol TRABAJADOR.
 */
@Component({
  selector: 'app-become-worker-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ScheduleEditorComponent,
    WorkerProfileSummaryComponent,
  ],
  templateUrl: './become-worker-page.component.html',
  styleUrl: './become-worker-page.component.scss',
})
export class BecomeWorkerPageComponent {
  private readonly auth = inject(AuthService);
  private readonly workerProfileApi = inject(WorkerProfileApiService);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly session = inject(SessionStore);

  /** Se decide al entrar: con rol TRABAJADOR puede existir ya un perfil. */
  private readonly hadWorkerRole = this.session.user()?.roles.includes('TRABAJADOR') ?? false;

  /**
   * El teléfono es de la cuenta (no del perfil) y el backend lo exige para enviar el perfil a
   * revisión. Se lee de la sesión, que «Mi cuenta» actualiza al guardar.
   */
  protected readonly missingPhone = computed(() => this.session.user()?.phone === null);

  protected readonly limits = {
    minYears: MIN_YEARS_OF_EXPERIENCE,
    maxYears: MAX_YEARS_OF_EXPERIENCE,
    maxDescription: MAX_DESCRIPTION_LENGTH,
    minSpecialties: MIN_SPECIALTIES,
    maxSpecialties: MAX_SPECIALTIES,
  };

  protected readonly existingProfile = rxResource({
    params: () => (this.hadWorkerRole ? true : undefined),
    stream: () => this.workerProfileApi.getOwnProfile(),
  });

  /** Perfil a mostrar: el existente o el recién creado (si no se pudo confirmar el rol). */
  protected readonly createdProfile = signal<WorkerProfile | null>(null);
  protected readonly profile = computed(
    () =>
      this.createdProfile() ??
      (this.existingProfile.hasValue() ? this.existingProfile.value() : null),
  );

  protected readonly checkingProfile = computed(() => this.existingProfile.isLoading());
  protected readonly profileError = computed(() => {
    const error = this.existingProfile.error();
    if (error === undefined || apiErrorStatus(error) === 404) {
      return null;
    }
    return apiErrorMessages(error, PROFILE_ERROR).join(' ');
  });

  /** Formulario visible: sin perfil (sin rol TRABAJADOR, o con el rol pero 404). */
  protected readonly showForm = computed(() => {
    if (this.profile() !== null) {
      return false;
    }
    if (!this.hadWorkerRole) {
      return true;
    }
    return apiErrorStatus(this.existingProfile.error()) === 404;
  });

  protected readonly zones = rxResource({
    params: () => (this.showForm() ? true : undefined),
    stream: () => this.catalogsApi.getZones(),
  });

  protected readonly categories = rxResource({
    params: () => (this.showForm() ? true : undefined),
    stream: () => this.catalogsApi.getCategories(),
  });

  /**
   * Solo la primera carga oculta el formulario. Al recargar tras un error del servidor los
   * catálogos conservan su valor y el formulario sigue visible, sin perder sus errores.
   */
  protected readonly catalogsLoading = computed(
    () =>
      !(this.zones.hasValue() && this.categories.hasValue()) &&
      (this.zones.isLoading() || this.categories.isLoading()),
  );
  protected readonly catalogsError = computed(() => {
    const error = this.zones.error() ?? this.categories.error();
    return error === undefined ? null : apiErrorMessages(error, CATALOG_ERROR).join(' ');
  });
  protected readonly zoneOptions = computed(() =>
    this.zones.hasValue() ? this.zones.value() : [],
  );
  protected readonly categoryOptions = computed(() =>
    this.categories.hasValue() ? this.categories.value() : [],
  );
  protected readonly noZones = computed(
    () => this.zones.hasValue() && this.zones.value().length === 0,
  );
  protected readonly noCategories = computed(
    () => this.categories.hasValue() && this.categories.value().length === 0,
  );
  /** El formulario solo se puede enviar con zonas y especialidades activas reales. */
  protected readonly catalogsReady = computed(
    () =>
      this.zones.hasValue() &&
      this.categories.hasValue() &&
      this.zones.value().length > 0 &&
      this.categories.value().length > 0,
  );

  protected readonly form = this.fb.group({
    yearsOfExperience: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(MIN_YEARS_OF_EXPERIENCE),
      Validators.max(MAX_YEARS_OF_EXPERIENCE),
      integer,
    ]),
    zoneId: this.fb.control('', [Validators.required]),
    categoryIds: this.fb.control<string[]>([], [selectionCount(MIN_SPECIALTIES, MAX_SPECIALTIES)]),
    description: this.fb.control('', [trimmedMaxLength(MAX_DESCRIPTION_LENGTH)]),
    /** Horarios opcionales (RF-29); también se pueden registrar después desde «Mi perfil». */
    schedules: createScheduleArray(this.fb),
  });

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly duplicateProfile = signal(false);
  protected readonly roleNotConfirmed = signal(false);

  /** Mensaje de error visible de un campo, o `null` si no debe mostrarse todavía. */
  protected errorFor(field: FormField): string | null {
    const control = this.form.controls[field];
    if (control.valid || !(control.touched || this.submitted())) {
      return null;
    }

    const errors = control.errors ?? {};
    const server: unknown = errors['server'];
    if (typeof server === 'string') {
      return server;
    }
    if (errors['required']) {
      return field === 'zoneId'
        ? 'Seleccione su zona de trabajo.'
        : 'Ingrese sus años de experiencia.';
    }
    if (errors['min'] || errors['max'] || errors['integer']) {
      return `Ingrese un número entero entre ${MIN_YEARS_OF_EXPERIENCE} y ${MAX_YEARS_OF_EXPERIENCE}.`;
    }
    if (errors['minSelection']) {
      return 'Seleccione al menos una especialidad.';
    }
    if (errors['maxSelection']) {
      return `Seleccione como máximo ${MAX_SPECIALTIES} especialidades.`;
    }
    if (errors['maxlength']) {
      return `Use como máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`;
    }
    return SERVER_FIELD_MESSAGE;
  }

  /** `aria-describedby` del campo: su ayuda (si la tiene) y su error visible. */
  protected describedBy(field: FormField, hasHint = false): string | null {
    const ids: string[] = [];
    if (hasHint) {
      ids.push(`worker-${field}-hint`);
    }
    if (this.errorFor(field) !== null) {
      ids.push(`worker-${field}-error`);
    }
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected isSelected(categoryId: string): boolean {
    return this.form.controls.categoryIds.value.includes(categoryId);
  }

  protected onCategoryChange(categoryId: string, event: Event): void {
    const checked = event.target instanceof HTMLInputElement && event.target.checked;
    const control = this.form.controls.categoryIds;
    const selected = control.value.filter((id) => id !== categoryId);
    control.setValue(checked ? [...selected, categoryId] : selected);
    control.markAsTouched();
  }

  protected retryCatalogs(): void {
    this.zones.reload();
    this.categories.reload();
  }

  protected retryProfile(): void {
    this.existingProfile.reload();
  }

  protected submit(): void {
    if (this.submitting() || !this.catalogsReady()) {
      return;
    }

    this.submitted.set(true);
    this.formErrors.set([]);
    this.duplicateProfile.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusAfterRender('[aria-invalid="true"]');
      return;
    }

    this.submitting.set(true);
    this.workerProfileApi
      .createProfile(this.buildRequest())
      .pipe(
        // La respuesta no trae los roles: se confirma el rol TRABAJADOR con /auth/me.
        switchMap((profile) =>
          this.auth.getCurrentUser().pipe(
            map((user): { profile: WorkerProfile; user: User | null } => ({ profile, user })),
            catchError(() => of({ profile, user: null })),
          ),
        ),
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ profile, user }) => this.onCreated(profile, user),
        error: (error: unknown) => this.handleError(error),
      });
  }

  /** Cuerpo con las propiedades del DTO; la descripción vacía y la lista de horarios vacía se omiten. */
  private buildRequest(): CreateWorkerProfileRequest {
    const { yearsOfExperience, zoneId, categoryIds, description } = this.form.getRawValue();
    const request: CreateWorkerProfileRequest = {
      yearsOfExperience: yearsOfExperience ?? 0,
      zoneId,
      categoryIds,
    };

    const trimmedDescription = description.trim();
    if (trimmedDescription !== '') {
      request.description = trimmedDescription;
    }

    const schedules = toScheduleRequests(this.form.controls.schedules);
    if (schedules.length > 0) {
      request.schedules = schedules;
    }
    return request;
  }

  private onCreated(profile: WorkerProfile, user: User | null): void {
    if (user?.roles.includes('TRABAJADOR')) {
      void this.router.navigateByUrl(WORKER_AREA_PATH);
      return;
    }

    // El perfil existe, pero la sesión no confirmó el rol: se muestra lo devuelto por el backend.
    this.createdProfile.set(profile);
    this.roleNotConfirmed.set(true);
  }

  private handleError(error: unknown): void {
    const status = apiErrorStatus(error);
    const messages = apiErrorMessages(error, UNEXPECTED_MESSAGE);

    if (status === 409) {
      // "Esta cuenta ya tiene un perfil de trabajador": se actualiza la sesión para ver el área.
      this.duplicateProfile.set(true);
      this.formErrors.set(messages);
      this.auth
        .getCurrentUser()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ error: () => undefined });
    } else if (status === 404) {
      // Zona inexistente: el catálogo cambió desde que se cargó.
      setServerError(this.form.controls.zoneId, messages.join(' '));
      this.formErrors.set([INVALID_FORM_MESSAGE]);
      this.retryCatalogs();
    } else if (status === 400) {
      // Validación del DTO o zona/especialidades inactivas (mensajes de negocio).
      const unmatched = applyServerValidationErrors(this.form, messages);
      this.formErrors.set([INVALID_FORM_MESSAGE, ...unmatched]);
      this.retryCatalogs();
    } else {
      this.formErrors.set(messages);
    }

    this.focusAfterRender('#worker-error-summary');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
