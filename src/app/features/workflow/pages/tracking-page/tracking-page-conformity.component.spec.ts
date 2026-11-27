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
import { Execution } from '../../models/workflow.model';
import { event, timeline, workflow } from '../../testing/workflow.fixtures';

const SUMMARY = `orders/${ORDER_ID}/cancellation-summary`;
const ACCEPTED = received({ status: 'ACEPTADA' });
const FINISHED: Execution = {
  orderId: ORDER_ID,
  startedAt: '2026-11-01T15:00:00.000Z',
  finishedAt: '2026-11-01T18:00:00.000Z',
  // Plazo ya vencido: el backend sigue decidiendo mientras el pedido esté TERMINADO.
  conformityDeadline: '2026-11-08T18:00:00.000Z',
  conformedAt: null,
};
const CONFORMED: Execution = { ...FINISHED, conformedAt: '2026-11-21T12:00:00.000Z' };

const WORKFLOW = `orders/${ORDER_ID}/workflow`;
const TIMELINE = `orders/${ORDER_ID}/timeline`;
const PAYMENTS = `orders/${ORDER_ID}/payments`;
const RECEIPTS = `orders/${ORDER_ID}/receipts`;
const CONFIRM = apiUrl('orders', ORDER_ID, 'confirm-conformity');

describe('TrackingPageComponent: conformity', () => {
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

  async function open(status: OrderStatus = 'TERMINADO'): Promise<void> {
    await view.visit(`/cliente/mis-pedidos/${ORDER_ID}/seguimiento`);
    await view.answer(WORKFLOW, workflow(status, { execution: FINISHED }));
    await view.answer(TIMELINE, timeline());
    await view.answer(`orders/me/${ORDER_ID}`, ownerOrder({ status }));
    await view.answer('offers/received', page([ACCEPTED]));
    await view.answer(PAYMENTS, overview({ orderStatus: status, payments: [] }));
    await view.answer(RECEIPTS, receipts());
    if (status === 'CANCELADO') {
      await view.answer(SUMMARY, cancellationSummary());
    }
    // En reclamo, o cerrado sin conformidad, se consulta el reclamo.
    if (status === 'EN_RECLAMO' || status === 'CERRADO') {
      await view.fail(`orders/${ORDER_ID}/claim`, 404);
    }
    if (status !== 'CERRADO' && status !== 'CANCELADO' && status !== 'PUBLICADO') {
      await view.answer(`offers/received/${ACCEPTED.id}/whatsapp`, {
        available: false,
        contactRole: 'TRABAJADOR',
        url: null,
        reason: 'TELEFONO_NO_REGISTRADO',
      });
    }
  }

  async function closed(): Promise<void> {
    await view.answer(WORKFLOW, workflow('CERRADO', { execution: CONFORMED }));
    await view.answer(TIMELINE, timeline([event({ summary: 'El cliente confirmó' })]));
    await view.answer(PAYMENTS, overview({ orderStatus: 'CERRADO', payments: [] }));
    await view.answer(RECEIPTS, receipts());
  }

  const button = () => view.element<HTMLButtonElement>('.conformity__confirm');
  const dialog = () => view.element('dialog[open]');
  const confirm = () => view.click('dialog[open] .dialog__confirm');
  const notice = () => view.element('#action-notice');

  async function send(): Promise<TestRequest> {
    await view.click('.conformity__confirm');
    await confirm();
    return view.http.expectOne(CONFIRM);
  }

  async function fail(request: TestRequest, status: number, message: string): Promise<void> {
    request.flush({ statusCode: status, message }, { status, statusText: 'Error' });
    await view.render();
  }

  it('is offered on a finished order, also after the deadline shown', async () => {
    await open();

    expect(view.content()).toContain('Plazo de conformidad o reclamo08/11/2026 14:00');
    expect(button()).not.toBeNull();
    // Nunca las acciones del trabajador.
    expect(view.element('app-worker-actions')).toBeNull();
    expect(view.content()).not.toContain('Marcar como terminado');
  });

  it.each([
    'ACORDADO',
    'ANTICIPO_REGISTRADO',
    'VISITA_REALIZADA',
    'EN_EJECUCION',
    'PRESUPUESTO_ADICIONAL_PENDIENTE',
    'EN_RECLAMO',
    'CERRADO',
    'CANCELADO',
  ] as const)('is not offered in %s', async (status) => {
    await open(status);

    expect(view.element('app-conformity-panel')).toBeNull();
  });

  it('warns clearly and sends nothing when dismissed', async () => {
    await open();
    await view.click('.conformity__confirm');

    const text = dialog()!.textContent!;
    expect(text).toContain('conforme con el trabajo realizado');
    expect(text).toContain('no se puede reabrir');
    expect(text).toContain('no registra ningún pago');
    await view.click('dialog[open] .dialog__cancel');
    view.http.expectNone(CONFIRM);
  });

  it('confirms once, closes the order and updates the history', async () => {
    await open();
    const request = await send();
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    await confirm();
    view.http.expectNone(CONFIRM);

    request.flush({ status: 'CERRADO', execution: CONFORMED });
    await view.render();
    expect(button()?.disabled).toBe(true);
    await closed();

    expect(view.content()).toContain('Conformidad del cliente21/11/2026 08:00');
    expect(view.content()).toContain('El cliente confirmó');
    expect(view.element('app-conformity-panel')).toBeNull();
    expect(view.element('app-whatsapp-contact')).toBeNull();
    expect(notice()?.textContent).toContain('El pedido quedó cerrado');
    expect(document.activeElement).toBe(notice());
    expect(view.content()).not.toContain('Calificar');
  });

  it('keeps the confirmed result when the following query fails, until it is recovered', async () => {
    await open();
    (await send()).flush({ status: 'CERRADO', execution: CONFORMED });
    await view.render();
    await view.fail(WORKFLOW, 500, 'Fallo del servidor');
    await view.answer(TIMELINE, timeline());

    expect(notice()?.textContent).toContain('Conformidad confirmada');
    expect(button()).toBeNull();

    await view.click('app-error-alert button');
    await closed();
    await view.answer(`orders/me/${ORDER_ID}`, ownerOrder({ status: 'CERRADO' }));
    await view.answer('offers/received', page([ACCEPTED]));
    expect(notice()?.textContent).toContain('Conformidad confirmada');
  });

  it.each([
    [403, 'Forbidden resource'],
    [404, 'El pedido no existe'],
    [409, 'La operación ya se realizó o el pedido cambió. Vuelva a consultarlo.'],
  ])('shows a %i answer and consults again', async (status, message) => {
    await open();
    await fail(await send(), status, message);

    expect(notice()?.textContent).toContain(message);
    await closed();
    expect(notice()?.textContent).toContain(message);
  });

  it('hides the internal status name of a conflict', async () => {
    await open();
    await fail(
      await send(),
      409,
      'No se puede confirmar la conformidad con el pedido en estado CERRADO.',
    );

    expect(notice()?.textContent).toContain('El pedido cambió de estado');
    await closed();
  });

  it('shows a server failure and allows retrying', async () => {
    await open();
    await fail(await send(), 500, 'boom');

    expect(notice()?.textContent).toContain('error en el servidor');
    expect(button()?.disabled).toBe(false);
  });

  it('closes the session on a 401', async () => {
    await open();
    await fail(await send(), 401, 'Unauthorized');

    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
  });
});
