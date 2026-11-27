import { TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { ORDER_ID, page, received, setupOfferPage } from '../../../offers/testing/offers.fixtures';
import { OrderStatus } from '../../../orders/models/order.model';
import { MY_ORDERS_ROUTES } from '../../../orders/orders.routes';
import { ownerOrder } from '../../../orders/testing/order.fixtures';
import {
  cancellationSummary,
  overview,
  receipts,
} from '../../../payments/testing/payments.fixtures';
import { AdditionalBudget } from '../../models/workflow.model';
import { event, timeline, workflow } from '../../testing/workflow.fixtures';

const SUMMARY = `orders/${ORDER_ID}/cancellation-summary`;
const ACCEPTED = received({ status: 'ACEPTADA' });
const BUDGET: AdditionalBudget = {
  id: 'b1',
  orderId: ORDER_ID,
  amount: '40.50',
  reason: 'Otra pieza dañada',
  materials: 'Llave de paso',
  status: 'PENDIENTE',
  respondedAt: null,
  createdAt: '2026-11-21T14:00:00.000Z',
};
const answered = (status: 'ACEPTADO' | 'RECHAZADO'): AdditionalBudget => ({
  ...BUDGET,
  status,
  respondedAt: '2026-11-21T16:00:00.000Z',
});

const WORKFLOW = `orders/${ORDER_ID}/workflow`;
const TIMELINE = `orders/${ORDER_ID}/timeline`;
const PAYMENTS = `orders/${ORDER_ID}/payments`;
const RECEIPTS = `orders/${ORDER_ID}/receipts`;
const ACCEPT = apiUrl('orders', ORDER_ID, 'additional-budgets', 'b1', 'accept');
const REJECT = apiUrl('orders', ORDER_ID, 'additional-budgets', 'b1', 'reject');

describe('TrackingPageComponent: additional budgets', () => {
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

  async function open(
    status: OrderStatus = 'PRESUPUESTO_ADICIONAL_PENDIENTE',
    budgets: AdditionalBudget[] = [BUDGET],
  ): Promise<void> {
    await view.visit(`/cliente/mis-pedidos/${ORDER_ID}/seguimiento`);
    await view.answer(WORKFLOW, workflow(status, { additionalBudgets: budgets }));
    await view.answer(TIMELINE, timeline());
    await view.answer(`orders/me/${ORDER_ID}`, ownerOrder({ status }));
    await view.answer('offers/received', page([ACCEPTED]));
    await view.answer(PAYMENTS, overview({ orderStatus: status, payments: [] }));
    await view.answer(RECEIPTS, receipts());
    if (status === 'CANCELADO') {
      await view.answer(SUMMARY, cancellationSummary());
    }
    if (status !== 'CERRADO' && status !== 'CANCELADO') {
      await view.answer(`offers/received/${ACCEPTED.id}/whatsapp`, {
        available: false,
        contactRole: 'TRABAJADOR',
        url: null,
        reason: 'TELEFONO_NO_REGISTRADO',
      });
    }
  }

  async function reloaded(status: OrderStatus, budgets: AdditionalBudget[]): Promise<void> {
    const additional = budgets[0].status === 'ACEPTADO' ? '40.50' : '0.00';
    await view.answer(WORKFLOW, workflow(status, { additionalBudgets: budgets }));
    await view.answer(TIMELINE, timeline([event({ summary: `Historial en ${status}` })]));
    await view.answer(
      PAYMENTS,
      overview({
        orderStatus: status,
        payments: [],
        agreement: { baseAmount: '100.00', acceptedAdditional: additional, totalAmount: '140.50' },
      }),
    );
    await view.answer(RECEIPTS, receipts());
    if (status === 'CANCELADO') {
      await view.answer(SUMMARY, cancellationSummary());
    }
  }

  const dialog = () => view.element('dialog[open]');
  const confirm = () => view.click('dialog[open] .dialog__confirm');
  const notice = () => view.element('#action-notice');
  const accept = () => view.element<HTMLButtonElement>('.response__accept');
  const reasonField = '#budget-reject-reason';

  async function sendAccept(): Promise<TestRequest> {
    await view.click('.response__accept');
    await confirm();
    return view.http.expectOne(ACCEPT);
  }

  async function sendReject(reason = ''): Promise<TestRequest> {
    await view.click('.response__reject');
    if (reason !== '') {
      await view.type(reasonField, reason);
    }
    await confirm();
    return view.http.expectOne(REJECT);
  }

  async function fail(request: TestRequest, status: number, message: string): Promise<void> {
    request.flush({ statusCode: status, message }, { status, statusText: 'Error' });
    await view.render();
  }

  it('shows the pending budget with its details and both answers', async () => {
    await open();

    const list = view.element('app-additional-budget-list')!.textContent!;
    for (const text of ['Bs 40.50', 'Otra pieza dañada', 'Llave de paso', '21/11/2026 10:00']) {
      expect(list).toContain(text);
    }
    expect(list).toContain('Pendiente de respuesta');
    expect(accept()).not.toBeNull();
    expect(view.element('.response__reject')).not.toBeNull();
    // El cliente nunca ve el formulario del trabajador.
    expect(view.element('app-additional-budget-form')).toBeNull();
    expect(view.content()).toContain('Monto original acordado');
    expect(view.content()).toContain('Total actualizado');
  });

  it.each([
    ['EN_EJECUCION', 'ACEPTADO', 'Aceptado'],
    ['CERRADO', 'RECHAZADO', 'Rechazado'],
  ] as const)('offers no answer in %s for a %s budget', async (status, state, label) => {
    await open(status, [answered(state)]);

    expect(view.content()).toContain(label);
    expect(view.content()).toContain('Respondido el21/11/2026 12:00');
    expect(view.element('app-budget-response')).toBeNull();
  });

  it('shows no section without budgets', async () => {
    await open('EN_EJECUCION', []);

    expect(view.element('app-additional-budget-list')).toBeNull();
  });

  it('sends nothing when either confirmation is dismissed', async () => {
    await open();
    await view.click('.response__accept');
    expect(dialog()?.textContent).toContain('Bs 40.50');
    await view.click('dialog[open] .dialog__cancel');
    await view.click('.response__reject');
    expect(dialog()?.textContent).toContain('El pedido se cerrará');
    expect(dialog()?.textContent).toContain('no se calculará un saldo');
    await view.click('dialog[open] .dialog__cancel');

    expect(dialog()).toBeNull();
  });

  it('accepts once and updates the state, the payments and the history', async () => {
    await open();
    const request = await sendAccept();
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    await confirm();
    view.http.expectNone(ACCEPT);

    request.flush({ status: 'EN_EJECUCION', budget: answered('ACEPTADO') });
    await view.render();
    expect(accept()?.disabled).toBe(true);
    await reloaded('EN_EJECUCION', [answered('ACEPTADO')]);

    expect(view.content()).toContain('En ejecución');
    expect(view.content()).toContain('Adicionales aceptadosBs 40.50');
    expect(view.content()).toContain('Total actualizadoBs 140.50');
    expect(view.content()).toContain('Historial en EN_EJECUCION');
    expect(view.element('app-budget-response')).toBeNull();
    expect(notice()?.textContent).toContain('Bs 40.50 aceptado');
    expect(document.activeElement).toBe(notice());
  });

  it.each([
    ['without a reason', '   ', {}],
    ['with the trimmed reason', '  Muy caro  ', { reason: 'Muy caro' }],
  ])('rejects %s and closes the order', async (_, reason, body) => {
    await open();
    const request = await sendReject(reason);
    expect(request.request.body).toEqual(body);
    await confirm();
    view.http.expectNone(REJECT);

    request.flush({ status: 'CERRADO', budget: answered('RECHAZADO') });
    await view.render();
    await reloaded('CERRADO', [answered('RECHAZADO')]);

    expect(view.content()).toContain('Cerrado');
    expect(view.content()).toContain('Historial en CERRADO');
    expect(view.element('app-whatsapp-contact')).toBeNull();
    expect(notice()?.textContent).toContain('rechazado. El pedido quedó cerrado');
    expect(document.activeElement).toBe(notice());
  });

  it('does not send a reason longer than 400 characters', async () => {
    await open();
    await view.click('.response__reject');
    await view.type(reasonField, 'a'.repeat(401));
    await confirm();

    view.http.expectNone(REJECT);
    expect(dialog()).not.toBeNull();
    expect(view.element(reasonField)?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement?.id).toBe('budget-reject-reason');
  });

  it('keeps the confirmed result when the following query fails', async () => {
    await open();
    (await sendReject()).flush({ status: 'CERRADO', budget: answered('RECHAZADO') });
    await view.render();
    await view.fail(WORKFLOW, 500, 'Fallo del servidor');
    await view.answer(TIMELINE, timeline());

    expect(notice()?.textContent).toContain('rechazado');
    expect(view.content()).toContain('Ocurrió un error en el servidor');
  });

  it('shows a 400 of the backend without consulting again', async () => {
    await open();
    await fail(
      await sendReject('x'),
      400,
      'reason must be shorter than or equal to 400 characters',
    );

    expect(notice()?.textContent).toContain('400 characters');
    expect(accept()?.disabled).toBe(false);
  });

  it.each([
    [403, 'Forbidden resource'],
    [404, 'El presupuesto adicional no existe'],
    [409, 'El presupuesto adicional ya fue respondido.'],
  ])('shows a %i answer and consults again', async (status, message) => {
    await open();
    await fail(await sendAccept(), status, message);

    expect(notice()?.getAttribute('role')).toBe('alert');
    expect(notice()?.textContent).toContain(message);
    await reloaded('PRESUPUESTO_ADICIONAL_PENDIENTE', [BUDGET]);
    expect(notice()?.textContent).toContain(message);
  });

  it('does not show the internal status name of a state conflict', async () => {
    await open();
    await fail(
      await sendReject(),
      409,
      'No se puede rechazar el presupuesto adicional con el pedido en estado CANCELADO.',
    );

    expect(notice()?.textContent).toContain('El pedido cambió de estado');
    await reloaded('PRESUPUESTO_ADICIONAL_PENDIENTE', [BUDGET]);
  });

  it('closes the session when the token is no longer valid', async () => {
    await open();
    await fail(await sendAccept(), 401, 'Unauthorized');

    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
  });
});
