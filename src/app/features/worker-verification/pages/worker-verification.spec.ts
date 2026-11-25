import { apiUrl } from '../../../core/http/api-url';
import { page, setupOfferPage } from '../../offers/testing/offers.fixtures';
import { stubObjectUrls } from '../../orders/testing/order.fixtures';
import {
  CATEGORIES,
  ZONE,
  workerDocument,
} from '../../worker-profile/testing/worker-profile.fixtures';
import { PROFILE_ID, adminProfile, adminSummary } from '../testing/worker-verification.fixtures';
import { WORKER_VERIFICATION_ROUTES } from '../worker-verification.routes';

describe('worker verification', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;
  let urls: ReturnType<typeof stubObjectUrls>;

  beforeEach(async () => {
    urls = stubObjectUrls();
    view = await setupOfferPage(
      [{ path: 'admin/trabajadores', children: WORKER_VERIFICATION_ROUTES }],
      'ADMINISTRADOR',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  const buttonByText = (text: string) =>
    [...view.root().querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === text,
    );
  async function press(text: string): Promise<void> {
    const button = buttonByText(text);
    expect(button, `botón ${text}`).toBeDefined();
    button!.click();
    await view.render();
  }

  describe('list (#56)', () => {
    const listRequest = () => view.request('GET', 'worker-profile', 'admin', 'profiles');

    async function filters(): Promise<void> {
      await view.answer('catalogs/zones', [ZONE]);
      await view.answer('catalogs/categories', CATEGORIES);
    }

    it('asks for the pending profiles by default and links to each one', async () => {
      await view.visit('/admin/trabajadores');
      await filters();
      const request = await listRequest();
      expect(request.request.params.toString()).toBe('status=PENDIENTE&page=1&limit=20');
      request.flush(page([adminSummary()]));
      await view.render();

      expect(view.content()).toContain('Juan Rojas');
      expect(view.content()).toContain('Pendiente de revisión');
      expect(view.content()).toContain('Enviado el 22/11/2026 10:00');
      expect(view.element('.worker-row a')?.getAttribute('href')).toBe(
        `/admin/trabajadores/${PROFILE_ID}`,
      );
    });

    it('filters by status, zone and specialty through the URL', async () => {
      await view.visit('/admin/trabajadores');
      await filters();
      (await listRequest()).flush(page([]));
      await view.render();
      expect(view.content()).toContain('No hay perfiles con estos filtros.');

      await view.type('#workers-status', 'TODOS');
      const all = await listRequest();
      expect(all.request.params.has('status')).toBe(false);
      all.flush(page([]));
      await view.render();

      await view.type('#workers-zone', ZONE.id);
      const zoned = await listRequest();
      expect(zoned.request.params.get('zoneId')).toBe(ZONE.id);
      zoned.flush(page([]));
      await view.render();

      await view.type('#workers-category', CATEGORIES[0].id);
      const categorized = await listRequest();
      expect(categorized.request.params.get('categoryId')).toBe(CATEGORIES[0].id);
      categorized.flush(page([]));
      await view.render();
      expect(view.router.url).toContain('estado=TODOS');
    });

    it.each([403, 500])('shows and retries a %i', async (status) => {
      await view.visit('/admin/trabajadores');
      await filters();
      await view.fail('worker-profile/admin/profiles', status, 'Fallo');
      await view.click('app-error-alert button');
      await view.answer('worker-profile/admin/profiles', page([adminSummary()]));
      expect(view.content()).toContain('Juan Rojas');
    });
  });

  describe('detail (#57) and decisions (#55)', () => {
    const path = `worker-profile/admin/profiles/${PROFILE_ID}`;
    const statusRequest = () =>
      view.request('PATCH', 'worker-profile', 'admin', 'profiles', PROFILE_ID, 'status');

    async function open(body = adminProfile()): Promise<void> {
      await view.visit(`/admin/trabajadores/${PROFILE_ID}`);
      await view.answer(path, body);
    }

    async function writeReason(text: string): Promise<void> {
      await view.type('#profile-decision-reason', text);
    }

    it('shows the account, schedules and history without asking for documents', async () => {
      await open();

      for (const text of [
        'Juan Rojas',
        'juan@example.com',
        'Lunes: 08:00 a 12:00',
        'Historial de estados',
        '(trabajador)',
      ]) {
        expect(view.content()).toContain(text);
      }
      view.http.expectNone(apiUrl('worker-profile', 'admin', 'profiles', PROFILE_ID, 'documents'));
    });

    it('offers only the decisions the backend allows', async () => {
      await open();

      expect(buttonByText('Aprobar')).toBeDefined();
      expect(buttonByText('Observar')).toBeDefined();
      expect(buttonByText('Rechazar')).toBeDefined();
      expect(buttonByText('Suspender')).toBeUndefined();
    });

    it('approves without a reason and refreshes the profile', async () => {
      await open();
      await press('Aprobar');
      await press('Sí, aprobar');

      const request = await statusRequest();
      expect(request.request.body).toEqual({ status: 'APROBADO' });
      request.flush(adminProfile('APROBADO').profile);
      await view.render();
      await view.answer(path, adminProfile('APROBADO'));

      expect(view.content()).toContain('Perfil aprobado.');
      expect(buttonByText('Suspender')).toBeDefined();
    });

    it.each([
      ['Observar', 'Sí, observar', 'OBSERVADO'],
      ['Rechazar', 'Sí, rechazar', 'RECHAZADO'],
    ])('requires a reason to %s', async (action, confirm, status) => {
      await open();
      await press(action);
      await press(confirm);

      expect(view.content()).toContain('Escriba el motivo.');

      await writeReason('  Falta la cédula  ');
      await press(confirm);
      const request = await statusRequest();
      expect(request.request.body).toEqual({ status, reason: 'Falta la cédula' });
      request.flush(adminProfile().profile);
      await view.render();
      await view.answer(path, adminProfile());
    });

    it('suspends an approved worker and offers to reactivate a suspended one', async () => {
      await open(adminProfile('APROBADO'));
      await press('Suspender');
      await writeReason('Incumplimiento');
      await press('Sí, suspender');
      const request = await statusRequest();
      expect(request.request.body).toEqual({ status: 'SUSPENDIDO', reason: 'Incumplimiento' });
      request.flush(adminProfile('SUSPENDIDO').profile);
      await view.render();
      await view.answer(path, adminProfile('SUSPENDIDO', { statusReason: 'Incumplimiento' }));

      expect(view.content()).toContain('Motivo registrado: Incumplimiento');
      await press('Reactivar');
      await press('Sí, reactivar');
      const reactivate = await statusRequest();
      expect(reactivate.request.body).toEqual({ status: 'APROBADO' });
      reactivate.flush(adminProfile('APROBADO').profile);
      await view.render();
      await view.answer(path, adminProfile('APROBADO'));
      expect(view.content()).toContain('Trabajador reactivado.');
    });

    it('explains a stale transition without internal literals and reloads', async () => {
      await open();
      await press('Aprobar');
      await press('Sí, aprobar');
      await view.fail(
        `${path}/status`,
        409,
        'No se puede pasar un perfil de APROBADO a APROBADO',
        'PATCH',
      );
      await view.answer(path, adminProfile('APROBADO'));

      expect(view.content()).toContain('El perfil cambió de estado.');
      expect(view.content()).not.toContain('de APROBADO a');
    });

    it('shows the missing requirements the backend reports', async () => {
      await open();
      await press('Aprobar');
      await press('Sí, aprobar');
      await view.fail(`${path}/status`, 409, ['Registre un teléfono de contacto'], 'PATCH');
      await view.answer(path, adminProfile());

      expect(view.content()).toContain('Registre un teléfono de contacto');
    });

    it('says when the profile does not exist', async () => {
      await view.visit(`/admin/trabajadores/${PROFILE_ID}`);
      await view.fail(path, 404, 'El perfil de trabajador no existe');

      expect(view.content()).toContain('Perfil no encontrado');
    });

    it('lists, shows and downloads documents only on request (#58–#60)', async () => {
      await open();
      await press('Consultar documentos');
      const image = workerDocument({ originalName: 'cedula.png', mimeType: 'image/png' });
      await view.answer(`${path}/documents`, [image]);
      expect(view.content()).toContain('Identidad · cedula.png');
      expect(view.content()).toContain('Vigente');

      await view.click('[aria-label="Ver cedula.png"]');
      (
        await view.request(
          'GET',
          'worker-profile',
          'admin',
          'profiles',
          PROFILE_ID,
          'documents',
          image.id,
          'view',
        )
      ).flush(new Blob(['x']));
      await view.render();
      expect(view.element('.docs__image')?.getAttribute('src')).toBe(urls.created[0]);

      await press('Cerrar vista');
      expect(view.element('.docs__image')).toBeNull();
      expect(urls.revoked).toContain(urls.created[0]);

      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      await view.click('[aria-label="Descargar cedula.png"]');
      (
        await view.request(
          'GET',
          'worker-profile',
          'admin',
          'profiles',
          PROFILE_ID,
          'documents',
          image.id,
          'download',
        )
      ).flush(new Blob(['x']));
      await view.render();
      expect(click).toHaveBeenCalled();
      click.mockRestore();
    });

    it('offers a link for a PDF and reports a failed view', async () => {
      await open();
      await press('Consultar documentos');
      const pdf = workerDocument();
      await view.answer(`${path}/documents`, [pdf]);

      const viewRequest = () =>
        view.request(
          'GET',
          'worker-profile',
          'admin',
          'profiles',
          PROFILE_ID,
          'documents',
          pdf.id,
          'view',
        );
      await view.click('[aria-label="Ver cedula.pdf"]');
      (await viewRequest()).flush(new Blob(['%PDF']));
      await view.render();
      expect(view.element('.docs__preview a')?.getAttribute('target')).toBe('_blank');

      await view.click('[aria-label="Ver cedula.pdf"]');
      (await viewRequest()).flush(new Blob(['{}']), { status: 404, statusText: 'Not Found' });
      await view.render();
      expect(view.element('[role="alert"]')).not.toBeNull();
    });
  });
});
