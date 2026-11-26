import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize, map } from 'rxjs';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import {
  RecommendationSettings,
  SETTINGS_LIMITS,
  UpdateRecommendationSettingsRequest,
} from '../../models/recommendation.model';
import { RecommendationsApiService } from '../../services/recommendations-api.service';

type SettingsField = keyof UpdateRecommendationSettingsRequest;

const LOAD_ERROR = 'No se pudieron cargar los criterios de recomendación.';
const SAVE_ERROR = 'No se pudieron guardar los criterios. Inténtelo de nuevo.';
const WEIGHT_FIELDS = [
  'reputationWeight',
  'completedServicesWeight',
  'availabilityWeight',
] as const satisfies readonly SettingsField[];

const field = (name: SettingsField) =>
  new FormControl(0, {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.min(SETTINGS_LIMITS[name].min),
      Validators.max(SETTINGS_LIMITS[name].max),
      Validators.pattern(/^\d+$/),
    ],
  });

/** Los tres pesos deben sumar exactamente 100 (el backend valida lo mismo). */
function weightsSumTo100(group: AbstractControl): ValidationErrors | null {
  const total = WEIGHT_FIELDS.reduce((sum, name) => sum + Number(group.get(name)?.value ?? 0), 0);
  return total === 100 ? null : { weightsSum: total };
}

/**
 * Criterios de la recomendación de trabajadores (`/admin/recomendaciones`). Cada vez que se
 * guardan se crea una versión nueva: las recomendaciones ya generadas conservan la versión con la
 * que se calcularon. El cambio queda en la bitácora.
 */
@Component({
  selector: 'app-recommendation-settings-page',
  imports: [DatePipe, ReactiveFormsModule, ErrorAlertComponent, LoadingStateComponent],
  templateUrl: './recommendation-settings-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss', './recommendation-settings-page.component.scss'],
})
export class RecommendationSettingsPageComponent {
  private readonly api = inject(RecommendationsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly limits = SETTINGS_LIMITS;

  protected readonly form = new FormGroup(
    {
      reputationWeight: field('reputationWeight'),
      completedServicesWeight: field('completedServicesWeight'),
      availabilityWeight: field('availabilityWeight'),
      reviewsForConfidence: field('reviewsForConfidence'),
      completedServicesTarget: field('completedServicesTarget'),
      availabilityHoursTarget: field('availabilityHoursTarget'),
    },
    { validators: weightsSumTo100 },
  );

  /** Suma de los pesos mientras se escribe. */
  protected readonly weightsTotal = toSignal(
    this.form.valueChanges.pipe(
      map(() =>
        WEIGHT_FIELDS.reduce((sum, name) => sum + Number(this.form.controls[name].value), 0),
      ),
    ),
    { initialValue: 0 },
  );

  protected readonly settings = rxResource({
    stream: () => this.api.getSettings(),
  });
  protected readonly current = computed(() =>
    this.settings.hasValue() ? this.settings.value().current : null,
  );
  protected readonly history = computed(() =>
    this.settings.hasValue() ? this.settings.value().history : [],
  );
  protected readonly loadError = computed(() => {
    const error = this.settings.error();
    return error === undefined ? null : apiErrorMessages(error, LOAD_ERROR).join(' ');
  });

  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveErrors = signal<string[]>([]);
  protected readonly savedVersion = signal<number | null>(null);

  constructor() {
    // El formulario muestra siempre la versión vigente.
    effect(() => {
      const current = this.current();
      if (current !== null) {
        this.form.reset(pickValues(current));
      }
    });
  }

  protected errorFor(name: SettingsField): string | null {
    const control = this.form.controls[name];
    if (control.valid || !(control.touched || this.submitted())) {
      return null;
    }
    const { min, max } = SETTINGS_LIMITS[name];
    if (control.hasError('required')) {
      return 'Ingrese un valor.';
    }
    if (control.hasError('pattern')) {
      return 'Ingrese un número entero.';
    }
    return `Ingrese un valor entre ${min} y ${max}.`;
  }

  protected sumError(): boolean {
    return this.form.hasError('weightsSum') && (this.submitted() || this.form.touched);
  }

  protected describedBy(name: SettingsField): string | null {
    const ids = [`settings-${name}-hint`];
    if (this.errorFor(name) !== null) {
      ids.push(`settings-${name}-error`);
    }
    if ((WEIGHT_FIELDS as readonly string[]).includes(name) && this.sumError()) {
      ids.push('settings-sum-error');
    }
    return ids.join(' ');
  }

  protected save(): void {
    this.submitted.set(true);
    this.saveErrors.set([]);
    this.savedVersion.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusAfterRender('[aria-invalid="true"]');
      return;
    }
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    const values = this.form.getRawValue();
    this.api
      .updateSettings({
        reputationWeight: Number(values.reputationWeight),
        completedServicesWeight: Number(values.completedServicesWeight),
        availabilityWeight: Number(values.availabilityWeight),
        reviewsForConfidence: Number(values.reviewsForConfidence),
        completedServicesTarget: Number(values.completedServicesTarget),
        availabilityHoursTarget: Number(values.availabilityHoursTarget),
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (overview) => {
          this.settings.set(overview);
          this.submitted.set(false);
          this.savedVersion.set(overview.current.version);
          this.focusAfterRender('#settings-saved');
        },
        error: (error: unknown) => {
          this.saveErrors.set(apiErrorMessages(error, SAVE_ERROR));
          this.focusAfterRender('#settings-save-error');
        },
      });
  }

  protected restore(): void {
    const current = this.current();
    if (current !== null) {
      this.form.reset(pickValues(current));
      this.submitted.set(false);
      this.saveErrors.set([]);
    }
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

function pickValues(settings: RecommendationSettings): UpdateRecommendationSettingsRequest {
  return {
    reputationWeight: settings.reputationWeight,
    completedServicesWeight: settings.completedServicesWeight,
    availabilityWeight: settings.availabilityWeight,
    reviewsForConfidence: settings.reviewsForConfidence,
    completedServicesTarget: settings.completedServicesTarget,
    availabilityHoursTarget: settings.availabilityHoursTarget,
  };
}
