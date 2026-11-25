import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { OfferParty } from '../../../offers/models/offer.model';
import { ORDER_ID } from '../../../offers/testing/offers.fixtures';
import { CLIENT } from '../../../orders/testing/order.fixtures';
import { workflow } from '../../../workflow/testing/workflow.fixtures';
import { declaration, overview, payment, receipts } from '../../testing/payments.fixtures';
import { PaymentsSectionComponent } from './payments-section.component';

const PAYMENTS = apiUrl('orders', ORDER_ID, 'payments');
const RECEIPTS = apiUrl('orders', ORDER_ID, 'receipts');
const declareUrl = (concept: string) =>
  apiUrl('orders', ORDER_ID, 'payments', concept, 'declarations');

describe('PaymentsSectionComponent', () => {
  let fixture: ComponentFixture<PaymentsSectionComponent>;
  let http: HttpTestingController;
  let changed: number;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    TestBed.inject(SessionStore).setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: CLIENT,
    });
    http = TestBed.inject(HttpTestingController);
    changed = 0;
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const content = () => (root().textContent ?? '').replace(/\s+/g, ' ');

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  function create(viewer: OfferParty, status = overview().orderStatus): void {
    fixture = TestBed.createComponent(PaymentsSectionComponent);
    fixture.componentRef.setInput('viewer', viewer);
    fixture.componentRef.setInput('workflow', workflow(status));
    fixture.componentInstance.changed.subscribe(() => (changed += 1));
    fixture.detectChanges();
  }

  async function open(viewer: OfferParty, data = overview(), proofs = receipts()): Promise<void> {
    create(viewer, data.orderStatus);
    http.expectOne(PAYMENTS).flush(data);
    http.expectOne(RECEIPTS).flush(proofs);
    await render();
  }

  async function click(selector: string): Promise<void> {
    const target = root().querySelector<HTMLElement>(selector);
    expect(target, selector).not.toBeNull();
    target!.click();
    await render();
  }

  async function amount(value: string): Promise<void> {
    const input = root().querySelector<HTMLInputElement>('#declare-anticipo-amount')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await render();
  }

  /** Elige el método (0 efectivo, 1 QR) y abre la confirmación. */
  async function review(method = 0): Promise<void> {
    root().querySelectorAll<HTMLInputElement>('.pay input[type="radio"]')[method].click();
    await click('.declare__button');
  }

  const dialog = () => root().querySelector('dialog[open]');
  const confirm = () => click('dialog[open] .dialog__confirm');
  const input = () => root().querySelector<HTMLInputElement>('#declare-anticipo-amount');

  it('shows loading and then the summary exactly as the backend sends it', async () => {
    create('CLIENTE');
    expect(content()).toContain('Cargando los pagos');
    expect(content()).toContain('Cargando las constancias');

    http.expectOne(PAYMENTS).flush(overview());
    http.expectOne(RECEIPTS).flush(receipts());
    await render();

    const text = content();
    expect(text).toContain('El pago se realiza directamente al trabajador');
    expect(text).toContain('Monto original acordadoBs 100.00');
    expect(text).toContain('Saldo esperadoBs 75.00');
    expect(text).toContain('Anticipo (25 %)');
    expect(text).toContain('Bs 25.00');
    expect(text).toContain('Sin declaraciones');
    expect(text).toContain('Sin confirmación del trabajador');
    expect(text).toContain('cuando el trabajo esté terminado');
    expect(text).toContain('Constancia del servicio');
    expect(text).toContain('no son comprobantes bancarios');
  });

  it('shows both declarations, the difference and the mismatched method', async () => {
    const declarations = [
      declaration(),
      declaration({ id: 'd2', declaredBy: 'TRABAJADOR', amount: '20.00', method: 'EFECTIVO' }),
    ];
    await open(
      'CLIENTE',
      overview({
        orderStatus: 'TERMINADO',
        payments: [
          payment({
            concept: 'SALDO',
            expectedAmount: null,
            declarations,
            comparison: 'MONTOS_DIFERENTES',
            difference: '-5.00',
            methodsMatch: false,
          }),
        ],
      }),
      receipts({
        payments: declarations.map((item) => ({
          concept: 'SALDO',
          paymentId: 'p1',
          declaration: item,
        })),
      }),
    );

    const text = content();
    expect(text).toContain('Los montos declarados difieren');
    expect(text).toContain('Bs -5.00');
    expect(text).toContain('no coinciden');
    expect(text).toContain('Confirmado por el trabajador');
    expect(text).toContain('Cliente (usted)');
    expect(text).toContain('Declaración del trabajador: Saldo');
    expect(root().querySelector('app-declare-payment-form')).toBeNull();
  });

  it('explains an order without agreement and without receipts', async () => {
    await open('CLIENTE', overview({ agreement: null, payments: [] }), receipts({ service: null }));

    expect(content()).toContain('no tiene un acuerdo');
    expect(content()).toContain('Todavía no hay constancias');
  });

  it('does not present the figures of a cancelled order as money owed', async () => {
    await open('CLIENTE', overview({ orderStatus: 'CANCELADO' }));

    expect(content()).toContain('no indican un cobro ni una devolución pendiente');
    expect(root().querySelector('app-declare-payment-form')).toBeNull();
  });

  it('never offers the client to confirm the collection of the visit', async () => {
    fixture = TestBed.createComponent(PaymentsSectionComponent);
    fixture.componentRef.setInput('viewer', 'CLIENTE');
    fixture.componentRef.setInput(
      'workflow',
      workflow('VISITA_REALIZADA', {
        visit: { orderId: ORDER_ID, performedAt: '2026-11-21T14:00:00Z', visitCost: '30.00' },
      }),
    );
    fixture.componentRef.setInput('clearance', { state: 'approved' });
    fixture.detectChanges();
    http.expectOne(PAYMENTS).flush(
      overview({
        orderStatus: 'VISITA_REALIZADA',
        payments: [payment({ concept: 'VISITA', expectedAmount: '30.00' })],
      }),
    );
    http.expectOne(RECEIPTS).flush(receipts());
    await render();

    expect(root().querySelector('app-confirm-visit-payment')).toBeNull();
    expect(content()).toContain('ya pagué');
  });

  it('fixes the advance the worker confirms to the expected amount', async () => {
    await open('TRABAJADOR');

    expect(input()?.value).toBe('25.00');
    expect(input()?.readOnly).toBe(true);
    expect(root().querySelector('.declare__button')?.textContent).toContain(
      'Confirmar que me pagaron',
    );
  });

  it('lets the client declare the amount really paid', async () => {
    await open('CLIENTE');

    expect(input()?.readOnly).toBe(false);
    expect(root().querySelector('.declare__button')?.textContent).toContain('ya pagué');
  });

  it('validates amount and method before asking for confirmation', async () => {
    await open('CLIENTE');
    await amount('0');
    await click('.declare__button');

    expect(content()).toContain('Ingrese un monto mayor que 0');
    expect(content()).toContain('Elija la forma de pago');
    expect(dialog()).toBeNull();
  });

  it('confirms, sends once and refreshes the page', async () => {
    await open('TRABAJADOR');
    await review(1);

    expect(dialog()?.textContent).toContain('Bs 25.00');
    expect(dialog()?.textContent).toContain('no se edita ni se borra');
    http.expectNone(declareUrl('ANTICIPO'));

    await confirm();
    const request = http.expectOne(declareUrl('ANTICIPO'));
    expect(request.request.body).toEqual({ amount: '25.00', method: 'QR' });
    // Mientras se envía no se puede repetir.
    await confirm();
    http.expectNone(declareUrl('ANTICIPO'));

    request.flush({
      notice: '',
      payment: payment(),
      orderTransition: 'ANTICIPO_REGISTRADO',
    });
    await render();
    expect(changed).toBe(1);
    expect(content()).toContain('pasó a «Anticipo registrado»');

    // La página entrega el flujo actualizado y se vuelven a consultar pagos y constancias.
    fixture.componentRef.setInput('workflow', workflow('ANTICIPO_REGISTRADO'));
    await render();
    http.expectOne(PAYMENTS).flush(
      overview({
        orderStatus: 'ANTICIPO_REGISTRADO',
        payments: [payment({ declarations: [declaration({ declaredBy: 'TRABAJADOR' })] })],
      }),
    );
    http.expectOne(RECEIPTS).flush(receipts());
    await render();
    expect(content()).toContain('Confirmado por el trabajador');
    expect(root().querySelector('app-declare-payment-form')).toBeNull();
    expect(content()).toContain('Declaración registrada');
  });

  it('sends nothing when the confirmation is dismissed', async () => {
    await open('CLIENTE');
    await review();
    await click('dialog[open] .dialog__cancel');

    expect(dialog()).toBeNull();
  });

  async function reject(status: number, message: string): Promise<void> {
    await open('CLIENTE');
    await review();
    await confirm();
    http
      .expectOne(declareUrl('ANTICIPO'))
      .flush({ statusCode: status, message }, { status, statusText: 'Error' });
    await render();
  }

  it('shows the validation error of the backend without refreshing', async () => {
    await reject(400, 'amount debe ser un monto mayor que 0');

    expect(root().querySelector('#payments-error')?.textContent).toContain('amount');
    expect(changed).toBe(0);
  });

  it.each([
    [403, 'Su perfil no está aprobado'],
    [404, 'El pedido no existe'],
    [409, 'Ya declaró este pago'],
  ])('shows a %i answer and asks the page to refresh', async (status, message) => {
    await reject(status, message);

    expect(root().querySelector('#payments-error')?.textContent).toContain(message);
    expect(changed).toBe(1);
  });

  it('closes the session and goes to the login when the token is no longer valid', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    await reject(401, 'Unauthorized');

    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
    expect(navigate.mock.calls.length + navigateByUrl.mock.calls.length).toBeGreaterThan(0);
  });

  it.each([403, 404, 500])('shows and retries a %i while loading', async (status) => {
    create('CLIENTE');
    const failure = { statusCode: status, message: 'Error' };
    http.expectOne(PAYMENTS).flush(failure, { status, statusText: 'Error' });
    http.expectOne(RECEIPTS).flush(failure, { status, statusText: 'Error' });
    await render();
    expect(root().querySelectorAll('app-error-alert')).toHaveLength(2);

    root()
      .querySelectorAll<HTMLButtonElement>('app-error-alert button')
      .forEach((button) => button.click());
    await render();
    http.expectOne(PAYMENTS).flush(overview());
    http.expectOne(RECEIPTS).flush(receipts());
    await render();
    expect(content()).toContain('Monto original acordado');
  });
});
