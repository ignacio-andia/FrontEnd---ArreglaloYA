import { apiUrl } from '../../../core/http/api-url';
import { setupOfferPage } from '../../offers/testing/offers.fixtures';
import { FinancialReport } from '../models/financial-report.model';
import { REPORTS_ROUTES } from '../reports.routes';

const ORDER = '3f1c2a4b-1111-4222-8333-944455556666';
const NOTICE =
  'El pago se realiza directamente al trabajador. La comisión es solo informativa: la plataforma no la cobra.';

const financial = (overrides: Partial<FinancialReport> = {}): FinancialReport => ({
  report: 'financiero',
  from: '2026-11-01',
  to: '2026-11-30',
  basis: 'fecha del acuerdo (aceptación de la oferta)',
  statuses: [],
  commissionPercent: '15.00',
  notice: NOTICE,
  columns: [
    'pedido',
    'fecha_acuerdo',
    'categoria',
    'zona',
    'estado',
    'monto_oferta',
    'adicionales_aceptados',
    'costo_visita',
    'total_esperado',
    'ingresos_confirmados',
    'pendiente',
    'comision',
  ],
  rows: [
    [
      ORDER,
      '2026-11-20 11:30',
      'Plomería',
      'Norte',
      'EN_EJECUCION',
      '200.00',
      '40.00',
      '30.00',
      '270.00',
      '80.00',
      '190.00',
      '12.00',
    ],
  ],
  totals: {
    orders: 1,
    expected: '270.00',
    income: '80.00',
    pending: '190.00',
    commission: '12.00',
  },
  message: null,
  ...overrides,
});

/** Reporte financiero de servicios en `/admin/reportes/financiero`. */
describe('FinancialReportPageComponent', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    view = await setupOfferPage(
      [{ path: 'admin/reportes', children: REPORTS_ROUTES }],
      'ADMINISTRADOR',
    );
    await view.visit('/admin/reportes/financiero');
    // La página se carga de forma diferida y no hace peticiones al abrirse.
    await vi.waitFor(async () => {
      await view.render();
      expect(view.element('#financial-from')).not.toBeNull();
    });
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  const request = () => view.request('GET', 'admin', 'reports', 'financiero');

  async function generate(from = '2026-11-01', to = '2026-11-30'): Promise<void> {
    await view.type('#financial-from', from);
    await view.type('#financial-to', to);
    await view.click('button[type="submit"]');
  }

  async function check(label: string): Promise<void> {
    const box = [...view.root().querySelectorAll<HTMLLabelElement>('.finance__check')]
      .find((item) => item.textContent?.trim() === label)
      ?.querySelector('input');
    expect(box, label).toBeTruthy();
    box!.click();
    await view.render();
  }

  it('asks for both dates in order before requesting anything', async () => {
    await view.click('button[type="submit"]');
    expect(view.content()).toContain('Indique las dos fechas.');

    await generate('2026-11-30', '2026-11-01');
    expect(view.content()).toContain('La fecha inicial no puede ser posterior a la final.');
    view.http.expectNone((req) => req.url.startsWith(apiUrl('admin', 'reports')));
  });

  it('sends no status when none is checked and shows totals, notice and rows', async () => {
    await generate();
    const json = await request();
    expect(json.request.params.toString()).toBe('from=2026-11-01&to=2026-11-30');
    json.flush(financial());
    await view.render();

    const content = view.content();
    expect(content).toContain('1 pedido del 2026-11-01 al 2026-11-30');
    expect(content).toContain('Todos los estados');
    expect(content).toContain('Total esperadoBs 270.00');
    expect(content).toContain('Ingresos confirmadosBs 80.00');
    expect(content).toContain('Pagos pendientesBs 190.00');
    expect(content).toContain('Comisión (15.00 %)Bs 12.00');
    expect(content).toContain('La comisión es solo informativa');
    expect(content).toContain('La plataforma no procesa pagos');

    const headers = [...view.root().querySelectorAll('th')].map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      'Pedido',
      'Fecha del acuerdo',
      'Categoría',
      'Zona',
      'Estado',
      'Oferta aceptada',
      'Adicionales aceptados',
      'Visita',
      'Total esperado',
      'Ingresos confirmados',
      'Pendiente',
      'Comisión',
    ]);
    const cells = [...view.root().querySelectorAll('tbody td')].map((td) => td.textContent?.trim());
    expect(cells).toContain('En ejecución');
    expect(cells).toContain('Bs 190.00');
    const link = view.element<HTMLAnchorElement>('tbody a')!;
    expect(link.textContent?.trim()).toBe(ORDER.slice(0, 8));
    expect(link.getAttribute('href')).toBe(`/admin/pedidos/${ORDER}`);
  });

  it('sends the checked statuses in the order of the list', async () => {
    await check('Cerrado');
    await check('En ejecución');
    await generate();

    const json = await request();
    expect(json.request.params.get('status')).toBe('EN_EJECUCION,CERRADO');
    json.flush(financial({ statuses: ['EN_EJECUCION', 'CERRADO'] }));
    await view.render();

    expect(view.content()).toContain('Estados: En ejecución, Cerrado.');
  });

  it('clears the statuses', async () => {
    await check('Cerrado');
    await view.click('.offers__actions .offers__secondary');
    await generate();

    const json = await request();
    expect(json.request.params.has('status')).toBe(false);
    json.flush(financial());
    await view.render();
  });

  it('shows the empty message of the backend without a table', async () => {
    await generate();
    (await request()).flush(
      financial({
        rows: [],
        totals: {
          orders: 0,
          expected: '0.00',
          income: '0.00',
          pending: '0.00',
          commission: '0.00',
        },
        message: 'No hay datos en el rango indicado.',
      }),
    );
    await view.render();

    expect(view.content()).toContain('0 pedidos');
    expect(view.content()).toContain('No hay datos en el rango indicado.');
    expect(view.element('table')).toBeNull();
  });

  it('downloads the CSV with the same filters', async () => {
    await check('Terminado');
    await generate();
    (await request()).flush(financial({ statuses: ['TERMINADO'] }));
    await view.render();

    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    Object.assign(URL, { createObjectURL: () => 'blob:csv', revokeObjectURL: () => undefined });
    const button = [...view.root().querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === 'Descargar CSV',
    )!;
    button.click();
    const csv = await request();
    expect(csv.request.params.get('format')).toBe('csv');
    expect(csv.request.params.get('status')).toBe('TERMINADO');
    expect(csv.request.responseType).toBe('blob');
    csv.flush(new Blob(['a,b']));
    await view.render();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('shows and retries an error of the backend', async () => {
    await generate();
    await view.fail('admin/reports/financiero', 400, 'Rango de fechas no válido');
    expect(view.content()).toContain('Rango de fechas no válido');

    await view.click('app-error-alert button');
    await view.answer('admin/reports/financiero', financial());
    expect(view.content()).toContain('1 pedido');
  });
});
