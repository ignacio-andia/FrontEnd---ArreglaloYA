import { Component, inject, input } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { OfferParty } from '../../../offers/models/offer.model';
import { ServiceWorkStore } from '../../services/service-work.store';
import { ServiceTimelineComponent } from '../service-timeline/service-timeline.component';

/** Sección «Historial» de una página de seguimiento, alimentada por su `ServiceWorkStore`. */
@Component({
  selector: 'app-service-history',
  imports: [
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    ServiceTimelineComponent,
  ],
  template: `
    <section class="offers__card" aria-labelledby="history-title">
      <h2 id="history-title" class="offers__subtitle">Historial del servicio</h2>
      @if (store.timelineLoading()) {
        <app-loading-state message="Cargando el historial…" />
      } @else if (store.timelineError(); as message) {
        <app-error-alert [message]="message" (retry)="store.refresh()" />
      } @else if (store.events().length === 0) {
        <app-empty-state heading="Todavía no hay acontecimientos registrados." />
      } @else {
        <app-service-timeline
          [events]="store.events()"
          [viewer]="viewer()"
          [hasMore]="store.nextCursor() !== null"
          [loadingMore]="store.loadingMore()"
          [error]="store.moreError()"
          (loadMore)="store.loadMore()"
        />
      }
    </section>
  `,
  styleUrl: '../../../offers/offer-pages.scss',
})
export class ServiceHistoryComponent {
  protected readonly store = inject(ServiceWorkStore);

  readonly viewer = input.required<OfferParty | null>();
}
