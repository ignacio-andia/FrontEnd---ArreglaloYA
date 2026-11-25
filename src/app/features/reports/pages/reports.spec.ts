import { apiUrl } from '../../../core/http/api-url';
import { setupOfferPage } from '../../offers/testing/offers.fixtures';
import { dayBounds, isDateOnly } from '../../../shared/utils/date-range';
import { Report } from '../models/report.model';
import { REPORTS_ROUTES } from '../reports.routes';
import { reportTable } from '../utils/report-table';

const report = (overrides: Partial<Report> = {}): Report => ({
  report: 'pedidos',
  from: '2026-11-01',
  to: '2026-11-30',
  basis: 'fecha de publicación del pedido',
  columns: ['categoria', 'zona', 'estado', 'total'],
  rows: [['Plomería', 'Zona Norte', 'EN_EJECUCION', 3]],
  total: 3,
  message: null,
  ...overrides,
});

describe('reports', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    view = await setupOfferPage(
      [{ path: 'admin/reportes', children: REPORTS_ROUTES }],
      'ADMINISTRADOR',
    );
    await view.visit('/admin/reportes');
    // La página se carga de forma diferida y no hace peticiones al abrirse.
    await vi.waitFor(async () => {
      await view.render();
      expect(view.element('#report-type')).not.toBeNull();
    });
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  const request = (type = 'pedidos') => view.request('GET', 'admin', 'reports', type);

  async function generate(from = '2026-11-01', to = '2026-11-30'): Promise<void> {
    await view.type('#report-from', from);
    await view.type('#report-to', to);
    await view.click('button[type="submit"]');
  }

  it('asks for both dates in order before requesting anything', async () => {
    await view.click('button[type="submit"]');
    expect(view.content()).toContain('Indique las dos fechas.');

    await generate('2026-11-30', '2026-11-01');
    expect(view.content()).toContain('La fecha inicial no puede ser posterior a la final.');
    view.http.expectNone((req) => req.url.startsWith(apiUrl('admin', 'reports')));
  });

  it('shows the table with translated values and downloads the same report (#115)', async () => {
    await generate();
    const json = await request();
    expect(json.request.params.toString()).toBe('from=2026-11-01&to=2026-11-30');
    json.flush(report());
    await view.render();

    for (const text of ['Pedidos: 3 registros', 'Categoría', 'En ejecución', 'Zona Norte']) {
      expect(view.content()).toContain(text);
    }

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
    expect(csv.request.responseType).toBe('blob');
    csv.flush(new Blob(['a,b']));
    await view.render();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('shows the empty message of the backend', async () => {
    await view.type('#report-type', 'reclamos');
    await generate();
    (await request('reclamos')).flush(
      report({ report: 'reclamos', rows: [], total: 0, message: 'No hay datos en ese rango.' }),
    );
    await view.render();

    expect(view.content()).toContain('Reclamos: 0 registros');
    expect(view.content()).toContain('No hay datos en ese rango.');
    expect(view.element('table')).toBeNull();
  });

  it('shows and retries an error', async () => {
    await generate();
    await view.fail('admin/reports/pedidos', 500, 'Fallo');
    await view.click('app-error-alert button');
    await view.answer('admin/reports/pedidos', report());
    expect(view.content()).toContain('Pedidos: 3 registros');
  });

  it('translates statuses according to the report', () => {
    expect(
      reportTable(report({ report: 'reclamos', rows: [['a', 'b', 'ABIERTO', 1]] })).rows,
    ).toEqual([['a', 'b', 'Abierto', 1]]);
  });

  it('builds Bolivian day limits and rejects impossible dates', () => {
    expect(dayBounds('2026-11-01').start).toBe('2026-11-01T00:00:00.000-04:00');
    expect(isDateOnly('2026-02-30')).toBe(false);
    expect(isDateOnly('2026-02-28')).toBe(true);
  });
});
