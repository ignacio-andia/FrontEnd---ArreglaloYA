import { Component, computed, input } from '@angular/core';
import { OFFER_STATUS_LABELS, OfferStatus } from '../../models/offer.model';

/** Estado de la oferta con su etiqueta. El texto, no solo el color, transmite el estado. */
@Component({
  selector: 'app-offer-status-badge',
  template: `<span [class]="'badge badge--' + status().toLowerCase()">{{ label() }}</span>`,
  styles: `
    @use 'tokens';

    .badge {
      display: inline-block;
      padding: 0.125rem tokens.$space-2;
      border: 1px solid transparent;
      border-radius: 999px;
      font-size: 0.8125rem;
      font-weight: tokens.$font-weight-semibold;
      white-space: nowrap;
    }

    .badge--vigente {
      border-color: var(--color-primary);
      background-color: var(--color-primary-pale);
      color: var(--color-primary-dark);
    }

    .badge--aceptada {
      border-color: var(--color-primary-dark);
      background-color: var(--color-primary-dark);
      color: #fff;
    }

    .badge--rechazada {
      border-color: var(--color-danger);
      background-color: var(--color-surface);
      color: var(--color-danger);
    }

    .badge--retirada {
      border-color: var(--color-control-border);
      background-color: var(--color-surface);
      color: var(--color-text);
    }

    .badge--vencida {
      border-color: #b54708;
      background-color: #fffaeb;
      color: #7a2e0e;
    }

    .badge--sin_efecto {
      border-style: dashed;
      border-color: var(--color-control-border);
      background-color: var(--color-background);
      color: var(--color-text);
    }
  `,
})
export class OfferStatusBadgeComponent {
  readonly status = input.required<OfferStatus>();
  protected readonly label = computed(() => OFFER_STATUS_LABELS[this.status()]);
}
