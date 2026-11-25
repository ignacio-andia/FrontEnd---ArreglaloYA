import { Component, computed, input } from '@angular/core';
import { ORDER_STATUS_LABELS, OrderStatus } from '../../models/order.model';

type StatusTone = 'open' | 'agreed' | 'closed' | 'ended';

/** Grupo visual de cada estado: solo cambia el aspecto, nunca la lógica. */
const STATUS_TONES: Readonly<Record<OrderStatus, StatusTone>> = {
  PUBLICADO: 'open',
  EN_NEGOCIACION: 'open',
  ACORDADO: 'agreed',
  ANTICIPO_REGISTRADO: 'agreed',
  VISITA_REALIZADA: 'agreed',
  PRESUPUESTO_ADICIONAL_PENDIENTE: 'agreed',
  EN_EJECUCION: 'agreed',
  EN_RECLAMO: 'agreed',
  TERMINADO: 'closed',
  CERRADO: 'closed',
  SIN_ACUERDO: 'ended',
  VENCIDO: 'ended',
  CANCELADO: 'ended',
};

/** Estado del pedido con su etiqueta en español. El texto, no el color, transmite el estado. */
@Component({
  selector: 'app-order-status-badge',
  template: `<span [class]="'badge badge--' + tone()">{{ label() }}</span>`,
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

    .badge--open {
      background-color: var(--color-primary-pale);
      color: var(--color-primary-dark);
      border-color: var(--color-primary);
    }

    .badge--agreed {
      background-color: #eff4ff;
      color: #1d3f8f;
      border-color: #84a5e8;
    }

    .badge--closed {
      background-color: var(--color-surface);
      color: var(--color-text);
      border-color: var(--color-control-border);
    }

    .badge--ended {
      background-color: var(--color-background);
      color: var(--color-text-secondary);
      border-color: var(--color-border);
    }
  `,
})
export class OrderStatusBadgeComponent {
  readonly status = input.required<OrderStatus>();

  protected readonly label = computed(() => ORDER_STATUS_LABELS[this.status()]);
  protected readonly tone = computed(() => STATUS_TONES[this.status()]);
}
