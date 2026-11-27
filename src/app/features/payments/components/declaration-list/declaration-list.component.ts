import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OfferParty } from '../../../offers/models/offer.model';
import {
  CONCEPT_LABELS,
  METHOD_LABELS,
  PARTY_LABELS,
  PaymentConcept,
  PaymentDeclaration,
} from '../../models/payment.model';

/** Lo que declaró cada parte, tal como lo registró el backend. */
@Component({
  selector: 'app-declaration-list',
  imports: [DatePipe],
  template: `
    <ul class="declarations">
      @for (item of declarations(); track item.id) {
        <li>
          @if (item.concept) {
            <span>{{ concepts[item.concept] }} · </span>
          }
          <strong>
            {{ parties[item.declaredBy] }}
            @if (item.declaredBy === viewer()) {
              (usted)
            }
          </strong>
          declaró Bs {{ item.amount }} · {{ methods[item.method] }} ·
          {{ item.createdAt | date: 'dd/MM/yyyy HH:mm' : timezone }}
        </li>
      }
    </ul>
  `,
  styles: `
    @use 'tokens';

    :host {
      display: block;
    }

    .declarations {
      display: grid;
      gap: tokens.$space-1;
      margin: 0;
      padding: tokens.$space-2 0 0;
      border-top: 1px solid var(--color-border);
      list-style: none;
      font-size: 0.9375rem;
    }
  `,
})
export class DeclarationListComponent {
  /** Con `concept` cuando la lista mezcla pagos distintos. */
  readonly declarations =
    input.required<readonly (PaymentDeclaration & { concept?: PaymentConcept })[]>();
  /** Quién mira, para señalar sus declaraciones; `null` si no es una de las partes. */
  readonly viewer = input.required<OfferParty | null>();

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly concepts = CONCEPT_LABELS;
  protected readonly methods = METHOD_LABELS;
  protected readonly parties = PARTY_LABELS;
}
