import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { trimmedMaxLength, trimmedRequired } from '../../../../shared/validators/text.validators';
import { OrderPhotosPickerComponent } from '../../../orders/components/order-photos-picker/order-photos-picker.component';
import { PhotoPreviewService } from '../../../orders/services/photo-preview.service';
import { STALE_ACTION_STATUSES } from '../../../workflow/models/workflow.model';
import {
  CLAIM_DESCRIPTION_MAX_LENGTH,
  CLAIM_MAX_IMAGES,
  Claim,
  CreateClaimRequest,
} from '../../models/claim.model';
import { ClaimsApiService } from '../../services/claims-api.service';

const SEND_ERROR = 'No se pudo presentar el reclamo. Inténtelo de nuevo más tarde.';

/**
 * El cliente presenta un reclamo sobre un trabajo terminado (#92, RF-37): descripción
 * obligatoria y fotografías opcionales. El plazo lo decide el backend. Lo escrito y las
 * fotografías se conservan si el envío falla.
 */
@Component({
  selector: 'app-claim-form',
  imports: [ReactiveFormsModule, ConfirmDialogComponent, OrderPhotosPickerComponent],
  providers: [PhotoPreviewService],
  templateUrl: './claim-form.component.html',
  styleUrl: './claim-form.component.scss',
})
export class ClaimFormComponent {
  private readonly claimsApi = inject(ClaimsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly orderId = input.required<string>();
  /** El pedido se está volviendo a consultar: lo mostrado puede estar desactualizado. */
  readonly refreshing = input(false);

  readonly submitted = output<Claim>();
  /** Mensajes de un envío rechazado; vacío al volver a intentarlo. */
  readonly failed = output<string[]>();
  /** Lo mostrado puede estar desactualizado. */
  readonly stale = output();

  protected readonly maxLength = CLAIM_DESCRIPTION_MAX_LENGTH;
  protected readonly maxImages = CLAIM_MAX_IMAGES;
  protected readonly form = this.fb.group({
    description: this.fb.control('', [
      trimmedRequired,
      trimmedMaxLength(CLAIM_DESCRIPTION_MAX_LENGTH),
    ]),
    images: this.fb.control<File[]>([]),
  });

  protected readonly open = signal(false);
  protected readonly reviewed = signal(false);
  protected readonly pending = signal<CreateClaimRequest | null>(null);
  protected readonly sending = signal(false);
  /** Ya se envió y falta que la página traiga el estado actualizado. */
  protected readonly sent = linkedSignal({ source: this.orderId, computation: () => false });

  protected descriptionError(): string | null {
    const control = this.form.controls.description;
    if (control.valid || !(control.touched || this.reviewed())) {
      return null;
    }
    return control.hasError('required')
      ? 'Describa el problema.'
      : `Use como máximo ${CLAIM_DESCRIPTION_MAX_LENGTH} caracteres.`;
  }

  protected show(): void {
    this.open.set(true);
    this.focusAfterRender('#claim-description');
  }

  /** Cierra el formulario sin perder lo escrito. */
  protected hide(): void {
    this.open.set(false);
    this.focusAfterRender('.claim__open');
  }

  protected review(): void {
    this.reviewed.set(true);
    this.failed.emit([]);
    if (this.form.invalid) {
      this.host.nativeElement.querySelector<HTMLElement>('#claim-description')?.focus();
      return;
    }
    const { description, images } = this.form.getRawValue();
    this.pending.set({ description: description.trim(), images });
  }

  protected send(): void {
    const request = this.pending();
    if (request === null || this.sending() || this.sent() || this.refreshing()) {
      return;
    }
    this.sending.set(true);
    this.claimsApi
      .create(this.orderId(), request)
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (claim) => {
          this.pending.set(null);
          this.sent.set(true);
          this.submitted.emit(claim);
        },
        error: (error: unknown) => {
          this.pending.set(null);
          this.failed.emit(apiErrorMessages(error, SEND_ERROR));
          if (STALE_ACTION_STATUSES.includes(apiErrorStatus(error) ?? 0)) {
            this.stale.emit();
          }
        },
      });
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
