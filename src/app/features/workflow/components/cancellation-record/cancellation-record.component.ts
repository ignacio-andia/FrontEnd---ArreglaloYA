import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OfferParty } from '../../../offers/models/offer.model';
import { ORDER_STATUS_LABELS, isOrderStatus } from '../../../orders/models/order.model';
import { isCancellation } from '../../models/timeline.model';
import { ServiceWorkStore } from '../../services/service-work.store';
import { TimelineApiService } from '../../services/timeline-api.service';
import { authorLabel } from '../../utils/timeline-actor';

const RECORD_ERROR = 'No se pudieron consultar los datos de la cancelación.';

/**
 * Quién canceló, cuándo y por qué, según el evento `PEDIDO_CANCELADO` del historial (#112): ni
 * el pedido ni el resumen lo traen. Usa lo que ya cargó la página y, si el evento está en una
 * página posterior, la busca.
 */
@Component({
  selector: 'app-cancellation-record',
  imports: [DatePipe, ErrorAlertComponent, LoadingStateComponent],
  template: `
    <section class="offers__card" aria-labelledby="cancellation-record-title">
      <h2 id="cancellation-record-title" class="offers__subtitle">Cancelación</h2>
      @if (loading()) {
        <app-loading-state message="Consultando los datos de la cancelación…" />
      } @else if (errorMessage(); as message) {
        <app-error-alert [message]="message" (retry)="retry()" />
      } @else if (record(); as data) {
        <dl class="offers__data">
          <div>
            <dt>Cancelado por</dt>
            <dd>{{ data.who }}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{{ data.at | date: 'dd/MM/yyyy HH:mm' : timezone }}</dd>
          </div>
          @if (data.previousStatus) {
            <div>
              <dt>Estado anterior</dt>
              <dd>{{ data.previousStatus }}</dd>
            </div>
          }
          <div class="record__reason">
            <dt>Motivo</dt>
            <dd>{{ data.reason ?? 'No disponible' }}</dd>
          </div>
        </dl>
      } @else {
        <p class="offers__muted">El historial no registra los datos de la cancelación.</p>
      }
    </section>
  `,
  styleUrl: '../../../offers/offer-pages.scss',
  styles: `
    .record__reason {
      grid-column: 1 / -1;

      dd {
        white-space: pre-line;
      }
    }
  `,
})
export class CancellationRecordComponent {
  private readonly store = inject(ServiceWorkStore);
  private readonly timelineApi = inject(TimelineApiService);

  readonly viewer = input.required<OfferParty | null>();

  protected readonly timezone = DISPLAY_TIMEZONE;

  private readonly loaded = computed(() => this.store.events().find(isCancellation) ?? null);
  /** Solo se pide si lo cargado no lo trae y quedan páginas. */
  private readonly later = rxResource({
    params: () => {
      const orderId = this.store.requestedOrderId();
      const cursor = this.store.nextCursor();
      const missing = this.loaded() === null && !this.store.timelineReloading();
      return missing && orderId !== undefined && cursor !== null ? { orderId, cursor } : undefined;
    },
    stream: ({ params }) => this.timelineApi.findCancellation(params.orderId, params.cursor),
  });

  protected readonly loading = computed(
    () =>
      this.loaded() === null &&
      (this.store.requestedOrderId() === undefined ||
        this.store.timelineReloading() ||
        this.later.isLoading()),
  );
  protected readonly errorMessage = computed(() => {
    const error = this.store.timelineError() ?? this.later.error();
    if (this.loaded() !== null || error === undefined || error === null) {
      return null;
    }
    return typeof error === 'string' ? error : apiErrorMessages(error, RECORD_ERROR).join(' ');
  });

  protected readonly record = computed(() => {
    const event = this.loaded() ?? (this.later.hasValue() ? this.later.value() : null);
    if (event === null) {
      return null;
    }
    const reason = event.details?.['reason'];
    const from = event.details?.['fromStatus'];
    return {
      who: authorLabel(event.actor, this.viewer()),
      at: event.at,
      reason: typeof reason === 'string' && reason !== '' ? reason : null,
      previousStatus:
        typeof from === 'string' && isOrderStatus(from) ? ORDER_STATUS_LABELS[from] : null,
    };
  });

  protected retry(): void {
    if (this.store.timelineError() !== null) {
      this.store.refresh();
    } else {
      this.later.reload();
    }
  }
}
