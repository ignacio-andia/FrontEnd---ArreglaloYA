import { Component, input } from '@angular/core';
import { OrderWarning } from '../../models/order.model';

const WARNING_TITLES: Readonly<Record<OrderWarning['code'], string>> = {
  POSIBLE_DUPLICADO: 'Posible pedido repetido',
  POSIBLE_DATO_PERSONAL: 'Posibles datos personales en la descripción',
};

/**
 * Avisos orientativos del backend (`OrderWarning`). Se muestran con el texto del servidor y
 * nunca bloquean la publicación: el usuario decide si corrige los datos o continúa.
 */
@Component({
  selector: 'app-order-warnings',
  template: `
    <section class="warnings" [attr.aria-labelledby]="headingId()">
      <h3 class="warnings__title" [id]="headingId()">{{ heading() }}</h3>
      <ul class="warnings__list">
        @for (warning of warnings(); track warning.code) {
          <li class="warnings__item">
            <strong class="warnings__code">{{ titles[warning.code] }}</strong>
            <p>{{ warning.message }}</p>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    @use 'tokens';

    :host {
      display: block;
    }

    .warnings {
      display: grid;
      gap: tokens.$space-2;
      padding: tokens.$space-4;
      border: 1px solid #f0d58a;
      border-left: 4px solid #b54708;
      border-radius: tokens.$radius-md;
      background-color: #fffaeb;
    }

    .warnings__title {
      color: #7a2e0e;
      font-size: 1rem;
    }

    .warnings__list {
      display: grid;
      gap: tokens.$space-2;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .warnings__code {
      color: #7a2e0e;
    }
  `,
})
export class OrderWarningsComponent {
  readonly warnings = input.required<readonly OrderWarning[]>();
  readonly heading = input('Revise estos avisos');
  readonly headingId = input('order-warnings-title');

  protected readonly titles = WARNING_TITLES;
}
