import { apiUrl } from '../../../core/http/api-url';
import { setupOfferPage } from '../../offers/testing/offers.fixtures';
import { ADMIN_CATEGORIES_ROUTES, ADMIN_ZONES_ROUTES } from '../catalogs.routes';
import { CatalogItem } from '../models/catalog-admin.model';

const item = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: 'c-1',
  name: 'Plomería',
  description: 'Fugas y grifos',
  isActive: true,
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
  ...overrides,
});

describe('catalog administration', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    view = await setupOfferPage(
      [
        { path: 'admin/categorias', children: ADMIN_CATEGORIES_ROUTES },
        { path: 'admin/zonas', children: ADMIN_ZONES_ROUTES },
      ],
      'ADMINISTRADOR',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  const listPath = 'catalogs/admin/categories';

  async function open(items: CatalogItem[] = [item()]): Promise<void> {
    await view.visit('/admin/categorias');
    await view.answer(listPath, items);
  }

  async function press(text: string): Promise<void> {
    const button = [...view.root().querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === text,
    );
    expect(button, `botón ${text}`).toBeDefined();
    button!.click();
    await view.render();
  }

  it('lists active and inactive items and filters them (#12)', async () => {
    await open([item(), item({ id: 'c-2', name: 'Gas', isActive: false, description: null })]);

    expect(view.content()).toContain('Activo');
    expect(view.content()).toContain('Inactivo');
    expect(view.content()).toContain('Sin descripción');
    expect(view.element('[aria-label="Desactivar Gas"]')).toBeNull();

    await view.type('#catalog-state', 'inactive');
    const request = await view.request('GET', 'catalogs', 'admin', 'categories');
    expect(request.request.params.get('isActive')).toBe('false');
    request.flush([]);
    await view.render();
    expect(view.content()).toContain('No hay categorías con este filtro.');
  });

  it('validates and creates an item (#16)', async () => {
    await open();
    await press('Crear');
    expect(view.content()).toContain('Escriba el nombre.');

    await view.type('#catalog-name-new', ' G ');
    await press('Crear');
    expect(view.content()).toContain('entre 2 y 100 caracteres');
    view.http.expectNone(apiUrl('catalogs', 'categories'));

    await view.type('#catalog-name-new', '  Gas  ');
    await press('Crear');
    const request = await view.request('POST', 'catalogs', 'categories');
    expect(request.request.body).toEqual({ name: 'Gas' });
    request.flush(item({ id: 'c-3', name: 'Gas' }));
    await view.render();
    await view.answer(listPath, [item(), item({ id: 'c-3', name: 'Gas' })]);

    expect(view.content()).toContain('Categoría creada.');
    expect(view.element<HTMLInputElement>('#catalog-name-new')?.value).toBe('');
  });

  it('shows a duplicate name from the backend and keeps what was written', async () => {
    await open();
    await view.type('#catalog-name-new', 'plomería');
    await press('Crear');
    await view.fail('catalogs/categories', 409, 'Ya existe una categoría con ese nombre', 'POST');

    expect(view.content()).toContain('Ya existe una categoría con ese nombre');
    expect(view.element<HTMLInputElement>('#catalog-name-new')?.value).toBe('plomería');
  });

  it('edits name and description, clearing it with null (#17)', async () => {
    await open();
    await view.click('[aria-label="Editar Plomería"]');
    await view.type('#catalog-name-c-1', 'Plomería y gas');
    await view.type('#catalog-description-c-1', '  ');
    await press('Guardar cambios');

    const request = await view.request('PATCH', 'catalogs', 'categories', 'c-1');
    expect(request.request.body).toEqual({ name: 'Plomería y gas', description: null });
    request.flush(item({ name: 'Plomería y gas', description: null }));
    await view.render();
    await view.answer(listPath, [item({ name: 'Plomería y gas', description: null })]);
    expect(view.content()).toContain('Categoría actualizada.');
    expect(view.element('#catalog-name-c-1')).toBeNull();
  });

  it('asks for confirmation before deactivating and sends no body (#18)', async () => {
    await open();
    await view.click('[aria-label="Desactivar Plomería"]');
    expect(view.content()).toContain('No se puede reactivar.');
    await press('Volver');
    view.http.expectNone(apiUrl('catalogs', 'categories', 'c-1', 'deactivate'));

    await view.click('[aria-label="Desactivar Plomería"]');
    await press('Sí, desactivar');
    const request = await view.request('PATCH', 'catalogs', 'categories', 'c-1', 'deactivate');
    expect(request.request.body).toBeNull();
    request.flush(item({ isActive: false }));
    await view.render();
    await view.answer(listPath, [item({ isActive: false })]);
    expect(view.content()).toContain('Categoría desactivada.');
  });

  it('reports an item already inactive and reloads', async () => {
    await open();
    await view.click('[aria-label="Desactivar Plomería"]');
    await press('Sí, desactivar');
    await view.fail(
      'catalogs/categories/c-1/deactivate',
      409,
      'La categoría ya está inactiva',
      'PATCH',
    );
    await view.answer(listPath, [item({ isActive: false })]);

    expect(view.content()).toContain('La categoría ya está inactiva');
  });

  it('uses the zone endpoints and texts on the zones page (#14, #19)', async () => {
    await view.visit('/admin/zonas');
    await view.answer('catalogs/admin/zones', []);
    expect(view.content()).toContain('Nueva zona');

    await view.type('#catalog-name-new', 'Zona Oeste');
    await view.type('#catalog-description-new', 'Cerca del río');
    await press('Crear');
    const request = await view.request('POST', 'catalogs', 'zones');
    expect(request.request.body).toEqual({ name: 'Zona Oeste', description: 'Cerca del río' });
    request.flush(item({ id: 'z-1', name: 'Zona Oeste' }));
    await view.render();
    await view.answer('catalogs/admin/zones', [item({ id: 'z-1', name: 'Zona Oeste' })]);
    expect(view.content()).toContain('Zona creada.');
  });

  it('shows and retries a list error', async () => {
    await view.visit('/admin/categorias');
    await view.fail(listPath, 403, 'Fallo');
    await view.click('app-error-alert button');
    await view.answer(listPath, [item()]);
    expect(view.content()).toContain('Plomería');
  });
});
