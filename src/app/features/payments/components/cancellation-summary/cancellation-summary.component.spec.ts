import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { OfferParty } from '../../../offers/models/offer.model';
import { ORDER_ID } from '../../../offers/testing/offers.fixtures';
import { CancellationSummary } from '../../models/cancellation-summary.model';
import {
  NOTICE,
  cancellationSummary,
  declaration,
  withoutAgreement,
} from '../../testing/payments.fixtures';
import { CancellationSummaryComponent } from './cancellation-summary.component';

const URL = apiUrl('orders', ORDER_ID, 'cancellation-summary');

describe('CancellationSummaryComponent', () => {
  let fixture: ComponentFixture<CancellationSummaryComponent>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const root = () => fixture.nativeElement as HTMLElement;
  const content = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  /** Etiqueta e importe de cada total, tal como se leen. */
  const totals = () =>
    Array.from(root().querySelectorAll('.pay__totals > div'), (row) => [
      row.querySelector('dt')?.textContent?.trim(),
      row.querySelector('dd')?.textContent?.trim(),
    ]);

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  function create(viewer: OfferParty | null = 'CLIENTE'): void {
    fixture = TestBed.createComponent(CancellationSummaryComponent);
    fixture.componentRef.setInput('orderId', ORDER_ID);
    fixture.componentRef.setInput('viewer', viewer);
    fixture.detectChanges();
  }

  async function open(
    data: CancellationSummary = cancellationSummary(),
    viewer: OfferParty | null = 'CLIENTE',
  ): Promise<void> {
    create(viewer);
    http.expectOne(URL).flush(data);
    await render();
  }

  async function fail(status: number, message: string): Promise<void> {
    create();
    http.expectOne(URL).flush({ statusCode: status, message }, { status, statusText: 'Error' });
    await render();
  }

  it('shows loading and then the totals exactly as the backend sends them', async () => {
    create();
    expect(content()).toContain('Cargando el resumen de la cancelación');

    http.expectOne(URL).flush(cancellationSummary());
    await render();

    expect(content()).toContain(NOTICE);
    expect(totals()).toEqual([
      ['Monto acordado', 'Bs 400.00'],
      ['Adicionales aceptados', 'Bs 50.00'],
      ['Total actualizado', 'Bs 450.00'],
      ['Anticipo confirmado', 'Bs 100.00'],
      ['Anticipo declarado sin confirmar', 'No aplica'],
      ['Saldo pendiente', 'Bs 350.00'],
    ]);
  });

  it('does not recalculate: inconsistent amounts are shown as they arrive', async () => {
    const data = cancellationSummary();
    await open({ ...data, totals: { ...data.totals, pendingBalance: '999.99' } });

    expect(totals().at(-1)).toEqual(['Saldo pendiente', 'Bs 999.99']);
  });

  it('tells a real zero from a missing amount', async () => {
    const data = cancellationSummary();
    await open({
      ...data,
      totals: {
        ...data.totals,
        acceptedAdditionalTotal: '0.00',
        confirmedAdvanceTotal: null,
        unconfirmedAdvanceAmount: '100.00',
        pendingBalance: null,
      },
    });

    expect(totals()).toContainEqual(['Adicionales aceptados', 'Bs 0.00']);
    expect(totals()).toContainEqual(['Anticipo confirmado', 'Sin dato']);
    expect(totals()).toContainEqual(['Anticipo declarado sin confirmar', 'Bs 100.00']);
    expect(totals()).toContainEqual(['Saldo pendiente', 'Sin dato']);
  });

  it('keeps the expected advance, both declarations and the visit apart', async () => {
    await open();

    const text = content();
    expect(text).toContain('Anticipo esperado (25 %): Bs 100.00. Es una referencia, no un pago.');
    expect(text).toContain('Cliente (usted) declaró Bs 150.00');
    expect(text).toContain('Trabajador declaró Bs 100.00');
    expect(text).toContain('no es un pago pendiente');
    expect(text).toContain('Visita (aparte del total)');
    expect(text).toContain('Declarado — sin confirmar');
    expect(text).toContain('Bs 50.00 · aceptado el 21/11/2026');
    expect(text).not.toContain('Declaraciones posteriores');
  });

  it('lists the declarations made after cancelling with their concept', async () => {
    await open(
      cancellationSummary({
        declarationsAfterCancellation: [
          {
            ...declaration({ id: 'late', declaredBy: 'TRABAJADOR', amount: '30.00' }),
            concept: 'VISITA',
          },
        ],
      }),
      'TRABAJADOR',
    );

    expect(content()).toContain('Declaraciones posteriores a la cancelación');
    expect(content()).toContain('no cambian los importes de este resumen');
    expect(content()).toContain('Visita · Trabajador (usted) declaró Bs 30.00');
  });

  it('explains a cancellation without agreement and shows no amounts', async () => {
    await open(withoutAgreement());

    expect(content()).toContain('se canceló sin acuerdo');
    expect(content()).toContain(NOTICE);
    expect(totals()).toEqual([]);
    expect(content()).not.toContain('Bs ');
  });

  it('marks nobody as the viewer for an administrator', async () => {
    await open(cancellationSummary(), null);

    expect(content()).not.toContain('(usted)');
  });

  it.each([
    [404, 'El pedido se canceló sin resumen económico registrado.', 'sin un resumen económico'],
    [404, 'El pedido no existe', 'no existe o no tiene acceso'],
  ])('tells apart the %i «%s»', async (status, message, shown) => {
    await fail(status, message);

    expect(content()).toContain(shown);
    expect(root().querySelector('.alert__retry')).toBeNull();
  });

  it('shows a 403 without offering to retry', async () => {
    await fail(403, 'No tiene permisos para realizar esta operación');

    expect(content()).toContain('No tiene permisos');
    expect(root().querySelector('.alert__retry')).toBeNull();
  });

  it.each([
    [409, 'El pedido no está cancelado: no tiene resumen de cancelación.', 'no está cancelado'],
    [500, 'boom', 'error en el servidor'],
  ])('shows a %i and allows retrying', async (status, message, shown) => {
    await fail(status, message);
    expect(content()).toContain(shown);

    root().querySelector<HTMLButtonElement>('.alert__retry')!.click();
    await render();
    http.expectOne(URL).flush(cancellationSummary());
    await render();

    expect(totals()).toHaveLength(6);
  });

  it('consults again when the page refreshes, keeping what is shown', async () => {
    await open();
    fixture.componentRef.setInput('version', {});
    await render();

    const request = http.expectOne(URL);
    expect(totals()).toHaveLength(6);
    request.flush(cancellationSummary());
    await render();
  });
});
