import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { OrderGalleryComponent } from '../../../orders/components/order-gallery/order-gallery.component';
import { OrdersApiService } from '../../../orders/services/orders-api.service';

const ASSIGNED_ERROR = 'Los datos del pedido acordado no están disponibles.';

/**
 * Pedido acordado para el trabajador asignado (`GET /orders/assigned/:orderId`): cliente,
 * dirección exacta y fotografías. El backend solo los entrega con el acuerdo vigente.
 */
@Component({
  selector: 'app-assigned-order',
  imports: [LoadingStateComponent, OrderGalleryComponent],
  template: `
    <section class="assigned" aria-labelledby="assigned-title">
      <h2 id="assigned-title" class="assigned__title">Trabajo acordado</h2>
      @if (order.isLoading() && !order.hasValue()) {
        <app-loading-state message="Cargando el pedido acordado…" />
      } @else if (errorMessage(); as message) {
        <p class="assigned__muted">{{ message }}</p>
      } @else if (order.hasValue()) {
        @let current = order.value();
        <p class="assigned__muted">Usted es el trabajador asignado a este pedido.</p>
        <dl class="assigned__data">
          @if (showService()) {
            <div>
              <dt>Categoría</dt>
              <dd>{{ current.category.name }}</dd>
            </div>
            <div>
              <dt>Zona</dt>
              <dd>{{ current.zone.name }}</dd>
            </div>
          }
          <div>
            <dt>Cliente</dt>
            <dd>{{ current.client.firstName }} {{ current.client.lastName }}</dd>
          </div>
          @if (current.address; as address) {
            <div>
              <dt>Dirección exacta</dt>
              <dd>{{ address.addressLine }}</dd>
            </div>
            @if (address.reference) {
              <div>
                <dt>Referencia</dt>
                <dd>{{ address.reference }}</dd>
              </div>
            }
          }
          <div>
            <dt>Descripción</dt>
            <dd>{{ current.description }}</dd>
          </div>
        </dl>
        <app-order-gallery source="assigned" [orderId]="current.id" [images]="current.images" />
      }
    </section>
  `,
  styles: `
    @use 'tokens';
    @use 'page';

    :host {
      display: block;
    }

    .assigned {
      display: grid;
      gap: tokens.$space-3;
      padding: tokens.$space-6;
      border: 1px solid var(--color-primary);
      border-radius: tokens.$radius-lg;
      background-color: var(--color-surface);
    }

    .assigned__title {
      @include page.subtitle;
    }

    .assigned__muted {
      color: var(--color-text-secondary);
    }

    .assigned__data {
      display: grid;
      gap: tokens.$space-3;
      margin: 0;

      dt {
        color: var(--color-text-secondary);
        font-size: 0.875rem;
      }

      dd {
        margin: 0;
        font-weight: tokens.$font-weight-medium;
        overflow-wrap: anywhere;
      }
    }
  `,
})
export class AssignedOrderComponent {
  private readonly ordersApi = inject(OrdersApiService);

  readonly orderId = input.required<string>();
  /** Muestra también la categoría y la zona, donde la página no las indica. */
  readonly showService = input(false);

  protected readonly order = rxResource({
    params: () => this.orderId(),
    stream: ({ params }) => this.ordersApi.getAssigned(params),
  });

  protected readonly errorMessage = computed(() => {
    const error = this.order.error();
    return error === undefined ? null : apiErrorMessages(error, ASSIGNED_ERROR).join(' ');
  });
}
