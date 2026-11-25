import { DatePipe, Location } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, map } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { WorkerOrder } from '../../../orders/models/order.model';
import { OrdersApiService } from '../../../orders/services/orders-api.service';
import { AssignedOrderComponent } from '../../components/assigned-order/assigned-order.component';
import { NegotiationTimelineComponent } from '../../components/negotiation-timeline/negotiation-timeline.component';
import {
  OfferActionResult,
  OfferActionsComponent,
} from '../../components/offer-actions/offer-actions.component';
import { OfferStatusBadgeComponent } from '../../components/offer-status-badge/offer-status-badge.component';
import { WhatsappContactComponent } from '../../components/whatsapp-contact/whatsapp-contact.component';
import {
  OFFER_CLOSED_DESCRIPTIONS,
  OFFER_MAX_ROUNDS,
  OfferDetail,
  OfferParty,
  ReceivedOffer,
  formatDuration,
} from '../../models/offer.model';
import { OffersApiService } from '../../services/offers-api.service';

const LOAD_ERROR = 'No se pudo cargar la oferta.';

type Detail = OfferDetail & Partial<Pick<ReceivedOffer, 'worker'>>;

/**
 * Detalle y negociación de una oferta, para el cliente (`GET /offers/received/:id`) o el
 * trabajador (`GET /offers/me/:id`) según `party` en la ruta. El estado, el turno y el
 * vencimiento son siempre los que devuelve el backend: no hay temporizadores locales.
 */
@Component({
  selector: 'app-offer-detail-page',
  imports: [
    DatePipe,
    RouterLink,
    AssignedOrderComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    NegotiationTimelineComponent,
    OfferActionsComponent,
    OfferStatusBadgeComponent,
    WhatsappContactComponent,
  ],
  templateUrl: './offer-detail-page.component.html',
  styleUrls: ['../../offer-pages.scss', './offer-detail-page.component.scss'],
})
export class OfferDetailPageComponent {
  private readonly offersApi = inject(OffersApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly party = this.route.snapshot.data['party'] as OfferParty;
  protected readonly isClient = this.party === 'CLIENTE';
  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly maxRounds = OFFER_MAX_ROUNDS;
  protected readonly duration = formatDuration;
  protected readonly listPath = this.isClient ? '/cliente/ofertas' : '/trabajador/ofertas';

  /** Se llega desde la creación de la oferta. */
  protected readonly justCreated = isOfferCreated(
    inject(Router).currentNavigation()?.extras.state ?? inject(Location).getState(),
  );

  private readonly offerId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('offerId') ?? '')),
    { requireSync: true },
  );

  protected readonly offer = rxResource({
    params: () => this.offerId() || undefined,
    stream: ({ params }): Observable<Detail> =>
      this.isClient ? this.offersApi.getReceived(params) : this.offersApi.getOwn(params),
  });

  protected readonly current = computed(() => (this.offer.hasValue() ? this.offer.value() : null));

  /**
   * Pedido de la oferta: el cliente consulta el suyo; el trabajador, el disponible mientras puede
   * verlo (el acordado se muestra aparte).
   */
  protected readonly order = rxResource({
    params: () => {
      const offer = this.current();
      if (offer === null || (!this.isClient && offer.status === 'ACEPTADA')) {
        return undefined;
      }
      return offer.orderId;
    },
    stream: ({ params }): Observable<Pick<WorkerOrder, 'category' | 'zone' | 'description'>> =>
      this.isClient ? this.ordersApi.getOwn(params) : this.ordersApi.getAvailable(params),
  });

  protected readonly turnMessage = computed(() => {
    const offer = this.current();
    if (offer === null) {
      return '';
    }
    if (offer.status !== 'VIGENTE') {
      return OFFER_CLOSED_DESCRIPTIONS[offer.status];
    }
    if (offer.turn === this.party) {
      return 'Le toca responder a usted.';
    }
    return `Le toca responder al ${offer.turn === 'CLIENTE' ? 'cliente' : 'trabajador'}.`;
  });

  protected readonly waiting = computed(() => {
    const offer = this.current();
    return offer !== null && !(offer.status === 'VIGENTE' && offer.turn === this.party);
  });

  /** El backend solo entrega el contacto con la negociación abierta o el acuerdo vigente. */
  protected readonly contactPossible = computed(() => {
    const status = this.current()?.status;
    return status === 'VIGENTE' || status === 'ACEPTADA';
  });

  protected readonly notFound = computed(() => {
    const status = apiErrorStatus(this.offer.error());
    return status === 404 || status === 400;
  });
  protected readonly errorMessage = computed(() => {
    const error = this.offer.error();
    return error === undefined || this.notFound()
      ? null
      : apiErrorMessages(error, LOAD_ERROR).join(' ');
  });

  protected readonly success = signal<string | null>(null);
  protected readonly actionErrors = signal<string[]>([]);

  protected onDone(result: OfferActionResult): void {
    this.offer.set(result.offer);
    this.success.set(result.message);
    this.focusAfterRender('#offer-success');
  }

  protected onFailed(messages: string[]): void {
    this.actionErrors.set(messages);
    if (messages.length > 0) {
      this.success.set(null);
      this.focusAfterRender('#offer-action-error');
    }
  }

  protected refresh(): void {
    this.offer.reload();
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

function isOfferCreated(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'offerCreated' in state;
}
