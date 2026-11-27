import { OrderStatus } from '../../orders/models/order.model';
import { workerOrder } from '../../offers/testing/offers.fixtures';
import { TimelineEvent, TimelinePage } from '../models/timeline.model';
import { Workflow } from '../models/workflow.model';

/**
 * Datos de prueba del seguimiento, con la forma exacta de los contratos. Solo se importan desde
 * archivos `.spec.ts`.
 */
export function workflow(
  status: OrderStatus = 'ACORDADO',
  overrides: Partial<Workflow> = {},
): Workflow {
  return {
    orderId: workerOrder().id,
    status,
    visit: null,
    additionalBudgets: [],
    execution: null,
    noShowReport: null,
    ...overrides,
  };
}

export function assignedOrder(status: OrderStatus = 'ACORDADO') {
  return {
    ...workerOrder({ status }),
    address: { addressLine: 'Av. Ejemplo 123', reference: 'Portón verde' },
    client: { id: 'client', firstName: 'Ana', lastName: 'Pérez' },
  };
}

export function event(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'e1',
    source: 'orders',
    type: 'PEDIDO_PUBLICADO',
    at: '2026-11-20T14:00:00.000Z',
    actor: { type: 'USUARIO', userId: 'client', role: 'CLIENTE' },
    summary: 'Pedido publicado',
    details: { fromStatus: null, toStatus: 'PUBLICADO', reason: null },
    ...overrides,
  };
}

export function timeline(data: TimelineEvent[] = [event()], nextCursor: string | null = null) {
  return { data, nextCursor } satisfies TimelinePage;
}

/** El acontecimiento `PEDIDO_CANCELADO` del historial, como lo entrega el backend. */
export function cancellation(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return event({
    id: 'cancel',
    type: 'PEDIDO_CANCELADO',
    at: '2026-11-22T14:00:00.000Z',
    summary: 'Pedido cancelado',
    details: { fromStatus: 'EN_EJECUCION', toStatus: 'CANCELADO', reason: 'Cambié de planes' },
    ...overrides,
  });
}

/** Pares «etiqueta, valor» de las listas de datos (`dl`) dentro de un elemento. */
export function dataRows(element: Element | null): string[][] {
  return Array.from(element?.querySelectorAll('dl > div') ?? [], (row) => [
    row.querySelector('dt')?.textContent?.trim() ?? '',
    row.querySelector('dd')?.textContent?.trim() ?? '',
  ]);
}
