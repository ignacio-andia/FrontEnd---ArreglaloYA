import { ownerOrder } from '../../../orders/testing/order.fixtures';
import { MY_ORDERS_ROUTES } from '../../../orders/orders.routes';
import { ORDER_ID, page, received, setupOfferPage } from '../../../offers/testing/offers.fixtures';
import { OrderStatus } from '../../../orders/models/order.model';
import {
  cancellationSummary,
  overview,
  receipts,
} from '../../../payments/testing/payments.fixtures';
import { event, timeline, workflow } from '../../testing/workflow.fixtures';

const SUMMARY = `orders/${ORDER_ID}/cancellation-summary`;
const ACCEPTED = received({ status: 'ACEPTADA' });

describe('TrackingPageComponent', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    view = await setupOfferPage(
      [{ path: 'cliente/mis-pedidos', children: MY_ORDERS_ROUTES }],
      'CLIENTE',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  async function open(status: OrderStatus, accepted = [ACCEPTED]): Promise<void> {
    await view.visit(`/cliente/mis-pedidos/${ORDER_ID}/seguimiento`);
    await view.answer(`orders/${ORDER_ID}/workflow`, workflow(status));
    await view.answer(
      `orders/${ORDER_ID}/timeline`,
      timeline([event(), event({ id: 'e2', actor: { type: 'SISTEMA', process: 'X' } })]),
    );
    await view.answer(`orders/me/${ORDER_ID}`, ownerOrder({ status }));
    await view.answer('offers/received', page(accepted));
    await view.answer(`orders/${ORDER_ID}/payments`, overview({ payments: [] }));
    await view.answer(`orders/${ORDER_ID}/receipts`, receipts());
    if (status === 'CANCELADO') {
      await view.answer(SUMMARY, cancellationSummary());
    }
  }

  it('shows the state, the assigned worker, the contact and the history', async () => {
    await open('ANTICIPO_REGISTRADO');
    await view.answer(`offers/received/${ACCEPTED.id}/whatsapp`, {
      available: true,
      channel: 'WHATSAPP',
      contactRole: 'TRABAJADOR',
      url: 'https://wa.me/59170000000',
    });

    expect(view.text('h1')).toBe('Seguimiento · Plomería');
    const content = view.content();
    expect(content).toContain('Anticipo registrado');
    expect(content).toContain('Luis Rojas');
    expect(content).toContain('Cliente (usted)');
    expect(content).toContain('Sistema');
    expect(view.element('.contact__link')).not.toBeNull();
  });

  it.each(['CERRADO', 'CANCELADO'] as const)(
    'keeps the worker and the history of a %s order without contact',
    async (status) => {
      await open(status);

      expect(view.content()).toContain('Luis Rojas');
      expect(view.element('app-whatsapp-contact')).toBeNull();
      expect(view.root().querySelectorAll('.line__item')).toHaveLength(2);
    },
  );

  it('says when there is no assigned worker', async () => {
    await open('PUBLICADO', []);

    expect(view.content()).toContain('no tiene un trabajador asignado');
  });

  it('hides someone else’s order', async () => {
    await view.visit(`/cliente/mis-pedidos/${ORDER_ID}/seguimiento`);
    await view.fail(`orders/${ORDER_ID}/workflow`, 404);
    await view.fail(`orders/${ORDER_ID}/timeline`, 404);

    expect(view.text('h1')).toBe('Pedido no encontrado');
  });
});
