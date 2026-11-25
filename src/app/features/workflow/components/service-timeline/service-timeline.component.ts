import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OFFER_REASON_LABELS, OfferParty } from '../../../offers/models/offer.model';
import { ORDER_STATUS_LABELS, isOrderStatus } from '../../../orders/models/order.model';
import { TimelineActor, TimelineEvent } from '../../models/timeline.model';

type Author = 'worker' | 'client' | 'admin' | 'system';

const AUTHOR_LABELS: Readonly<Record<Author, string>> = {
  worker: 'Trabajador',
  client: 'Cliente',
  admin: 'Administrador',
  system: 'Sistema',
};

const METHOD_LABELS: Readonly<Partial<Record<string, string>>> = {
  EFECTIVO: 'Efectivo',
  QR: 'QR',
};

/**
 * Historial del servicio, del acontecimiento más antiguo al más reciente. Cada entrada es un
 * evento del backend: su texto, su autor, su fecha y los datos que traiga.
 */
@Component({
  selector: 'app-service-timeline',
  imports: [DatePipe, ErrorAlertComponent],
  templateUrl: './service-timeline.component.html',
  styleUrl: './service-timeline.component.scss',
})
export class ServiceTimelineComponent {
  readonly events = input.required<readonly TimelineEvent[]>();
  /** Quién mira, para señalar sus propias acciones. */
  readonly viewer = input.required<OfferParty>();
  readonly hasMore = input(false);
  readonly loadingMore = input(false);
  readonly error = input<string | null>(null);

  readonly loadMore = output();

  protected readonly timezone = DISPLAY_TIMEZONE;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Cuántos había al pedir más: el foco pasa al primero de los nuevos. */
  private readonly shownBefore = signal<number | null>(null);

  protected readonly entries = computed(() =>
    this.events().map((event) => {
      const author = authorOf(event.actor);
      const own = author === (this.viewer() === 'CLIENTE' ? 'client' : 'worker');
      return {
        key: `${event.source}:${event.id}:${event.type}`,
        event,
        author,
        who: own ? `${AUTHOR_LABELS[author]} (usted)` : AUTHOR_LABELS[author],
        status: relatedStatus(event),
        details: describe(event),
      };
    }),
  );

  constructor() {
    // El botón se deshabilita u oculta al cargar: sin esto el foco del teclado se perdería.
    afterRenderEffect(() => {
      const from = this.shownBefore();
      if (from === null || this.entries().length <= from) {
        return;
      }
      this.host.nativeElement.querySelectorAll<HTMLElement>('.line__item')[from]?.focus();
      this.shownBefore.set(null);
    });
  }

  protected more(): void {
    this.shownBefore.set(this.entries().length);
    this.loadMore.emit();
  }
}

function authorOf(actor: TimelineActor): Author {
  if (actor.type === 'SISTEMA') {
    return 'system';
  }
  switch (actor.role) {
    case 'TRABAJADOR':
      return 'worker';
    case 'CLIENTE':
      return 'client';
    case 'ADMINISTRADOR':
      return 'admin';
    default:
      return 'system';
  }
}

/** Estado del pedido que el propio acontecimiento declara; no se deduce ninguno. */
function relatedStatus(event: TimelineEvent): string | null {
  const status = event.details?.['toStatus'];
  return typeof status === 'string' && isOrderStatus(status) ? ORDER_STATUS_LABELS[status] : null;
}

function describe(event: TimelineEvent): { label: string; value: string; date?: boolean }[] {
  const details = event.details ?? {};
  const text = (key: string): string | null => {
    const value = details[key];
    return typeof value === 'string' && value !== '' ? value : null;
  };
  const rows: { label: string; value: string; date?: boolean }[] = [];
  const add = (label: string, value: string | null, date = false): void => {
    if (value !== null) {
      rows.push({ label, value, date });
    }
  };
  const reason = text('reason');
  add('Motivo', reason === null ? null : (OFFER_REASON_LABELS[reason] ?? reason));
  add('Descripción', text('description'));
  add('Materiales', text('materials'));
  const method = text('method');
  add('Método', method === null ? null : (METHOD_LABELS[method] ?? method));
  const visitCost = text('visitCost');
  add('Costo de la visita', visitCost === null ? null : `Bs ${visitCost}`);
  add('Vence', text('deadline'), true);
  return rows;
}
