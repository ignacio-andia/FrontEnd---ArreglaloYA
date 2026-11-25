import { TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { ORDER_ID, offer, page, setupOfferPage } from '../../../offers/testing/offers.fixtures';
import { OrderStatus } from '../../../orders/models/order.model';
import { overview, receipts } from '../../../payments/testing/payments.fixtures';
import { AdditionalBudget } from '../../models/workflow.model';
import { assignedOrder, event, timeline, workflow } from '../../testing/workflow.fixtures';
import { ASSIGNED_JOBS_ROUTES } from '../../workflow.routes';

const ACCEPTED = offer({ status: 'ACEPTADA', requiresVisit: false, visitCost: null });
const CONTACT = {
  available: false,
  contactRole: 'CLIENTE',
  url: null,
  reason: 'TELEFONO_NO_REGISTRADO',
};
const ELIGIBLE = { eligible: true, message: 'Perfil aprobado.' };
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

const WORKFLOW = `orders/${ORDER_ID}/workflow`;
const TIMELINE = `orders/${ORDER_ID}/timeline`;
const PAYMENTS = `orders/${ORDER_ID}/payments`;
const RECEIPTS = `orders/${ORDER_ID}/receipts`;
const WHATSAPP = `offers/me/${ACCEPTED.id}/whatsapp`;
const ELIGIBILITY = 'worker-profile/me/eligibility';
const PROPOSE = apiUrl('orders', ORDER_ID, 'additional-budgets');

describe('JobPageComponent: additional budgets', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    view = await setupOfferPage(
      [{ path: 'trabajador/trabajos', children: ASSIGNED_JOBS_ROUTES }],
      'TRABAJADOR',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  async function open(
    status: OrderStatus,
    budgets: AdditionalBudget[] = [],
    eligibility: object | null = ELIGIBLE,
  ): Promise<void> {
    const inProgress = status === 'VISITA_REALIZADA' || status === 'EN_EJECUCION';
    await view.visit(`/trabajador/trabajos/${ORDER_ID}`);
    await view.answer(WORKFLOW, workflow(status, { additionalBudgets: budgets }));
    await view.answer(TIMELINE, timeline());
    await view.answer('offers/me', page([ACCEPTED]));
    await view.answer(PAYMENTS, overview({ orderStatus: status, payments: [] }));
    await view.answer(RECEIPTS, receipts());
    if (status !== 'CERRADO' && status !== 'CANCELADO') {
      await view.answer(WHATSAPP, CONTACT);
      await view.answer(`orders/assigned/${ORDER_ID}`, assignedOrder(status));
    }
    if (inProgress && eligibility !== null) {
      await view.answer(ELIGIBILITY, eligibility);
    }
  }

  const form = () => view.element('.proposal__form');
  const submit = () => view.element<HTMLButtonElement>('.proposal__submit');
  const dialog = () => view.element('dialog[open]');
  const confirm = () => view.click('dialog[open] .dialog__confirm');
  const notice = () => view.element('#action-notice');

  async function fill(
    amount = '40,50',
    reason = '  Otra pieza dañada  ',
    materials = 'Llave de paso',
  ) {
    for (const [name, value] of Object.entries({ amount, reason, materials })) {
      const control = view.element<HTMLInputElement>(`#budget-${name}`)!;
      control.value = value;
      control.dispatchEvent(new Event('input'));
    }
    await view.click('.proposal__submit');
  }

  async function send(): Promise<TestRequest> {
    await fill();
    await confirm();
    return view.http.expectOne(PROPOSE);
  }

  async function fail(request: TestRequest, status: number, message: string | string[]) {
    request.flush({ statusCode: status, message }, { status, statusText: 'Error' });
    await view.render();
  }

  /** Consultas que se repiten cuando lo mostrado quedó desactualizado. */
  async function reloaded(status: OrderStatus, budgets: AdditionalBudget[] = []) {
    await view.answer(ELIGIBILITY, ELIGIBLE);
    await view.answer(WORKFLOW, workflow(status, { additionalBudgets: budgets }));
    await view.answer(TIMELINE, timeline());
    await view.answer('offers/me', page([ACCEPTED]));
    await view.answer(PAYMENTS, overview({ orderStatus: status, payments: [] }));
    await view.answer(RECEIPTS, receipts());
    await view.answer(WHATSAPP, CONTACT);
  }

  it.each(['VISITA_REALIZADA', 'EN_EJECUCION'] as const)(
    'offers the proposal to the approved worker in %s',
    async (status) => {
      await open(status);

      expect(form()).not.toBeNull();
      expect(view.content()).toContain('El monto original no cambia');
    },
  );

  it.each(['ACORDADO', 'ANTICIPO_REGISTRADO', 'TERMINADO', 'CANCELADO', 'CERRADO'] as const)(
    'does not offer it in %s',
    async (status) => {
      await open(status);

      expect(view.element('app-additional-budget-form')).toBeNull();
    },
  );

  it('shows a pending budget without letting the worker answer or add another', async () => {
    await open('PRESUPUESTO_ADICIONAL_PENDIENTE', [BUDGET]);

    const list = view.element('app-additional-budget-list')!.textContent!;
    for (const text of ['Bs 40.50', 'Pendiente de respuesta', 'Otra pieza dañada']) {
      expect(list).toContain(text);
    }
    expect(list).toContain('Llave de paso');
    expect(list).toContain('21/11/2026 10:00');
    expect(list).toContain('no puede proponer otro');
    expect(view.element('app-budget-response')).toBeNull();
    expect(view.element('app-additional-budget-form')).toBeNull();
  });

  it.each([['not approved', { eligible: false, message: 'Su perfil está suspendido.' }]])(
    'does not offer the form to a worker who is %s',
    async (_, eligibility) => {
      await open('EN_EJECUCION', [], eligibility);

      expect(form()).toBeNull();
      expect(view.content()).toContain(
        'No puede proponer un presupuesto: Su perfil está suspendido.',
      );
    },
  );

  it('retries a profile check that failed', async () => {
    await open('EN_EJECUCION', [], null);
    await view.fail(ELIGIBILITY, 500, 'Fallo');
    expect(form()).toBeNull();

    await view.click('app-additional-budget-form app-error-alert button');
    await view.answer(ELIGIBILITY, ELIGIBLE);
    expect(form()).not.toBeNull();
  });

  it('requires the three fields and focuses the first one', async () => {
    await open('EN_EJECUCION');
    await fill('', '   ', '');

    for (const text of ['Indique el monto', 'Explique el motivo', 'Indique los materiales']) {
      expect(view.content()).toContain(text);
    }
    expect(document.activeElement?.id).toBe('budget-amount');
    expect(dialog()).toBeNull();
  });

  it.each(['0', '0.00', '-5', 'abc', '1.234', '123456789', '1.000,50'])(
    'rejects the amount %s',
    async (amount) => {
      await open('EN_EJECUCION');
      await fill(amount);

      expect(view.content()).toContain('Ingrese un monto mayor que 0');
      expect(dialog()).toBeNull();
    },
  );

  it('rejects texts longer than 1000 characters', async () => {
    await open('EN_EJECUCION');
    await fill('10', 'a'.repeat(1001), 'b'.repeat(1001));

    expect(view.content().match(/Use como máximo 1000 caracteres/g)).toHaveLength(2);
    expect(document.activeElement?.id).toBe('budget-reason');
    expect(dialog()).toBeNull();
  });

  it('accepts the limits of the contract', async () => {
    await open('EN_EJECUCION');
    await fill('99999999.99', 'a'.repeat(1000), 'b'.repeat(1000));

    expect(dialog()?.textContent).toContain('Bs 99999999.99');
  });

  it('asks for confirmation and sends nothing when dismissed', async () => {
    await open('EN_EJECUCION');
    await fill();

    expect(dialog()?.textContent).toContain('Bs 40.50');
    expect(dialog()?.textContent).toContain('si lo rechaza, se cerrará');
    await view.click('dialog[open] .dialog__cancel');
    expect(dialog()).toBeNull();
    view.http.expectNone(PROPOSE);
  });

  it('sends once and updates the state, the payments and the history', async () => {
    await open('EN_EJECUCION');
    const request = await send();
    expect(request.request.body).toEqual({
      amount: '40.50',
      reason: 'Otra pieza dañada',
      materials: 'Llave de paso',
    });
    await confirm();
    view.http.expectNone(PROPOSE);

    request.flush({ status: 'PRESUPUESTO_ADICIONAL_PENDIENTE', budget: BUDGET });
    await view.render();
    expect(submit()?.disabled).toBe(true);

    await view.answer(
      WORKFLOW,
      workflow('PRESUPUESTO_ADICIONAL_PENDIENTE', { additionalBudgets: [BUDGET] }),
    );
    await view.answer(TIMELINE, timeline([event({ summary: 'Presupuesto adicional propuesto' })]));
    await view.answer(
      PAYMENTS,
      overview({ orderStatus: 'PRESUPUESTO_ADICIONAL_PENDIENTE', payments: [] }),
    );
    await view.answer(RECEIPTS, receipts());

    expect(view.element('app-additional-budget-form')).toBeNull();
    expect(view.content()).toContain('Presupuesto adicional propuesto');
    expect(notice()?.textContent).toContain('Bs 40.50 enviado');
    expect(document.activeElement).toBe(notice());
  });

  it('keeps the confirmed result when the following query fails, also on retry', async () => {
    await open('EN_EJECUCION');
    (await send()).flush({ status: 'PRESUPUESTO_ADICIONAL_PENDIENTE', budget: BUDGET });
    await view.render();
    await view.fail(WORKFLOW, 500, 'Fallo del servidor');
    await view.answer(TIMELINE, timeline());

    expect(notice()?.textContent).toContain('Bs 40.50 enviado');
    expect(view.content()).toContain('Ocurrió un error en el servidor');

    await view.click('app-error-alert button');
    expect(notice()?.textContent).toContain('Bs 40.50 enviado');
    await view.answer(
      WORKFLOW,
      workflow('PRESUPUESTO_ADICIONAL_PENDIENTE', { additionalBudgets: [BUDGET] }),
    );
    await view.answer(TIMELINE, timeline());
    await view.answer('offers/me', page([ACCEPTED]));
    await view.answer(PAYMENTS, overview({ payments: [] }));
    await view.answer(RECEIPTS, receipts());
    await view.answer(WHATSAPP, CONTACT);
    await view.answer(`orders/assigned/${ORDER_ID}`, assignedOrder('EN_EJECUCION'));
  });

  it('shows a 400 of the backend and keeps what was written', async () => {
    await open('EN_EJECUCION');
    await fail(await send(), 400, ['El monto adicional debe ser mayor a cero.']);

    expect(notice()?.textContent).toContain('mayor a cero');
    expect(view.element<HTMLInputElement>('#budget-amount')?.value).toBe('40,50');
    expect(submit()?.disabled).toBe(false);
  });

  it.each([
    [403, 'Su perfil no está aprobado'],
    [404, 'El pedido no existe'],
    [409, 'Ya hay un presupuesto adicional pendiente en este pedido.'],
  ])('shows a %i answer and consults again', async (status, message) => {
    await open('EN_EJECUCION');
    await fail(await send(), status, message);

    expect(notice()?.textContent).toContain(message);
    await reloaded('EN_EJECUCION');
    expect(notice()?.textContent).toContain(message);
  });

  it('does not show the internal status name of a state conflict', async () => {
    await open('EN_EJECUCION');
    await fail(
      await send(),
      409,
      'No se puede proponer un presupuesto adicional con el pedido en estado TERMINADO.',
    );

    expect(notice()?.textContent).toContain('El pedido cambió de estado');
    expect(view.content()).not.toContain('en estado TERMINADO');
    await reloaded('EN_EJECUCION');
  });

  it('closes the session when the token is no longer valid', async () => {
    await open('EN_EJECUCION');
    await fail(await send(), 401, 'Unauthorized');

    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
  });
});
