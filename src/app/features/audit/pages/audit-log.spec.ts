import { apiUrl } from '../../../core/http/api-url';
import { page, setupOfferPage } from '../../offers/testing/offers.fixtures';
import { AUDIT_ROUTES } from '../audit.routes';
import { AuditLog } from '../models/audit-log.model';
import { describeAuditDetails } from '../utils/audit-details';

const entry = (overrides: Partial<AuditLog> = {}): AuditLog => ({
  id: 'a1',
  action: 'CAMBIO_ESTADO',
  entityType: 'PERFIL_TRABAJADOR',
  entityId: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
  details: { from: 'PENDIENTE', to: 'APROBADO', reason: null },
  createdAt: '2026-11-22T14:00:00.000Z',
  actor: { id: 'u', firstName: 'Admin', lastName: 'Pruebas', email: 'admin@example.com' },
  ...overrides,
});

describe('audit log', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    view = await setupOfferPage(
      [{ path: 'admin/bitacora', children: AUDIT_ROUTES }],
      'ADMINISTRADOR',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  const request = () => view.request('GET', 'audit-logs');

  it('shows who did what and when, and links to the record (#22)', async () => {
    await view.visit('/admin/bitacora');
    const pending = await request();
    expect(pending.request.params.toString()).toBe('page=1&limit=20');
    pending.flush(page([entry()]));
    await view.render();

    for (const text of [
      'Cambio de estado · Perfil de trabajador',
      '22/11/2026 10:00:00',
      'Admin Pruebas',
      'Estado: Pendiente de revisión → Aprobado',
    ]) {
      expect(view.content()).toContain(text);
    }
    expect(view.element('.audit__entry a')?.getAttribute('href')).toBe(
      `/admin/trabajadores/${entry().entityId}`,
    );
    expect(view.element('.audit__entry button')).toBeNull();
  });

  it('filters by entity, action and Bolivian days', async () => {
    await view.visit('/admin/bitacora');
    (await request()).flush(page([]));
    await view.render();

    await view.type('#audit-entity', 'ZONA');
    await view.type('#audit-action', 'CREACION');
    await view.type('#audit-from', '2026-11-01');
    await view.type('#audit-to', '2026-11-02');
    await view.click('button[type="submit"]');

    const filtered = await request();
    const params = filtered.request.params;
    expect(params.get('entityType')).toBe('ZONA');
    expect(params.get('action')).toBe('CREACION');
    expect(params.get('from')).toBe('2026-11-01T00:00:00.000-04:00');
    expect(params.get('to')).toBe('2026-11-02T23:59:59.999-04:00');
    filtered.flush(page([]));
    await view.render();
    expect(view.content()).toContain('No hay acciones con estos filtros.');
  });

  it('rejects an inverted range without asking', async () => {
    await view.visit('/admin/bitacora');
    (await request()).flush(page([]));
    await view.render();

    await view.type('#audit-from', '2026-11-05');
    await view.type('#audit-to', '2026-11-01');
    await view.click('button[type="submit"]');

    expect(view.content()).toContain('La fecha inicial no puede ser posterior a la final.');
    view.http.expectNone((req) => req.url === apiUrl('audit-logs'));
  });

  it('shows and retries an error', async () => {
    await view.visit('/admin/bitacora');
    await view.fail('audit-logs', 403, 'Fallo');
    await view.click('app-error-alert button');
    await view.answer('audit-logs', page([entry()]));
    expect(view.content()).toContain('Admin Pruebas');
  });

  it('avoids repeating comparison fields while preserving contextual details', () => {
    expect(describeAuditDetails({ details: {
      name: 'Gas', before: null, after: { name: 'Gas', isActive: true },
    } }, true)).toEqual([]);
    expect(describeAuditDetails({ details: {
      name: 'Gas', before: { isActive: true }, after: { isActive: false },
    } }, true)).toEqual(['Nombre: Gas']);
  });

  it('describes catalog, document and claim details without internal identifiers', () => {
    expect(
      describeAuditDetails({
        details: { before: { name: 'Gas' }, after: { name: 'Gas natural' } },
      }),
    ).toEqual(['Nombre: Gas → Gas natural']);
    expect(
      describeAuditDetails({ details: { documentId: 'x', documentType: 'IDENTIDAD' } }),
    ).toEqual(['Tipo de documento: Identidad']);
    expect(
      describeAuditDetails({
        details: { orderId: '12345678-abc', fromStatus: 'ABIERTO', toStatus: 'EN_REVISION' },
      }),
    ).toEqual(['Estado: Abierto → En revisión', 'Pedido: 12345678']);
    expect(describeAuditDetails({ details: null })).toEqual([]);
  });
});
