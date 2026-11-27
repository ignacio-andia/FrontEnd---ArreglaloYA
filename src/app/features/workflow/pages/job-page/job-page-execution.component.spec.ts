import { TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { Offer } from '../../../offers/models/offer.model';
import { ORDER_ID, offer, page, setupOfferPage } from '../../../offers/testing/offers.fixtures';
import { OrderStatus } from '../../../orders/models/order.model';
import {
  cancellationSummary,
  overview,
  receipts,
} from '../../../payments/testing/payments.fixtures';
import { Execution } from '../../models/workflow.model';
import { assignedOrder, event, timeline, workflow } from '../../testing/workflow.fixtures';
import { ASSIGNED_JOBS_ROUTES } from '../../workflow.routes';

const SUMMARY = `orders/${ORDER_ID}/cancellation-summary`;
const NO_VISIT = offer({ status: 'ACEPTADA', requiresVisit: false, visitCost: null });
const WITH_VISIT = offer({ status: 'ACEPTADA', requiresVisit: true, visitCost: '0.00' });
const FINISHED: Execution = {
  orderId: ORDER_ID,
  startedAt: '2026-11-21T15:00:00.000Z',
  finishedAt: '2026-11-21T18:00:00.000Z',
  conformityDeadline: '2026-11-28T18:00:00.000Z',
  conformedAt: null,
};
const CONTACT = {
  available: false,
  contactRole: 'CLIENTE',
  url: null,
  reason: 'TELEFONO_NO_REGISTRADO',
};
const ELIGIBLE = { eligible: true, message: 'Perfil aprobado.' };

const WORKFLOW = `orders/${ORDER_ID}/workflow`;
const TIMELINE = `orders/${ORDER_ID}/timeline`;
const PAYMENTS = `orders/${ORDER_ID}/payments`;
const RECEIPTS = `orders/${ORDER_ID}/receipts`;
const WHATSAPP = `offers/me/${NO_VISIT.id}/whatsapp`;
const ELIGIBILITY = 'worker-profile/me/eligibility';
const START = apiUrl('orders', ORDER_ID, 'start');
const FINISH = apiUrl('orders', ORDER_ID, 'finish');

const ACTIONABLE: readonly OrderStatus[] = [
  'ANTICIPO_REGISTRADO',
  'VISITA_REALIZADA',
  'EN_EJECUCION',
];

describe('JobPageComponent: start and finish', () => {
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

  async function open(
    status: OrderStatus,
    accepted: Offer = NO_VISIT,
    eligibility: object = ELIGIBLE,
    history = timeline(),
  ): Promise<void> {
    await view.visit(`/trabajador/trabajos/${ORDER_ID}`);
    await view.answer(WORKFLOW, workflow(status));
    await view.answer(TIMELINE, history);
    await view.answer('offers/me', page([accepted]));
    await view.answer(PAYMENTS, overview({ orderStatus: status, payments: [] }));
    await view.answer(RECEIPTS, receipts());
    if (status === 'CANCELADO') {
      await view.answer(SUMMARY, cancellationSummary());
    }
    if (status === 'EN_RECLAMO') {
      await view.fail(`orders/${ORDER_ID}/claim`, 404);
    }
    if (status !== 'CERRADO' && status !== 'CANCELADO') {
      await view.answer(WHATSAPP, CONTACT);
      await view.answer(`orders/assigned/${ORDER_ID}`, assignedOrder(status));
    }
    if (ACTIONABLE.includes(status)) {
      await view.answer(ELIGIBILITY, eligibility);
    }
  }

  const button = () => view.element<HTMLButtonElement>('.work__action');
  const dialog = () => view.element('dialog[open]');
  const confirm = () => view.click('dialog[open] .dialog__confirm');
  const notice = () => view.element('#action-notice');

  async function send(url: string): Promise<TestRequest> {
    await view.click('.work__action');
    await confirm();
    return view.http.expectOne(url);
  }

  async function fail(request: TestRequest, status: number, message: string): Promise<void> {
    request.flush({ statusCode: status, message }, { status, statusText: 'Error' });
    await view.render();
  }

  async function refreshed(status: OrderStatus, history = timeline()): Promise<void> {
    await view.answer(
      WORKFLOW,
      workflow(status, status === 'TERMINADO' ? { execution: FINISHED } : {}),
    );
    await view.answer(TIMELINE, history);
    await view.answer(PAYMENTS, overview({ orderStatus: status, payments: [] }));
    await view.answer(RECEIPTS, receipts());
    if (status === 'CANCELADO') {
      await view.answer(SUMMARY, cancellationSummary());
    }
  }

  describe('start (#85)', () => {
    it('is offered after the advance when the agreement has no visit', async () => {
      await open('ANTICIPO_REGISTRADO');

      expect(button()?.textContent).toContain('Iniciar trabajo');
    });

    it('is offered after the visit', async () => {
      await open('VISITA_REALIZADA', WITH_VISIT);

      expect(button()?.textContent).toContain('Iniciar trabajo');
    });

    it('is not offered before the visit the agreement requires', async () => {
      await open('ANTICIPO_REGISTRADO', WITH_VISIT);

      expect(button()?.textContent).toContain('Registrar visita');
      expect(view.content()).not.toContain('Iniciar trabajo');
    });

    it('is not offered while the agreement is unknown', async () => {
      await view.visit(`/trabajador/trabajos/${ORDER_ID}`);
      await view.answer(WORKFLOW, workflow('ANTICIPO_REGISTRADO'));
      await view.answer(TIMELINE, timeline());
      await view.fail('offers/me', 500, 'Sin ofertas');
      await view.answer(PAYMENTS, overview({ payments: [] }));
      await view.answer(RECEIPTS, receipts());
      await view.answer(`orders/assigned/${ORDER_ID}`, assignedOrder('ANTICIPO_REGISTRADO'));

      expect(view.content()).toContain('ni iniciar el trabajo');
      expect(button()).toBeNull();
    });

    it.each(['ACORDADO', 'TERMINADO', 'EN_RECLAMO', 'CANCELADO', 'CERRADO'] as const)(
      'is not offered in %s',
      async (status) => {
        await open(status);

        expect(button()).toBeNull();
        expect(view.element('app-worker-actions')).toBeNull();
      },
    );

    it('is not offered to a worker without approved profile', async () => {
      await open('VISITA_REALIZADA', WITH_VISIT, {
        eligible: false,
        message: 'Su perfil está suspendido.',
      });

      expect(button()).toBeNull();
      expect(view.content()).toContain('No puede iniciar el trabajo: Su perfil está suspendido.');
    });

    it('asks for confirmation and sends nothing when dismissed', async () => {
      await open('ANTICIPO_REGISTRADO');
      await view.click('.work__action');

      expect(dialog()?.textContent).toContain('«En ejecución»');
      await view.click('dialog[open] .dialog__cancel');
      expect(dialog()).toBeNull();
      view.http.expectNone(START);
    });

    it('sends once and updates the state, the summary and the history', async () => {
      await open('ANTICIPO_REGISTRADO');
      const request = await send(START);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toBeNull();
      await confirm();
      view.http.expectNone(START);

      request.flush({ status: 'EN_EJECUCION', execution: FINISHED });
      await view.render();
      expect(button()?.disabled).toBe(true);
      await refreshed('EN_EJECUCION', timeline([event({ summary: 'Trabajo en ejecución' })]));

      expect(view.content()).toContain('En ejecución');
      expect(view.content()).toContain('Trabajo en ejecución');
      expect(button()?.textContent).toContain('Marcar como terminado');
      expect(notice()?.textContent).toContain('Trabajo iniciado');
      expect(document.activeElement).toBe(notice());
    });
  });

  describe('finish (#87)', () => {
    it('explains that the client will review it, without computing a deadline', async () => {
      await open('EN_EJECUCION');
      await view.click('.work__action');

      expect(dialog()?.textContent).toContain('confirmar su conformidad');
      expect(dialog()?.textContent).toContain('El plazo lo fija la plataforma');
      expect(dialog()?.textContent).not.toMatch(/\d+ días/);
      await view.click('dialog[open] .dialog__cancel');
    });

    it('sends once and shows the deadline that the backend sends', async () => {
      await open('EN_EJECUCION');
      const request = await send(FINISH);
      await confirm();
      view.http.expectNone(FINISH);

      request.flush({ status: 'TERMINADO', execution: FINISHED });
      await view.render();
      await refreshed('TERMINADO', timeline([event({ summary: 'Trabajo terminado' })]));

      expect(view.content()).toContain('Plazo de conformidad o reclamo28/11/2026 14:00');
      expect(view.element('app-worker-actions')).toBeNull();
      expect(view.element('app-additional-budget-form')).toBeNull();
      expect(notice()?.textContent).toContain('marcado como terminado');
      expect(document.activeElement).toBe(notice());
    });

    it('blocks the other actions while the state is being consulted again', async () => {
      await open('EN_EJECUCION');
      (await send(FINISH)).flush({ status: 'TERMINADO', execution: FINISHED });
      await view.render();

      expect(button()?.disabled).toBe(true);
      expect(view.element<HTMLButtonElement>('.proposal__submit')?.disabled).toBe(true);
      await refreshed('TERMINADO');
    });

    it('keeps the confirmed result when the following query fails, until it is recovered', async () => {
      await open('EN_EJECUCION');
      (await send(FINISH)).flush({ status: 'TERMINADO', execution: FINISHED });
      await view.render();
      await view.fail(WORKFLOW, 500, 'Fallo del servidor');
      await view.answer(TIMELINE, timeline());

      expect(notice()?.textContent).toContain('marcado como terminado');
      expect(button()).toBeNull();

      await view.click('app-error-alert button');
      await refreshed('TERMINADO');
      await view.answer('offers/me', page([NO_VISIT]));
      await view.answer(WHATSAPP, CONTACT);
      await view.answer(`orders/assigned/${ORDER_ID}`, assignedOrder('TERMINADO'));
      expect(notice()?.textContent).toContain('marcado como terminado');
    });

    it('keeps the history paginated after the action', async () => {
      await open('EN_EJECUCION', NO_VISIT, ELIGIBLE, timeline([event()], 'c1'));
      await view.click('.line__more');
      await view.answer(TIMELINE, timeline([event({ id: 'old' })]));
      (await send(FINISH)).flush({ status: 'TERMINADO', execution: FINISHED });
      await view.render();
      await refreshed('TERMINADO', timeline([event()], 'c2'));

      // El historial vuelve a la primera página, con su nuevo cursor.
      await view.click('.line__more');
      const next = await view.request('GET', 'orders', ORDER_ID, 'timeline');
      expect(next.request.params.get('cursor')).toBe('c2');
      next.flush(timeline([event({ id: 'end', summary: 'Trabajo terminado' })]));
      await view.render();
      expect(view.root().querySelectorAll('.line__item')).toHaveLength(2);
      expect(view.content()).toContain('Trabajo terminado');
    });
  });

  describe.each([
    ['start', 'ANTICIPO_REGISTRADO', START],
    ['finish', 'EN_EJECUCION', FINISH],
  ] as const)('errors of %s', (_, status, url) => {
    it.each([
      [403, 'Su perfil no está aprobado'],
      [404, 'El pedido no existe'],
      [409, 'La oferta requiere visita: registre primero la visita.'],
    ])('shows a %i answer and consults everything again', async (code, message) => {
      await open(status);
      await fail(await send(url), code, message);

      expect(notice()?.textContent).toContain(message);
      await view.answer(ELIGIBILITY, ELIGIBLE);
      await refreshed(status);
      await view.answer('offers/me', page([NO_VISIT]));
      await view.answer(WHATSAPP, CONTACT);
      expect(notice()?.textContent).toContain(message);
    });

    it('hides the internal status name of a conflict', async () => {
      await open(status);
      await fail(await send(url), 409, `No se puede hacer con el pedido en estado CANCELADO.`);

      expect(notice()?.textContent).toContain('El pedido cambió de estado');
      await view.answer(ELIGIBILITY, ELIGIBLE);
      await refreshed(status);
      await view.answer('offers/me', page([NO_VISIT]));
      await view.answer(WHATSAPP, CONTACT);
    });

    it('shows a server failure and allows retrying', async () => {
      await open(status);
      await fail(await send(url), 500, 'boom');

      expect(notice()?.textContent).toContain('error en el servidor');
      expect(button()?.disabled).toBe(false);
    });

    it('closes the session on a 401', async () => {
      await open(status);
      await fail(await send(url), 401, 'Unauthorized');

      expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
    });
  });
});
