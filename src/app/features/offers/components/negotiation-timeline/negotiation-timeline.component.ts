import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import {
  OFFER_EVENT_LABELS,
  OFFER_EVENT_RESULT,
  OFFER_REASON_LABELS,
  OFFER_STATUS_LABELS,
  OfferEvent,
  OfferParty,
} from '../../models/offer.model';

type Author = 'worker' | 'client' | 'system';

/**
 * Historial de la negociación tal como lo devuelve el backend (del más antiguo al más reciente):
 * quién hizo qué, con qué monto, cuándo y en qué estado quedó la oferta. El monto anterior es el
 * del evento con monto que lo precede.
 */
@Component({
  selector: 'app-negotiation-timeline',
  imports: [DatePipe],
  templateUrl: './negotiation-timeline.component.html',
  styleUrl: './negotiation-timeline.component.scss',
})
export class NegotiationTimelineComponent {
  readonly history = input.required<readonly OfferEvent[]>();
  /** Quién está mirando, para identificar sus propias acciones. */
  readonly viewer = input.required<OfferParty>();

  protected readonly timezone = DISPLAY_TIMEZONE;

  protected readonly entries = computed(() => {
    let previous: string | null = null;
    return this.history().map((event) => {
      const entry = {
        event,
        author: authorOf(event),
        who: this.authorName(event),
        action: OFFER_EVENT_LABELS[event.type],
        result: OFFER_STATUS_LABELS[OFFER_EVENT_RESULT[event.type]],
        previous: event.amount === null ? null : previous,
        reason: event.reason === null ? null : (OFFER_REASON_LABELS[event.reason] ?? event.reason),
      };
      previous = event.amount ?? previous;
      return entry;
    });
  });

  private authorName(event: OfferEvent): string {
    if (event.actorType === 'SISTEMA') {
      return 'Sistema';
    }
    const name = event.actorRole === 'CLIENTE' ? 'Cliente' : 'Trabajador';
    return event.actorRole === this.viewer() ? `${name} (usted)` : name;
  }
}

function authorOf(event: OfferEvent): Author {
  if (event.actorType === 'SISTEMA') {
    return 'system';
  }
  return event.actorRole === 'CLIENTE' ? 'client' : 'worker';
}
