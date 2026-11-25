import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { OrderStatus } from '../../../orders/models/order.model';
import { OffersApiService } from '../../services/offers-api.service';

/** Estados en los que existe (o existió) una oferta aceptada que identifica al asignado. */
const ASSIGNED_STATUSES: readonly OrderStatus[] = [
  'ACORDADO',
  'ANTICIPO_REGISTRADO',
  'VISITA_REALIZADA',
  'PRESUPUESTO_ADICIONAL_PENDIENTE',
  'EN_EJECUCION',
  'TERMINADO',
  'EN_RECLAMO',
  'CERRADO',
];

const ERROR = 'No se pudo consultar el trabajador asignado.';

/**
 * En el detalle de un pedido propio: acceso a sus ofertas mientras se negocia y, con acuerdo, el
 * trabajador asignado, tomado de la oferta `ACEPTADA` que devuelve el backend.
 */
@Component({
  selector: 'app-order-offers',
  imports: [RouterLink, LoadingStateComponent],
  template: `
    @if (negotiating()) {
      <section class="block" aria-labelledby="order-offers-title">
        <h2 id="order-offers-title" class="block__title">Ofertas</h2>
        <a class="block__link" routerLink="/cliente/ofertas" [queryParams]="{ pedido: orderId() }">
          Ver las ofertas de este pedido
        </a>
      </section>
    } @else if (assigned()) {
      <section class="block" aria-labelledby="order-offers-title">
        <h2 id="order-offers-title" class="block__title">Trabajador asignado</h2>
        @if (accepted.isLoading()) {
          <app-loading-state message="Consultando el trabajador asignado…" />
        } @else if (errorMessage(); as message) {
          <p class="block__muted">{{ message }}</p>
        } @else if (offer(); as offer) {
          <p>
            <strong>{{ offer.worker.firstName }} {{ offer.worker.lastName }}</strong> · Monto
            acordado: Bs {{ offer.amount }}
          </p>
          <a class="block__link" [routerLink]="['/cliente/ofertas', offer.id]">
            Ver la oferta, su historial y el contacto
          </a>
        } @else {
          <p class="block__muted">No hay una oferta aceptada para mostrar.</p>
        }
      </section>
    }
  `,
  styles: `
    @use 'tokens';
    @use 'page';
    @use 'buttons';

    :host {
      display: block;
    }

    :host:empty {
      display: none;
    }

    .block {
      display: grid;
      justify-items: start;
      gap: tokens.$space-3;
      padding: tokens.$space-6 tokens.$space-4;
      border: 1px solid var(--color-primary);
      border-radius: tokens.$radius-lg;
      background-color: var(--color-surface);
    }

    .block__title {
      @include page.subtitle;
    }

    .block__link {
      @include buttons.secondary;
    }

    .block__muted {
      color: var(--color-text-secondary);
    }
  `,
})
export class OrderOffersComponent {
  private readonly offersApi = inject(OffersApiService);

  readonly orderId = input.required<string>();
  readonly status = input.required<OrderStatus>();

  protected readonly negotiating = computed(
    () => this.status() === 'PUBLICADO' || this.status() === 'EN_NEGOCIACION',
  );
  protected readonly assigned = computed(() => ASSIGNED_STATUSES.includes(this.status()));

  protected readonly accepted = rxResource({
    params: () => (this.assigned() ? this.orderId() : undefined),
    stream: ({ params }) =>
      this.offersApi.listReceived({ orderId: params, status: 'ACEPTADA', limit: 1 }),
  });
  protected readonly offer = computed(() =>
    this.accepted.hasValue() ? (this.accepted.value().data[0] ?? null) : null,
  );
  protected readonly errorMessage = computed(() => {
    const error = this.accepted.error();
    return error === undefined ? null : apiErrorMessages(error, ERROR).join(' ');
  });
}
