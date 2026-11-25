import { TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { Offer } from '../../../offers/models/offer.model';
import { ORDER_ID, offer, page, setupOfferPage } from '../../../offers/testing/offers.fixtures';
import { OrderStatus } from '../../../orders/models/order.model';
import { PaymentsOverview } from '../../../payments/models/payment.model';
import {
  declaration,
  overview,
  payment,
  receipts,
} from '../../../payments/testing/payments.fixtures';
import { Visit, Workflow } from '../../models/workflow.model';
import { assignedOrder, event, timeline, workflow } from '../../testing/workflow.fixtures';
import { ASSIGNED_JOBS_ROUTES } from '../../workflow.routes';

const WITH_VISIT = offer({ status: 'ACEPTADA', requiresVisit: true, visitCost: '30.00' });
const FREE_VISIT = offer({ status: 'ACEPTADA', requiresVisit: true, visitCost: '0.00' });
const NO_VISIT = offer({ status: 'ACEPTADA', requiresVisit: false, visitCost: null });

const VISIT: Visit = {
  orderId: ORDER_ID,
  performedAt: '2026-11-21T14:00:00.000Z',
  visitCost: '30.00',
};

const ELIGIBLE = {
  eligible: true,
  status: 'APROBADO',
  message: 'Perfil aprobado.',
  reason: null,
  pendingZoneChangeRequest: null,
  canTakeNewWork: true,
};

const CONTACT = {
  available: false,
  contactRole: 'CLIENTE',
  url: null,
  reason: 'TELEFONO_NO_REGISTRADO',
};

const WORKFLOW = `orders/${ORDER_ID}/workflow`;
const TIMELINE = `orders/${ORDER_ID}/timeline`;
const PAYMENTS = `orders/${ORDER_ID}/payments`;
const RECEIPTS = `orders/${ORDER_ID}/receipts`;
const ELIGIBILITY = 'worker-profile/me/eligibility';
const REGISTER = apiUrl('orders', ORDER_ID, 'visit');
const CONFIRM = apiUrl('orders', ORDER_ID, 'visit', 'payment-confirmation');

function visitPayment(
  status: OrderStatus,
  declaredBy: ('CLIENTE' | 'TRABAJADOR')[] = [],
): PaymentsOverview {
  return overview({
    orderStatus: status,
    payments: [
      payment({
        concept: 'VISITA',
        expectedAmount: '30.00',
        declarations: declaredBy.map((party) =>
          declaration({ id: party, declaredBy: party, method: 'EFECTIVO', amount: '30.00' }),
        ),
      }),
    ],
  });
}

describe('JobPageComponent: visit and its payment', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    view = await setupOfferPage(
      [{ path: 'trabajador/trabajos', children: ASSIGNED_JOBS_ROUTES }],
      'TRABAJADOR',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  interface Setup {
    accepted?: Offer;
    state?: Partial<Workflow>;
    payments?: PaymentsOverview;
    /** `null`: la página no debe consultar la elegibilidad. */
    eligibility?: object | null;
  }

  async function open(status: OrderStatus, setup: Setup = {}): Promise<void> {
    const { accepted = WITH_VISIT, state, eligibility = ELIGIBLE } = setup;
    await view.visit(`/trabajador/trabajos/${ORDER_ID}`);
    await view.answer(WORKFLOW, workflow(status, state));
    await view.answer(TIMELINE, timeline());
    await view.answer('offers/me', page([accepted]));
    await view.answer(PAYMENTS, setup.payments ?? overview({ orderStatus: status, payments: [] }));
    await view.answer(RECEIPTS, receipts());
    if (status !== 'CANCELADO' && status !== 'CERRADO') {
      await view.answer(`offers/me/${accepted.id}/whatsapp`, CONTACT);
      await view.answer(`orders/assigned/${ORDER_ID}`, assignedOrder(status));
    }
    if (eligibility !== null) {
      await view.answer(ELIGIBILITY, eligibility);
    }
  }

  const panel = () => view.element('app-worker-actions');
  const registerButton = () => view.element<HTMLButtonElement>('.visit__register');
  const collectButton = () => view.element<HTMLButtonElement>('app-confirm-visit-payment .collect');
  const dialog = () => view.element('dialog[open]');
  const confirm = () => view.click('dialog[open] .dialog__confirm');

  async function register(): Promise<TestRequest> {
    await view.click('.visit__register');
    await confirm();
    return view.http.expectOne(REGISTER);
  }

  async function collect(): Promise<TestRequest> {
    await view.click('app-confirm-visit-payment .collect');
    await confirm();
    return view.http.expectOne(CONFIRM);
  }

  async function reject(request: TestRequest, status: number, message: string): Promise<void> {
    request.flush({ statusCode: status, message }, { status, statusText: 'Error' });
    await view.render();
  }

  describe('register the visit (#83)', () => {
    it('offers it to the approved worker after the advance, with the agreed cost', async () => {
      await open('ANTICIPO_REGISTRADO');

      expect(panel()?.textContent).toContain('Costo acordado: Bs 30.00');
      expect(registerButton()?.textContent).toContain('Registrar visita realizada');
      // Todavía no hay inicio, adicionales ni finalización.
      expect(view.content()).not.toContain('Iniciar trabajo');
    });

    it('announces a free visit as such', async () => {
      await open('ANTICIPO_REGISTRADO', { accepted: FREE_VISIT });

      expect(panel()?.textContent).toContain('Costo acordado: Gratis');
    });

    it('waits for the advance before offering it', async () => {
      await open('ACORDADO', { eligibility: null });

      expect(panel()?.textContent).toContain('recibió el anticipo');
      expect(registerButton()).toBeNull();
    });

    it('shows nothing when the agreement has no visit', async () => {
      await open('ANTICIPO_REGISTRADO', { accepted: NO_VISIT, eligibility: null });

      expect(panel()).toBeNull();
    });

    it.each(['VISITA_REALIZADA', 'EN_EJECUCION', 'TERMINADO', 'CANCELADO', 'CERRADO'] as const)(
      'does not offer it with the order in %s',
      async (status) => {
        await open(status, { accepted: FREE_VISIT, eligibility: null });

        expect(panel()).toBeNull();
      },
    );

    it('does not guess when the accepted offer is not found, and retries', async () => {
      await view.visit(`/trabajador/trabajos/${ORDER_ID}`);
      await view.answer(WORKFLOW, workflow('ANTICIPO_REGISTRADO'));
      await view.answer(TIMELINE, timeline());
      await view.fail('offers/me', 500, 'Sin ofertas');
      await view.answer(PAYMENTS, overview({ payments: [] }));
      await view.answer(RECEIPTS, receipts());
      await view.answer(`orders/assigned/${ORDER_ID}`, assignedOrder('ANTICIPO_REGISTRADO'));

      expect(panel()?.textContent).toContain('Información no disponible');
      expect(registerButton()).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('requiere visita'));

      await view.click('app-worker-actions .offers__secondary');
      await view.answer('offers/me', page([WITH_VISIT]));
      await view.answer(`offers/me/${WITH_VISIT.id}/whatsapp`, CONTACT);
      await view.answer(ELIGIBILITY, ELIGIBLE);
      expect(registerButton()).not.toBeNull();
    });

    it.each([
      ['pending', 'Su perfil todavía no fue aprobado.'],
      ['suspended', 'Su perfil está suspendido.'],
    ])('does not offer it to a %s worker and explains why', async (_, message) => {
      await open('ANTICIPO_REGISTRADO', {
        eligibility: { ...ELIGIBLE, eligible: false, message },
      });

      expect(panel()?.textContent).toContain(`No puede registrar la visita: ${message}`);
      expect(registerButton()).toBeNull();
    });

    it('does not offer it while the profile cannot be checked', async () => {
      await open('ANTICIPO_REGISTRADO', { eligibility: null });
      await view.fail(ELIGIBILITY, 500, 'Fallo');
      expect(registerButton()).toBeNull();

      await view.click('app-worker-actions app-error-alert button');
      await view.answer(ELIGIBILITY, ELIGIBLE);
      expect(registerButton()).not.toBeNull();
    });

    it('sends nothing until confirmed, nor when dismissed', async () => {
      await open('ANTICIPO_REGISTRADO');
      await view.click('.visit__register');

      expect(dialog()?.textContent).toContain('Bs 30.00');
      expect(dialog()?.textContent).toContain('no se puede deshacer');
      await view.click('dialog[open] .dialog__cancel');
      expect(dialog()).toBeNull();
      view.http.expectNone(REGISTER);
    });

    it('registers once, then refreshes the state, the payments and the history', async () => {
      await open('ANTICIPO_REGISTRADO');
      const request = await register();
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toBeNull();
      // Mientras se envía no se puede repetir.
      await confirm();
      view.http.expectNone(REGISTER);

      request.flush({ status: 'VISITA_REALIZADA', visit: VISIT }, { status: 201, statusText: 'C' });
      await view.render();
      // Hasta tener el flujo nuevo, la acción queda deshabilitada.
      expect(registerButton()?.disabled).toBe(true);

      await view.answer(WORKFLOW, workflow('VISITA_REALIZADA', { visit: VISIT }));
      await view.answer(
        TIMELINE,
        timeline([event({ source: 'workflow', summary: 'Visita realizada. Costo Bs 30.00' })]),
      );
      await view.answer(PAYMENTS, visitPayment('VISITA_REALIZADA'));
      await view.answer(RECEIPTS, receipts());

      expect(panel()).toBeNull();
      expect(view.content()).toContain('Visita realizada. Costo Bs 30.00');
      expect(collectButton()).not.toBeNull();
      const notice = view.element('#job-notice');
      expect(notice?.textContent).toContain('Visita registrada');
      expect(document.activeElement).toBe(notice);
    });

    it('keeps the result visible when the refresh fails', async () => {
      await open('ANTICIPO_REGISTRADO');
      (await register()).flush({ status: 'VISITA_REALIZADA', visit: VISIT });
      await view.render();
      await view.fail(WORKFLOW, 500, 'Fallo del servidor');
      await view.answer(TIMELINE, timeline());

      expect(view.element('#job-notice')?.textContent).toContain('Visita registrada');
    });

    it.each([
      [403, 'Su perfil no está aprobado'],
      [404, 'El pedido no existe'],
      [409, 'La oferta acordada no requiere visita (cotización por fotos).'],
    ])('shows a %i answer and consults everything again', async (status, message) => {
      await open('ANTICIPO_REGISTRADO');
      await reject(await register(), status, message);

      const notice = view.element('#job-notice');
      expect(notice?.getAttribute('role')).toBe('alert');
      expect(notice?.textContent).toContain(message);
      expect(document.activeElement).toBe(notice);
      await view.answer(ELIGIBILITY, ELIGIBLE);
      await view.answer(WORKFLOW, workflow('CANCELADO'));
      await view.answer(TIMELINE, timeline());
      await view.answer('offers/me', page([WITH_VISIT]));
      await view.answer(PAYMENTS, overview({ orderStatus: 'CANCELADO', payments: [] }));
      await view.answer(RECEIPTS, receipts());
      expect(view.element('#job-notice')?.textContent).toContain(message);
      expect(panel()).toBeNull();
    });

    it('does not show the internal status name of a state conflict', async () => {
      await open('ANTICIPO_REGISTRADO');
      await reject(
        await register(),
        409,
        'No se puede registrar la visita con el pedido en estado VISITA_REALIZADA.',
      );

      expect(view.element('#job-notice')?.textContent).toContain('El pedido cambió de estado');
      expect(view.content()).not.toContain('VISITA_REALIZADA');
      await view.answer(ELIGIBILITY, ELIGIBLE);
      await view.answer(WORKFLOW, workflow('VISITA_REALIZADA', { visit: VISIT }));
      await view.answer(TIMELINE, timeline());
      await view.answer('offers/me', page([WITH_VISIT]));
      await view.answer(PAYMENTS, visitPayment('VISITA_REALIZADA'));
      await view.answer(RECEIPTS, receipts());
      // Al volver a consultar el acuerdo, el contacto se pide de nuevo.
      await view.answer(`offers/me/${WITH_VISIT.id}/whatsapp`, CONTACT);
    });

    it('shows a server failure without refreshing and lets the worker retry', async () => {
      await open('ANTICIPO_REGISTRADO');
      await reject(await register(), 500, 'boom');

      expect(view.element('#job-notice')?.textContent).toContain('error en el servidor');
      expect(registerButton()?.disabled).toBe(false);
    });

    it('closes the session when the token is no longer valid', async () => {
      await open('ANTICIPO_REGISTRADO');
      await reject(await register(), 401, 'Unauthorized');

      expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
    });
  });

  describe('confirm the visit payment (#84)', () => {
    const registered = (status: OrderStatus, declared: ('CLIENTE' | 'TRABAJADOR')[] = []) => ({
      state: { visit: VISIT },
      payments: visitPayment(status, declared),
    });

    it('is offered even if the client already declared that they paid', async () => {
      await open('VISITA_REALIZADA', registered('VISITA_REALIZADA', ['CLIENTE']));

      expect(view.content()).toContain('declaró Bs 30.00');
      expect(collectButton()?.textContent).toContain('Confirmar cobro de la visita');
    });

    it.each(['CANCELADO', 'CERRADO'] as const)('is offered on a %s order', async (status) => {
      await open(status, registered(status));

      expect(collectButton()).not.toBeNull();
    });

    it('is not offered once the worker has confirmed it', async () => {
      await open('VISITA_REALIZADA', registered('VISITA_REALIZADA', ['TRABAJADOR']));

      expect(collectButton()).toBeNull();
      expect(view.content()).toContain('Ya confirmó el cobro de la visita');
    });

    it('is not offered to a worker without approved profile', async () => {
      await open('VISITA_REALIZADA', {
        ...registered('VISITA_REALIZADA'),
        eligibility: { ...ELIGIBLE, eligible: false, message: 'Su perfil está suspendido.' },
      });

      expect(collectButton()).toBeNull();
      expect(view.content()).toContain('No puede confirmar el cobro: Su perfil está suspendido.');
    });

    it('confirms once, keeps the status and updates the payments and the history', async () => {
      await open('VISITA_REALIZADA', registered('VISITA_REALIZADA'));
      await view.click('app-confirm-visit-payment .collect');
      expect(dialog()?.textContent).toContain('Bs 30.00');
      expect(dialog()?.textContent).toContain('no cambia el estado');
      view.http.expectNone(CONFIRM);

      await confirm();
      const request = view.http.expectOne(CONFIRM);
      expect(request.request.body).toBeNull();
      await confirm();
      view.http.expectNone(CONFIRM);

      request.flush({ visit: VISIT });
      await view.render();
      expect(collectButton()?.disabled).toBe(true);
      await view.answer(WORKFLOW, workflow('VISITA_REALIZADA', { visit: VISIT }));
      await view.answer(TIMELINE, timeline([event({ summary: 'Pago de la visita confirmado' })]));
      await view.answer(PAYMENTS, visitPayment('VISITA_REALIZADA', ['TRABAJADOR']));
      await view.answer(RECEIPTS, receipts());

      expect(view.content()).toContain('Confirmado por el trabajador');
      expect(view.content()).toContain('Pago de la visita confirmado');
      expect(view.content()).toContain('Visita realizada');
      expect(collectButton()).toBeNull();
      const success = view.element('#payments-success');
      expect(success?.textContent).toContain('Cobro de la visita confirmado');
      expect(document.activeElement).toBe(success);
    });

    it.each([
      [403, 'Su perfil no está aprobado'],
      [404, 'El pedido no existe'],
      [409, 'La visita no tiene costo: no hay cobro que confirmar.'],
    ])('shows a %i answer and consults again', async (status, message) => {
      await open('VISITA_REALIZADA', registered('VISITA_REALIZADA'));
      await reject(await collect(), status, message);

      expect(view.element('#payments-error')?.textContent).toContain(message);
      await view.answer(ELIGIBILITY, ELIGIBLE);
      await view.answer(WORKFLOW, workflow('VISITA_REALIZADA', { visit: VISIT }));
      await view.answer(TIMELINE, timeline());
      await view.answer(PAYMENTS, visitPayment('VISITA_REALIZADA'));
      await view.answer(RECEIPTS, receipts());
    });

    it('closes the session when the token is no longer valid', async () => {
      await open('VISITA_REALIZADA', registered('VISITA_REALIZADA'));
      await reject(await collect(), 401, 'Unauthorized');

      expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
    });
  });
});
