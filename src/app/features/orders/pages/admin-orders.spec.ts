import { page, setupOfferPage, ORDER_ID } from '../../offers/testing/offers.fixtures';
import { NOTICE, cancellationSummary, receipts } from '../../payments/testing/payments.fixtures';
import { cancellation, dataRows, event, timeline } from '../../workflow/testing/workflow.fixtures';
import { AdminOrder } from '../models/order.model';
import { ADMIN_ORDERS_ROUTES } from '../orders.routes';

const order = (overrides: Partial<AdminOrder> = {}): AdminOrder => ({
  id: ORDER_ID,
  status: 'ACORDADO',
  category: { id: 'c', name: 'Plomería' },
  zone: { id: 'z', name: 'Zona Norte' },
  budgetAmount: '120.00',
  publishedAt: '2026-11-20T14:00:00.000Z',
  expiresAt: '2026-11-27T14:00:00.000Z',
  cancelledAt: null,
  anonymizedAt: null,
  imageCount: 2,
  client: { id: 'client', firstName: 'Clara', lastName: 'Cliente' },
  assignedWorkerId: 'worker-1',
  ...overrides,
});

describe('administration of orders', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    view = await setupOfferPage(
      [{ path: 'admin/pedidos', children: ADMIN_ORDERS_ROUTES }],
      'ADMINISTRADOR',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  const listRequest = () => view.request('GET', 'orders', 'admin');

  it('lists the orders and filters them by status (#67)', async () => {
    await view.visit('/admin/pedidos');
    const request = await listRequest();
    expect(request.request.params.toString()).toBe('page=1&limit=20');
    request.flush(page([order(), order({ id: 'bbbbbbbb-1', client: null, status: 'CANCELADO' })]));
    await view.render();

    expect(view.content()).toContain('Clara Cliente');
    expect(view.content()).toContain('Cliente no disponible');
    expect(view.content()).toContain('20/11/2026 10:00');
    expect(view.element('.order-row a')?.getAttribute('href')).toBe(`/admin/pedidos/${ORDER_ID}`);

    await view.type('#admin-orders-status', 'CERRADO');
    const filtered = await listRequest();
    expect(filtered.request.params.get('status')).toBe('CERRADO');
    filtered.flush(page([]));
    await view.render();
    expect(view.content()).toContain('No hay pedidos con ese estado.');
  });

  it('shows and retries a list error', async () => {
    await view.visit('/admin/pedidos');
    await view.fail('orders/admin', 500, 'Fallo');
    await view.click('app-error-alert button');
    await view.answer('orders/admin', page([order()]));
    expect(view.content()).toContain('Plomería');
  });

  it('shows the order with its receipts and timeline, without address (#68, #100, #112)', async () => {
    await view.visit(`/admin/pedidos/${ORDER_ID}`);
    await view.answer(`orders/admin/${ORDER_ID}`, order());
    await view.answer(`orders/${ORDER_ID}/receipts`, receipts());
    await view.answer(
      `orders/${ORDER_ID}/timeline`,
      timeline([event({ summary: 'Pedido publicado' })]),
    );

    for (const text of [
      'Plomería',
      'Bs 120.00',
      'Clara Cliente',
      'Constancias',
      'Pedido publicado',
    ]) {
      expect(view.content()).toContain(text);
    }
    expect(view.content()).not.toContain('Dirección');
    expect(view.element('a[href="/trabajadores/worker-1"]')).not.toBeNull();
  });

  describe('cancelled order', () => {
    const textOf = (selector: string) =>
      (view.element(selector)?.textContent ?? '').replace(/\s+/g, ' ');

    async function open(): Promise<void> {
      await view.visit(`/admin/pedidos/${ORDER_ID}`);
      await view.answer(
        `orders/admin/${ORDER_ID}`,
        order({ status: 'CANCELADO', cancelledAt: '2026-11-22T14:00:00.000Z' }),
      );
      await view.answer(`orders/${ORDER_ID}/receipts`, receipts());
      await view.answer(`orders/${ORDER_ID}/timeline`, timeline([event(), cancellation()]));
    }

    it('shows the cancellation card with role, date, previous status and reason (#112)', async () => {
      await open();
      await view.answer(`orders/${ORDER_ID}/cancellation-summary`, cancellationSummary());

      expect(textOf('app-cancellation-record')).toContain('Cancelación');
      // Solo el rol: el administrador no es ninguna de las partes.
      expect(dataRows(view.element('app-cancellation-record'))).toEqual([
        ['Cancelado por', 'Cliente'],
        ['Fecha', '22/11/2026 10:00'],
        ['Estado anterior', 'En ejecución'],
        ['Motivo', 'Cambié de planes'],
      ]);
    });

    it('shows the whole summary, balance included, since there is no payments section (#116)', async () => {
      await open();
      await view.answer(`orders/${ORDER_ID}/cancellation-summary`, cancellationSummary());

      const summary = textOf('app-cancellation-summary');
      expect(summary).toContain(NOTICE);
      expect(dataRows(view.element('app-cancellation-summary'))).toContainEqual([
        'Saldo pendiente',
        'Bs 350.00',
      ]);
      expect(summary).toContain('declaró Bs 150.00');
      expect(summary).not.toContain('«Pagos»');
      expect(view.element('app-payments-section')).toBeNull();
    });

    it('keeps the card when the order has no recorded summary', async () => {
      await open();
      await view.fail(
        `orders/${ORDER_ID}/cancellation-summary`,
        404,
        'El pedido se canceló sin resumen económico registrado.',
      );

      expect(textOf('app-cancellation-record')).toContain('Cambié de planes');
      expect(textOf('app-cancellation-summary')).toContain('sin un resumen económico');
    });
  });

  it('shows no cancellation card for an order that is not cancelled', async () => {
    await view.visit(`/admin/pedidos/${ORDER_ID}`);
    await view.answer(`orders/admin/${ORDER_ID}`, order());
    await view.answer(`orders/${ORDER_ID}/receipts`, receipts());
    await view.answer(`orders/${ORDER_ID}/timeline`, timeline());

    expect(view.element('app-cancellation-record')).toBeNull();
    expect(view.element('app-cancellation-summary')).toBeNull();
  });

  it('says when the order does not exist and asks nothing else', async () => {
    await view.visit(`/admin/pedidos/${ORDER_ID}`);
    await view.fail(`orders/admin/${ORDER_ID}`, 404, 'El pedido no existe');

    expect(view.content()).toContain('Pedido no encontrado');
  });
});
