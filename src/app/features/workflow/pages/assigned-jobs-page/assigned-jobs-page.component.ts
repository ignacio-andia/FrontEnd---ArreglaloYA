import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Observable,
  Subject,
  catchError,
  from,
  map,
  merge,
  mergeMap,
  of,
  scan,
  startWith,
  switchMap,
} from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { Offer } from '../../../offers/models/offer.model';
import { OffersApiService } from '../../../offers/services/offers-api.service';
import { OrderStatusBadgeComponent } from '../../../orders/components/order-status-badge/order-status-badge.component';
import { AssignedOrder, OrderStatus } from '../../../orders/models/order.model';
import { OrdersApiService } from '../../../orders/services/orders-api.service';
import { SERVICE_AGREEMENT_STATUSES } from '../../models/workflow.model';
import { WorkflowApiService } from '../../services/workflow-api.service';

export const JOBS_PAGE_SIZE = 12;
/** Consultas de detalle simultáneas como máximo (cada tarjeta hace las suyas en serie). */
export const JOBS_CONCURRENCY = 4;

const LIST_ERROR = 'No se pudieron cargar sus trabajos.';
const CARD_ERROR = 'No se pudo consultar este trabajo.';
const RESTRICTED = 'Los datos del pedido no están disponibles para su cuenta en este momento.';

type JobDetail =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | {
      state: 'ready';
      status: OrderStatus;
      /** Solo con el acuerdo vigente y autorización del backend. */
      order: AssignedOrder | null;
      note: string | null;
    };

const LOADING: JobDetail = { state: 'loading' };

/**
 * «Trabajos asignados»: no hay un listado propio en el backend, así que son las ofertas aceptadas
 * (`GET /offers/me?status=ACEPTADA`), que se conservan aunque el pedido se cierre o se cancele.
 * Cada tarjeta consulta el estado (#82) y, con el acuerdo vigente, el pedido (#80): como mucho
 * dos consultas por tarjeta, y un fallo solo afecta a la suya.
 */
@Component({
  selector: 'app-assigned-jobs-page',
  imports: [
    DatePipe,
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    OrderStatusBadgeComponent,
    PaginatorComponent,
  ],
  templateUrl: './assigned-jobs-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss', './assigned-jobs-page.component.scss'],
})
export class AssignedJobsPageComponent {
  private readonly offersApi = inject(OffersApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly timezone = DISPLAY_TIMEZONE;
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly retries = new Subject<Offer>();

  protected readonly page = computed(() => {
    const value = Number(this.query().get('pagina'));
    return Number.isInteger(value) && value >= 1 ? value : 1;
  });

  protected readonly jobs = rxResource({
    params: () => this.page(),
    stream: ({ params }) =>
      this.offersApi.listOwn({ status: 'ACEPTADA', page: params, limit: JOBS_PAGE_SIZE }).pipe(
        switchMap(({ data, meta }) =>
          merge(from(data), this.retries).pipe(
            mergeMap((offer) => this.loadDetail(offer), JOBS_CONCURRENCY),
            scan(
              (details, [offerId, detail]) => new Map(details).set(offerId, detail),
              new Map<string, JobDetail>(),
            ),
            startWith(new Map<string, JobDetail>()),
            map((details) => ({ offers: data, meta, details })),
          ),
        ),
      ),
  });

  protected readonly meta = computed(() => (this.jobs.hasValue() ? this.jobs.value().meta : null));
  protected readonly cards = computed(() => {
    if (!this.jobs.hasValue()) {
      return [];
    }
    const { offers, details } = this.jobs.value();
    return offers.map((offer) => ({ offer, detail: details.get(offer.id) ?? LOADING }));
  });
  protected readonly errorMessage = computed(() => {
    const error = this.jobs.error();
    return error === undefined ? null : apiErrorMessages(error, LIST_ERROR).join(' ');
  });

  protected retry(offer: Offer): void {
    this.retries.next(offer);
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { pagina: page > 1 ? page : null },
      queryParamsHandling: 'merge',
    });
  }

  private loadDetail(offer: Offer): Observable<readonly [string, JobDetail]> {
    return this.workflowApi.get(offer.orderId).pipe(
      switchMap(({ status }): Observable<JobDetail> => {
        if (!SERVICE_AGREEMENT_STATUSES.includes(status)) {
          return of({ state: 'ready', status, order: null, note: null });
        }
        return this.ordersApi.getAssigned(offer.orderId).pipe(
          map((order): JobDetail => ({ state: 'ready', status, order, note: null })),
          catchError(() =>
            of<JobDetail>({ state: 'ready', status, order: null, note: RESTRICTED }),
          ),
        );
      }),
      catchError((error: unknown) =>
        of<JobDetail>({
          state: 'error',
          message: apiErrorMessages(error, CARD_ERROR).join(' '),
        }),
      ),
      startWith(LOADING),
      map((detail) => [offer.id, detail] as const),
    );
  }
}
