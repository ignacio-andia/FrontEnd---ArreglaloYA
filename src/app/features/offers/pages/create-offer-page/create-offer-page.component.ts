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
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import {
  SERVER_FIELD_MESSAGE,
  applyServerValidationErrors,
} from '../../../../shared/utils/server-validation';
import { trimmedRequired } from '../../../../shared/validators/text.validators';
import { OrdersApiService } from '../../../orders/services/orders-api.service';
import { budgetAmount, normalizeBudgetAmount } from '../../../orders/validators/order.validators';
import { WorkerProfileApiService } from '../../../worker-profile/services/worker-profile-api.service';
import { CreateOfferRequest, formatDuration } from '../../models/offer.model';
import { OffersApiService } from '../../services/offers-api.service';
import {
  durationMinutes,
  futureDateTime,
  toBoliviaDateTime,
  visitCost,
} from '../../validators/offer.validators';

type FormField =
  | 'amount'
  | 'requiresVisit'
  | 'visitCost'
  | 'materialsIncluded'
  | 'proposedStartAt'
  | 'estimatedDurationMinutes';

const LOAD_ERROR = 'No se pudo cargar el pedido.';
const SEND_ERROR = 'No se pudo enviar la oferta. Inténtelo de nuevo más tarde.';
const INVALID_FORM_MESSAGE = 'No se pudo enviar la oferta. Revise los campos marcados.';

const REQUIRED_MESSAGES: Readonly<Record<FormField, string>> = {
  amount: 'Indique el monto de su oferta.',
  requiresVisit: 'Elija la modalidad.',
  visitCost: 'Indique el costo de la visita (0 si es gratis).',
  materialsIncluded: 'Indique si incluye los materiales.',
  proposedStartAt: 'Indique la fecha y la hora de inicio.',
  estimatedDurationMinutes: 'Indique la duración estimada.',
};

/**
 * Envío de una oferta (`POST /offers/orders/:orderId`) en dos pasos: formulario y revisión. La
 * fecha se escribe en hora de Bolivia y se envía con su zona. El horario de atención no limita la
 * fecha propuesta. Visibilidad, duplicados y elegibilidad los valida el backend.
 */
@Component({
  selector: 'app-create-offer-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
  ],
  templateUrl: './create-offer-page.component.html',
  styleUrls: ['../../offer-pages.scss', './create-offer-page.component.scss'],
})
export class CreateOfferPageComponent {
  private readonly offersApi = inject(OffersApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly workerProfileApi = inject(WorkerProfileApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly orderId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('orderId') ?? '')),
    { requireSync: true },
  );

  protected readonly order = rxResource({
    params: () => this.orderId() || undefined,
    stream: ({ params }) => this.ordersApi.getAvailable(params),
  });
  protected readonly eligibility = rxResource({
    stream: () => this.workerProfileApi.getEligibility(),
  });
  protected readonly blocked = computed(
    () => this.eligibility.hasValue() && !this.eligibility.value().canTakeNewWork,
  );
  protected readonly notFound = computed(() => {
    const status = apiErrorStatus(this.order.error());
    return status === 404 || status === 400;
  });
  protected readonly loadError = computed(() => {
    const error = this.order.error();
    return error === undefined || this.notFound()
      ? null
      : apiErrorMessages(error, LOAD_ERROR).join(' ');
  });

  protected readonly form = this.fb.group({
    amount: this.fb.control('', [trimmedRequired, budgetAmount]),
    requiresVisit: this.fb.control<boolean | null>(null, [Validators.required]),
    visitCost: this.fb.control({ value: '', disabled: true }, [trimmedRequired, visitCost]),
    materialsIncluded: this.fb.control<boolean | null>(null, [Validators.required]),
    proposedStartAt: this.fb.control('', [Validators.required, futureDateTime]),
    estimatedDurationMinutes: this.fb.control<number | null>(null, [
      Validators.required,
      durationMinutes,
    ]),
  });

  protected readonly submitted = signal(false);
  protected readonly review = signal<CreateOfferRequest | null>(null);
  protected readonly sending = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly duration = formatDuration;
  /** Lo que se escribió, para mostrarlo en la revisión sin convertirlo. */
  protected readonly startLabel = computed(() => {
    const request = this.review();
    if (request === null) {
      return '';
    }
    const [date, time] = request.proposedStartAt.split('T');
    return `${date.split('-').reverse().join('/')} ${time.slice(0, 5)} (hora de Bolivia)`;
  });

  constructor() {
    // El costo de la visita solo existe si la oferta requiere visita.
    this.form.controls.requiresVisit.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((required) => {
        const control = this.form.controls.visitCost;
        if (required) {
          control.enable();
        } else {
          control.disable();
        }
      });
  }

  protected errorFor(field: FormField): string | null {
    const control = this.form.controls[field];
    if (control.disabled || control.valid || !(control.touched || this.submitted())) {
      return null;
    }
    const errors = control.errors ?? {};
    const server: unknown = errors['server'];
    if (typeof server === 'string') {
      return server;
    }
    if (errors['required']) {
      return REQUIRED_MESSAGES[field];
    }
    if (errors['budgetAmount']) {
      return 'Ingrese un monto mayor que 0, con hasta 8 dígitos enteros y 2 decimales.';
    }
    if (errors['visitCost']) {
      return 'Ingrese 0 o un monto con hasta 8 dígitos enteros y 2 decimales.';
    }
    if (errors['future']) {
      return 'La fecha y la hora deben ser futuras.';
    }
    if (errors['duration']) {
      return 'Ingrese un número entero de minutos, de 1 en adelante.';
    }
    return SERVER_FIELD_MESSAGE;
  }

  protected describedBy(field: FormField, hasHint = false): string | null {
    const ids: string[] = [];
    if (hasHint) {
      ids.push(`offer-${field}-hint`);
    }
    if (this.errorFor(field) !== null) {
      ids.push(`offer-${field}-error`);
    }
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected continueToReview(): void {
    this.submitted.set(true);
    this.errors.set([]);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusAfterRender('[aria-invalid="true"]');
      return;
    }
    this.review.set(this.buildRequest());
    this.focusAfterRender('#offer-review-title');
  }

  protected backToForm(): void {
    if (!this.sending()) {
      this.review.set(null);
      this.focusAfterRender('#offer-create-title');
    }
  }

  protected send(): void {
    const request = this.review();
    if (this.sending() || request === null) {
      return;
    }
    this.sending.set(true);
    this.errors.set([]);
    this.offersApi
      .create(this.orderId(), request)
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (offer) =>
          void this.router.navigate(['/trabajador/ofertas', offer.id], {
            state: { offerCreated: true },
          }),
        error: (error: unknown) => this.handleError(error),
      });
  }

  private buildRequest(): CreateOfferRequest {
    const value = this.form.getRawValue();
    const request: CreateOfferRequest = {
      amount: normalizeBudgetAmount(value.amount),
      requiresVisit: value.requiresVisit === true,
      materialsIncluded: value.materialsIncluded === true,
      proposedStartAt: toBoliviaDateTime(value.proposedStartAt),
      estimatedDurationMinutes: Number(value.estimatedDurationMinutes),
    };
    if (request.requiresVisit) {
      request.visitCost = normalizeBudgetAmount(value.visitCost);
    }
    return request;
  }

  private handleError(error: unknown): void {
    const messages = apiErrorMessages(error, SEND_ERROR);
    if (apiErrorStatus(error) === 400) {
      this.review.set(null);
      // Los errores se aplican con el formulario ya visible: al enlazarlo se recalcula.
      afterNextRender(
        () => {
          this.errors.set([
            INVALID_FORM_MESSAGE,
            ...applyServerValidationErrors(this.form, messages),
          ]);
          this.focusAfterRender('#offer-error-summary');
        },
        { injector: this.injector },
      );
      return;
    }
    // 403 elegibilidad, 404 pedido no visible, 409 oferta duplicada o cambio de zona, red o 5xx.
    this.errors.set(messages);
    this.focusAfterRender('#offer-error-summary');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
