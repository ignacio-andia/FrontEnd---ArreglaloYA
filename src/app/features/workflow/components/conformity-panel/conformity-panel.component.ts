import { Component, DestroyRef, inject, input, linkedSignal, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { STALE_ACTION_STATUSES, Workflow } from '../../models/workflow.model';
import { WorkflowApiService } from '../../services/workflow-api.service';
import { actionErrorMessages } from '../../utils/action-error';

const SEND_ERROR = 'No se pudo confirmar su conformidad. Inténtelo de nuevo más tarde.';

/**
 * El cliente confirma su conformidad con un trabajo terminado (#89), lo que cierra el pedido.
 * No decide según el plazo: el backend lo admite mientras el pedido siga `TERMINADO`.
 */
@Component({
  selector: 'app-conformity-panel',
  imports: [ConfirmDialogComponent],
  template: `
    <section class="offers__card" aria-labelledby="conformity-title">
      <h2 id="conformity-title" class="offers__subtitle">Conformidad con el trabajo</h2>
      <p>
        El trabajador marcó el trabajo como terminado. Revise el resultado antes de confirmar su
        conformidad.
      </p>
      <div class="offers__actions">
        <button
          type="button"
          class="offers__primary conformity__confirm"
          [disabled]="sending() || sent() || refreshing()"
          (click)="ask()"
        >
          {{ sent() ? 'Actualizando…' : 'Confirmar conformidad' }}
        </button>
      </div>
    </section>

    <app-confirm-dialog
      heading="¿Confirmar que está conforme?"
      confirmLabel="Sí, estoy conforme"
      dismissLabel="Volver"
      tone="primary"
      titleId="conformity-confirm-title"
      [open]="confirming()"
      [busy]="sending()"
      (confirmed)="send()"
      (cancelled)="confirming.set(false)"
    >
      <p>
        Confirma que está <strong>conforme con el trabajo realizado</strong>. El pedido se cerrará,
        no se puede reabrir y ya no podrá presentar un reclamo.
      </p>
      <p>Confirmar no registra ningún pago: los pagos se declaran aparte.</p>
    </app-confirm-dialog>
  `,
  styleUrl: '../../../offers/offer-pages.scss',
})
export class ConformityPanelComponent {
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly workflow = input.required<Workflow>();
  /** El flujo se está volviendo a consultar: lo mostrado puede estar desactualizado. */
  readonly refreshing = input(false);

  readonly confirmed = output();
  /** Mensajes de una confirmación rechazada; vacío al volver a intentarlo. */
  readonly failed = output<string[]>();
  /** Lo mostrado puede estar desactualizado. */
  readonly stale = output();

  protected readonly confirming = signal(false);
  protected readonly sending = signal(false);
  /** Ya se confirmó y falta que la página traiga el flujo actualizado. */
  protected readonly sent = linkedSignal({ source: this.workflow, computation: () => false });

  protected ask(): void {
    this.failed.emit([]);
    this.confirming.set(true);
  }

  protected send(): void {
    if (this.sending() || this.sent() || this.refreshing()) {
      return;
    }
    this.sending.set(true);
    this.workflowApi
      .confirmConformity(this.workflow().orderId)
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.confirming.set(false);
          this.sent.set(true);
          this.confirmed.emit();
        },
        error: (error: unknown) => {
          this.confirming.set(false);
          this.failed.emit(actionErrorMessages(error, SEND_ERROR));
          if (STALE_ACTION_STATUSES.includes(apiErrorStatus(error) ?? 0)) {
            this.stale.emit();
          }
        },
      });
  }
}
