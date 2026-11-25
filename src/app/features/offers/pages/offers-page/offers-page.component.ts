import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, expand, last, of, scan } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OrdersApiService } from '../../../orders/services/orders-api.service';
import { OfferStatusBadgeComponent } from '../../components/offer-status-badge/offer-status-badge.component';
import {
  OFFER_STATUSES,
  OFFER_STATUS_LABELS,
  Offer,
  OfferParty,
  OfferStatus,
  ReceivedOffer,
  isOfferStatus,
} from '../../models/offer.model';
import { OffersApiService } from '../../services/offers-api.service';

export const OFFERS_PAGE_SIZE = 12;
/** Tamaño de página al buscar los pedidos que titulan las ofertas (máximo del backend). */
const ORDER_TITLES_PAGE_SIZE = 50;
const LIST_ERROR = 'No se pudieron cargar las ofertas.';

type ListedOffer = Offer & Partial<Pick<ReceivedOffer, 'worker'>>;

/**
 * Listado de ofertas: recibidas por el cliente (`GET /offers/received`) o enviadas por el
 * trabajador (`GET /offers/me`), según `party` en la ruta. El filtro, el pedido y la página viven
 * en la URL (`?estado=&pedido=&pagina=`).
 */
@Component({
  selector: 'app-offers-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    OfferStatusBadgeComponent,
    PaginatorComponent,
  ],
  templateUrl: './offers-page.component.html',
  styleUrls: ['../../offer-pages.scss', './offers-page.component.scss'],
})
export class OffersPageComponent {
  private readonly offersApi = inject(OffersApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly party = this.route.snapshot.data['party'] as OfferParty;
  protected readonly isClient = this.party === 'CLIENTE';
  protected readonly statuses = OFFER_STATUSES;
  protected readonly statusLabels = OFFER_STATUS_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;

  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });

  protected readonly status = computed((): OfferStatus | null => {
    const value = this.query().get('estado');
    return value !== null && isOfferStatus(value) ? value : null;
  });
  protected readonly orderId = computed(() => (this.isClient ? this.query().get('pedido') : null));
  protected readonly page = computed(() => {
    const value = Number(this.query().get('pagina'));
    return Number.isInteger(value) && value >= 1 ? value : 1;
  });

  protected readonly offers = rxResource({
    params: () => ({ status: this.status(), orderId: this.orderId(), page: this.page() }),
    stream: ({ params }) => {
      const query = {
        ...(params.status !== null ? { status: params.status } : {}),
        ...(params.orderId !== null ? { orderId: params.orderId } : {}),
        page: params.page,
        limit: OFFERS_PAGE_SIZE,
      };
      return this.isClient ? this.offersApi.listReceived(query) : this.offersApi.listOwn(query);
    },
  });

  protected readonly meta = computed(() =>
    this.offers.hasValue() ? this.offers.value().meta : null,
  );
  protected readonly items = computed((): readonly ListedOffer[] =>
    this.offers.hasValue() ? this.offers.value().data : [],
  );
  /** Pedidos de la página mostrada, como texto para no repetir la búsqueda sin cambios. */
  private readonly orderIds = computed(() =>
    [...new Set(this.items().map((offer) => offer.orderId))].join(),
  );

  /**
   * Categoría de cada pedido para titular las tarjetas (la oferta solo trae su id). Se recorren
   * las páginas de pedidos hasta encontrar los mostrados. Es orientativo: el trabajador no puede
   * consultar los que dejaron de estar disponibles y esas tarjetas se titulan de forma genérica.
   */
  private readonly orderTitles = rxResource({
    params: () => this.orderIds() || undefined,
    stream: ({ params }) => {
      const wanted = params.split(',');
      const page = (number: number) => {
        const query = { page: number, limit: ORDER_TITLES_PAGE_SIZE };
        return this.isClient ? this.ordersApi.listOwn(query) : this.ordersApi.listAvailable(query);
      };
      return page(1).pipe(
        expand(({ data, meta }) => {
          wanted.splice(0, wanted.length, ...wanted.filter((id) => !data.some((o) => o.id === id)));
          return wanted.length === 0 || meta.page >= meta.totalPages ? EMPTY : page(meta.page + 1);
        }),
        scan((titles, { data }) => {
          data.forEach((order) => titles.set(order.id, order.category.name));
          return titles;
        }, new Map<string, string>()),
        last(),
        catchError(() => of(new Map<string, string>())),
      );
    },
  });

  protected readonly errorMessage = computed(() => {
    const error = this.offers.error();
    return error === undefined ? null : apiErrorMessages(error, LIST_ERROR).join(' ');
  });

  protected readonly statusFilter = new FormControl<OfferStatus | ''>('', { nonNullable: true });

  constructor() {
    effect(() => this.statusFilter.setValue(this.status() ?? '', { emitEvent: false }));
    this.statusFilter.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((status) => this.navigate({ estado: status || null, pagina: null }));
  }

  protected title(offer: ListedOffer): string {
    const titles = this.orderTitles.hasValue() ? this.orderTitles.value() : null;
    return titles?.get(offer.orderId) ?? 'Pedido';
  }

  /** La oferta está vigente y le toca responder a quien mira. */
  protected needsReply(offer: ListedOffer): boolean {
    return offer.status === 'VIGENTE' && offer.turn === this.party;
  }

  protected goToPage(page: number): void {
    this.navigate({ pagina: page > 1 ? page : null });
  }

  protected showAll(): void {
    this.navigate({ estado: null, pedido: null, pagina: null });
  }

  private navigate(queryParams: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
