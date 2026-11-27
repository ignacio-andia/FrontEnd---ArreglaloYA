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
import { Workflow } from '../../models/workflow.model';
import { event, timeline, workflow } from '../../testing/workflow.fixtures';

const SUMMARY = `orders/${ORDER_ID}/cancellation-summary`;
const ACCEPTED = received({ status: 'ACEPTADA' });
const WORKFLOW = `orders/${ORDER_ID}/workflow`;
const TIMELINE = `orders/${ORDER_ID}/timeline`;
const PAYMENTS = `orders/${ORDER_ID}/payments`;
const RECEIPTS = `orders/${ORDER_ID}/receipts`;
const CANCEL = apiUrl('orders', ORDER_ID, 'cancel-work');
const NO_SHOW = apiUrl('orders', ORDER_ID, 'no-show');
const REPORT = {
  id: 'n1',
  orderId: ORDER_ID,
  description: 'No vino nadie',
  reportedAt: '2026-11-21T14:00:00.000Z',
};

const CANCELLABLE = [
  'ACORDADO',
  'ANTICIPO_REGISTRADO',
  'VISITA_REALIZADA',
  'PRESUPUESTO_ADICIONAL_PENDIENTE',
  'EN_EJECUCION',
] as const;

describe('TrackingPageComponent: special situations', () => {
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

  async function open(status: OrderStatus, state: Partial<Workflow> = {}): Promise<void> {
    await view.visit(`/cliente/mis-pedidos/${ORDER_ID}/seguimiento`);
    await view.answer(WORKFLOW, workflow(status, state));
    await view.answer(TIMELINE, timeline());
    await view.answer(`orders/me/${ORDER_ID}`, ownerOrder({ status }));
    await view.answer('offers/received', page([ACCEPTED]));
    await view.answer(PAYMENTS, overview({ orderStatus: status, payments: [] }));
    await view.answer(RECEIPTS, receipts());
    if (status === 'CANCELADO') {
      await view.answer(SUMMARY, cancellationSummary());
    }
    if (status === 'EN_RECLAMO') {
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

  async function refreshed(status: OrderStatus, state: Partial<Workflow> = {}): Promise<void> {
    await view.answer(WORKFLOW, workflow(status, state));
    await view.answer(TIMELINE, timeline([event({ summary: `Historial en ${status}` })]));
    await view.answer(PAYMENTS, overview({ orderStatus: status, payments: [] }));
    await view.answer(RECEIPTS, receipts());
    if (status === 'CANCELADO') {
      await view.answer(SUMMARY, cancellationSummary());
    }
  }

  const dialog = () => view.element('dialog[open]');
  const confirm = () => view.click('dialog[open] .dialog__confirm');
  const notice = () => view.element('#action-notice');
  const cancelButton = () => view.element<HTMLButtonElement>('.special__cancel');

  async function send(url: string, button: string, text = '  Cambié de planes  ') {
    await view.click(button);
    await view.type('dialog[open] textarea', text);
    await confirm();
    return view.http.expectOne(url);
  }

  async function fail(request: TestRequest, status: number, message: string): Promise<void> {
    request.flush({ statusCode: status, message }, { status, statusText: 'Error' });
    await view.render();
  }

  describe('cancel the work (#90)', () => {
    const cancel = () => send(CANCEL, '.special__cancel');

    it.each(CANCELLABLE)('is offered in %s', async (status) => {
      await open(status);

      expect(cancelButton()?.textContent).toContain('Cancelar trabajo');
    });

    it.each(['PUBLICADO', 'TERMINADO', 'EN_RECLAMO', 'CERRADO', 'CANCELADO'] as const)(
      'is not offered in %s',
      async (status) => {
        await open(status);

        expect(view.element('app-client-actions')).toBeNull();
      },
    );

    it('warns without promising refunds', async () => {
      await open('ANTICIPO_REGISTRADO');
      await view.click('.special__cancel');

      const text = dialog()!.textContent!.replace(/\s+/g, ' ');
      expect(text).toContain('no podrá reactivarlo');
      expect(text).toContain('no gestiona devoluciones');
      expect(text).not.toContain('quedará sin efecto');
      expect(text).not.toContain('visita ya realizada');
      await view.click('dialog[open] .dialog__cancel');
      view.http.expectNone(CANCEL);
    });

    it('mentions the pending budget and the visit still to be paid', async () => {
      await open('PRESUPUESTO_ADICIONAL_PENDIENTE', {
        visit: { orderId: ORDER_ID, performedAt: '2026-11-21T14:00:00Z', visitCost: '20.00' },
        additionalBudgets: [
          {
            id: 'b1',
            orderId: ORDER_ID,
            amount: '10.00',
            reason: 'r',
            materials: 'm',
            status: 'PENDIENTE',
            respondedAt: null,
            createdAt: '2026-11-21T15:00:00Z',
          },
        ],
      });
      await view.click('.special__cancel');

      expect(dialog()?.textContent).toContain('quedará sin efecto');
      expect(dialog()?.textContent).toContain('su pago se podrá seguir declarando');
      await view.click('dialog[open] .dialog__cancel');
    });

    it.each(['', '   ', 'a'.repeat(501)])('requires a reason of 1 to 500: «%s»', async (text) => {
      await open('ACORDADO');
      await view.click('.special__cancel');
      await view.type('dialog[open] textarea', text);
      await confirm();

      view.http.expectNone(CANCEL);
      expect(dialog()).not.toBeNull();
      expect(view.element('#cancel-work-reason')?.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement?.id).toBe('cancel-work-reason');
      await view.click('dialog[open] .dialog__cancel');
    });

    it('sends the trimmed reason once and updates the state and the history', async () => {
      await open('EN_EJECUCION');
      const request = await cancel();
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ reason: 'Cambié de planes' });
      await confirm();
      view.http.expectNone(CANCEL);

      request.flush(ownerOrder({ status: 'CANCELADO' }));
      await view.render();
      expect(cancelButton()?.disabled).toBe(true);
      await refreshed('CANCELADO');

      expect(view.content()).toContain('El pedido está cancelado');
      expect(view.content()).toContain('Historial en CANCELADO');
      expect(view.element('app-client-actions')).toBeNull();
      expect(view.element('app-whatsapp-contact')).toBeNull();
      expect(notice()?.textContent).toContain('Trabajo cancelado');
      expect(document.activeElement).toBe(notice());
    });

    it('keeps the confirmed result when the following query fails', async () => {
      await open('ACORDADO');
      (await cancel()).flush(ownerOrder({ status: 'CANCELADO' }));
      await view.render();
      await view.fail(WORKFLOW, 500, 'Fallo del servidor');
      await view.answer(TIMELINE, timeline());

      expect(notice()?.textContent).toContain('Trabajo cancelado');
      expect(cancelButton()).toBeNull();
    });

    it('shows the 409 of a finished job and consults again', async () => {
      await open('EN_EJECUCION');
      const message = 'El trabajo ya terminó: no se puede cancelar. Use el reclamo (RF-37).';
      await fail(await cancel(), 409, message);

      expect(notice()?.textContent).toContain('El trabajo ya terminó');
      await refreshed('TERMINADO');
      expect(view.element('app-client-actions')).toBeNull();
    });

    it('hides the internal status name of a conflict', async () => {
      await open('ACORDADO');
      await fail(
        await cancel(),
        409,
        'No se puede cancelar el trabajo de un pedido en estado CANCELADO',
      );

      expect(notice()?.textContent).toContain('El pedido cambió de estado');
      await refreshed('CANCELADO');
    });

    it.each([
      [403, 'Forbidden resource'],
      [404, 'El pedido no existe'],
    ])('shows a %i answer and consults again', async (status, message) => {
      await open('ACORDADO');
      await fail(await cancel(), status, message);

      expect(notice()?.textContent).toContain(message);
      await refreshed('ACORDADO');
    });

    it('keeps the confirmation open when the backend rejects the reason', async () => {
      await open('ACORDADO');
      await fail(await cancel(), 400, 'reason es obligatorio');

      expect(dialog()).not.toBeNull();
      expect(view.element('#cancel-work-reason')?.getAttribute('aria-invalid')).toBe('true');
      expect(dialog()?.textContent).toContain('El servidor rechazó este dato');
      expect(notice()?.textContent ?? '').not.toContain('reason');
      await view.click('dialog[open] .dialog__cancel');
    });

    it('after a 500 warns that the result is unknown and consults again', async () => {
      await open('ACORDADO');
      await fail(await cancel(), 500, 'boom');

      expect(notice()?.textContent).toContain('No pudimos confirmar');
      expect(cancelButton()?.disabled).toBe(true);
      await refreshed('ACORDADO');
      expect(cancelButton()?.disabled).toBe(false);
      view.http.expectNone(CANCEL);
    });

    it('closes the session on a 401', async () => {
      await open('ACORDADO');
      await fail(await cancel(), 401, 'Unauthorized');

      expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
    });
  });

  describe('report that the worker did not arrive (#91)', () => {
    const reportButton = () => view.element<HTMLButtonElement>('.special__report');
    const report = (text?: string) => send(NO_SHOW, '.special__report', text ?? 'No vino nadie');

    it.each(['ACORDADO', 'ANTICIPO_REGISTRADO'] as const)('is offered in %s', async (status) => {
      await open(status);

      expect(reportButton()?.textContent).toContain('El trabajador no llegó');
    });

    it.each(['VISITA_REALIZADA', 'PRESUPUESTO_ADICIONAL_PENDIENTE', 'EN_EJECUCION'] as const)(
      'is not offered in %s, where only cancelling remains',
      async (status) => {
        await open(status);

        expect(reportButton()).toBeNull();
        expect(cancelButton()).not.toBeNull();
      },
    );

    it('is not offered again once reported', async () => {
      await open('ACORDADO', { noShowReport: REPORT });

      expect(reportButton()).toBeNull();
      expect(view.content()).toContain('Ya reportó la inasistencia');
      expect(view.content()).toContain('Inasistencia reportada');
    });

    it('explains that it only records the fact', async () => {
      await open('ACORDADO');
      await view.click('.special__report');

      const text = dialog()!.textContent!.replace(/\s+/g, ' ');
      expect(text).toContain('No cancela el pedido');
      expect(text).toContain('no aplica una penalización');
      expect(text).toContain('un reporte por pedido');
      expect(text).not.toMatch(/minutos|tolerancia|reembolso/i);
      await view.click('dialog[open] .dialog__cancel');
      view.http.expectNone(NO_SHOW);
    });

    it.each([
      ['without a description', '   ', {}],
      ['with the trimmed description', '  No vino nadie  ', { description: 'No vino nadie' }],
    ])('sends it %s, once', async (_, text, body) => {
      await open('ANTICIPO_REGISTRADO');
      const request = await report(text);
      expect(request.request.body).toEqual(body);
      await confirm();
      view.http.expectNone(NO_SHOW);

      request.flush({ created: true, report: REPORT });
      await view.render();
      expect(reportButton()?.disabled).toBe(true);
      expect(cancelButton()?.disabled).toBe(true);
      await refreshed('ANTICIPO_REGISTRADO', { noShowReport: REPORT });

      expect(view.content()).toContain('Anticipo registrado');
      expect(view.content()).toContain('No vino nadie');
      expect(reportButton()).toBeNull();
      expect(cancelButton()?.disabled).toBe(false);
      expect(notice()?.textContent).toContain('el estado del pedido no cambia');
      expect(document.activeElement).toBe(notice());
    });

    it('says when there was already a report', async () => {
      await open('ACORDADO');
      (await report()).flush({ created: false, report: REPORT });
      await view.render();
      await refreshed('ACORDADO', { noShowReport: REPORT });

      expect(notice()?.textContent).toContain('no se registró otro');
    });

    it('does not send more than 1000 characters', async () => {
      await open('ACORDADO');
      await view.click('.special__report');
      await view.type('dialog[open] textarea', 'a'.repeat(1001));
      await confirm();

      view.http.expectNone(NO_SHOW);
      expect(document.activeElement?.id).toBe('no-show-description');
      await view.click('dialog[open] .dialog__cancel');
    });

    it('keeps the confirmed result when the following query fails', async () => {
      await open('ACORDADO');
      (await report()).flush({ created: true, report: REPORT });
      await view.render();
      await view.fail(WORKFLOW, 500, 'Fallo del servidor');
      await view.answer(TIMELINE, timeline());

      expect(notice()?.textContent).toContain('Inasistencia reportada');
    });

    it.each([
      [403, 'Forbidden resource'],
      [404, 'El pedido no existe'],
      [409, 'Todavía no se puede reportar la inasistencia de este trabajo.'],
    ])('shows a %i answer and consults again', async (status, message) => {
      await open('ACORDADO');
      await fail(await report(), status, message);

      expect(notice()?.textContent).toContain(message);
      await refreshed('ACORDADO');
    });

    it('shows a server failure and allows retrying', async () => {
      await open('ACORDADO');
      await fail(await report(), 500, 'boom');

      expect(notice()?.textContent).toContain('error en el servidor');
      expect(reportButton()?.disabled).toBe(false);
    });

    it('closes the session on a 401', async () => {
      await open('ACORDADO');
      await fail(await report(), 401, 'Unauthorized');

      expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
    });
  });
});
