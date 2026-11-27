import { page, received, setupOfferPage, ORDER_ID } from '../../offers/testing/offers.fixtures';
import { OfferParty } from '../../offers/models/offer.model';
import { OrderStatus } from '../../orders/models/order.model';
import { MY_ORDERS_ROUTES } from '../../orders/orders.routes';
import { ownerOrder } from '../../orders/testing/order.fixtures';
import {
  NOTICE,
  cancellationSummary,
  declaration,
  overview,
  payment,
  receipts,
} from '../../payments/testing/payments.fixtures';
import { cancellation, dataRows, event, timeline, workflow } from '../testing/workflow.fixtures';
import { ASSIGNED_JOBS_ROUTES } from '../workflow.routes';

const ACCEPTED = received({ status: 'ACEPTADA' });
const SUMMARY = `orders/${ORDER_ID}/cancellation-summary`;
const PAYMENTS = `orders/${ORDER_ID}/payments`;
const BALANCE_NOTE = 'Informativo: saldo registrado al cancelar.';

/** Pagos (#99) de la misma cancelación que describe `cancellationSummary()`. */
function cancelledPayments() {
  const summary = cancellationSummary();
  return overview({
    orderStatus: 'CANCELADO',
    agreement: { baseAmount: '400.00', acceptedAdditional: '50.00', totalAmount: '450.00' },
    payments: [
      payment({
        concept: 'VISITA',
        expectedAmount: '30.00',
        declarations: [declaration({ id: 'v1', amount: '30.00', method: 'EFECTIVO' })],
        comparison: 'SOLO_CLIENTE',
      }),
      payment({
        concept: 'ANTICIPO',
        expectedAmount: '100.00',
        declarations: summary.advance!.declarations,
        comparison: 'MONTOS_DIFERENTES',
        difference: '-50.00',
      }),
    ],
    balance: {
      status: 'CALCULADO',
      amount: '350.00',
      advanceAmount: '100.00',
      additionalBudgetsTotal: '50.00',
      note: BALANCE_NOTE,
    },
  });
}

interface Setup {
  status?: OrderStatus;
  /** Respuestas que fallan en lugar de contestar. */
  fails?: readonly ('summary' | 'payments')[];
}

describe.each([
  {
    viewer: 'CLIENTE' as OfferParty,
    routes: [{ path: 'cliente/mis-pedidos', children: MY_ORDERS_ROUTES }],
    url: `/cliente/mis-pedidos/${ORDER_ID}/seguimiento`,
    who: 'Cliente (usted)',
  },
  {
    viewer: 'TRABAJADOR' as OfferParty,
    routes: [{ path: 'trabajador/trabajos', children: ASSIGNED_JOBS_ROUTES }],
    url: `/trabajador/trabajos/${ORDER_ID}`,
    who: 'Cliente',
  },
])('cancelled order seen by $viewer', ({ viewer, routes, url, who }) => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    view = await setupOfferPage(routes, viewer);
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  async function open({ status = 'CANCELADO', fails = [] }: Setup = {}): Promise<void> {
    const cancelled = status === 'CANCELADO';
    await view.visit(url);
    await view.answer(`orders/${ORDER_ID}/workflow`, workflow(status));
    await view.answer(
      `orders/${ORDER_ID}/timeline`,
      timeline(cancelled ? [event(), cancellation()] : [event()]),
    );
    if (viewer === 'CLIENTE') {
      await view.answer(`orders/me/${ORDER_ID}`, ownerOrder({ status }));
      await view.answer('offers/received', page([ACCEPTED]));
    } else {
      await view.answer('offers/me', page([ACCEPTED]));
    }
    if (fails.includes('payments')) {
      await view.fail(PAYMENTS, 500);
    } else {
      await view.answer(
        PAYMENTS,
        cancelled ? cancelledPayments() : { ...cancelledPayments(), orderStatus: status },
      );
    }
    await view.answer(`orders/${ORDER_ID}/receipts`, receipts());
    if (cancelled) {
      if (fails.includes('summary')) {
        await view.fail(SUMMARY, 500);
      } else {
        await view.answer(SUMMARY, cancellationSummary());
      }
    } else {
      // Con el acuerdo vigente se piden además el contacto y, el asignado, los datos del pedido.
      view.http.match((request) => /whatsapp|orders\/assigned|eligibility/.test(request.url));
    }
  }

  const textOf = (selector: string) =>
    (view.element(selector)?.textContent ?? '').replace(/\s+/g, ' ');
  const record = () => textOf('app-cancellation-record');
  const summary = () => textOf('app-cancellation-summary');
  const payments = () => textOf('app-payments-section');
  const times = (fragment: string) => view.content().split(fragment).length - 1;

  it('shows the cancellation card with role, date, previous status and reason', async () => {
    await open();

    expect(record()).toContain('Cancelación');
    expect(dataRows(view.element('app-cancellation-record'))).toEqual([
      ['Cancelado por', who],
      ['Fecha', '22/11/2026 10:00'],
      ['Estado anterior', 'En ejecución'],
      ['Motivo', 'Cambié de planes'],
    ]);
    expect(view.root().querySelectorAll('app-cancellation-record')).toHaveLength(1);
  });

  it('shows the balance only in the payments and each declaration only in the summary', async () => {
    await open();

    expect(payments()).toContain('Saldo registrado al cancelar');
    expect(payments()).toContain(BALANCE_NOTE);
    expect(times('Bs 350.00')).toBe(1);
    expect(summary()).toContain('El saldo pendiente al cancelar se muestra en «Pagos».');

    for (const declared of ['declaró Bs 150.00', 'declaró Bs 100.00', 'declaró Bs 30.00']) {
      expect(times(declared), declared).toBe(1);
      expect(summary()).toContain(declared);
    }
    expect(times(NOTICE)).toBe(1);
    expect(payments()).toContain('se detalla en el resumen de la cancelación');
  });

  it('keeps the historical amounts and what each payment still needs', async () => {
    await open();

    for (const amount of ['Bs 400.00', 'Bs 50.00', 'Bs 450.00']) {
      expect(summary()).toContain(amount);
    }
    expect(payments()).toContain('Los montos declarados difieren');
    expect(payments()).toContain('Bs -50.00');
    expect(payments()).toContain('Declarado — sin confirmar');
  });

  it('keeps the declarations and the notice in the payments if the summary fails', async () => {
    await open({ fails: ['summary'] });

    expect(payments()).toContain('declaró Bs 150.00');
    expect(payments()).toContain(NOTICE);
    expect(times('Bs 350.00')).toBe(1);
    expect(record()).toContain('Cambié de planes');
  });

  it('keeps the balance in the summary if the payments fail', async () => {
    await open({ fails: ['payments'] });

    expect(dataRows(view.element('app-cancellation-summary'))).toContainEqual([
      'Saldo pendiente',
      'Bs 350.00',
    ]);
    expect(summary()).toContain('Solo el anticipo confirmado');
    expect(summary()).toContain('declaró Bs 150.00');
  });

  it('shows no cancellation sections for work that is not cancelled', async () => {
    await open({ status: 'EN_EJECUCION' });

    expect(view.element('app-cancellation-record')).toBeNull();
    expect(view.element('app-cancellation-summary')).toBeNull();
    expect(payments()).toContain('declaró Bs 150.00');
    expect(payments()).toContain(NOTICE);
  });
});
