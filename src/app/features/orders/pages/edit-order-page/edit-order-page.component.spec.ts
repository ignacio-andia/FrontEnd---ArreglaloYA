import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { OwnerOrder } from '../../models/order.model';
import { MY_ORDERS_ROUTES } from '../../orders.routes';
import { CATEGORY, ownerOrder, stubObjectUrls } from '../../testing/order.fixtures';
import { EditOrderPageComponent } from './edit-order-page.component';

const ORDER = ownerOrder();
const ORDER_URL = apiUrl('orders', 'me', ORDER.id);
const CATEGORIES_URL = apiUrl('catalogs', 'categories');
const OTHER = { id: '11111111-2222-4333-8444-555555555555', name: 'Electricidad' };
const CATEGORIES = [CATEGORY, { ...OTHER, description: null }];

describe('EditOrderPageComponent', () => {
  let harness: RouterTestingHarness;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    stubObjectUrls();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'cliente/mis-pedidos', children: MY_ORDERS_ROUTES }]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    // Las miniaturas del gestor de fotografías no son parte de estas pruebas.
    httpTesting.match((request) => request.url.includes('/images/'));
    httpTesting.verify();
  });

  const element = () => harness.routeNativeElement as HTMLElement;
  const expectUrl = (url: string) => vi.waitFor(() => httpTesting.expectOne(url));

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
  }

  async function open(order: OwnerOrder = ORDER, categories = CATEGORIES): Promise<void> {
    const navigation = harness.navigateByUrl(
      `/cliente/mis-pedidos/${order.id}/editar`,
      EditOrderPageComponent,
    );
    (await expectUrl(CATEGORIES_URL)).flush(categories);
    (await expectUrl(apiUrl('orders', 'me', order.id))).flush(order);
    await navigation;
    await settle();
  }

  function field<T extends HTMLElement = HTMLInputElement>(name: string): T {
    const found = element().querySelector<T>(`#edit-${name}`);
    if (!found) {
      throw new Error(`No existe el campo ${name}`);
    }
    return found;
  }

  function type(name: string, value: string): void {
    const input = field(name);
    input.value = value;
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
    input.dispatchEvent(new Event('blur'));
  }

  async function save(): Promise<void> {
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();
  }

  const text = () => element().textContent?.replace(/\s+/g, ' ') ?? '';

  it('fills the form and offers no control to change the zone', async () => {
    await open();

    expect(field('categoryId').value).toBe(CATEGORY.id);
    expect(field('budgetAmount').value).toBe('150.50');
    expect(field('addressReference').value).toBe('Portón verde');
    expect(element().querySelector('[formcontrolname="zoneId"], #edit-zoneId')).toBeNull();
    expect(element().querySelector('.edit__fixed')?.textContent).toContain('Norte');
    expect(text()).toContain('Editar no reinicia la vigencia');
  });

  it('does not send a request when nothing changed, even writing the amount differently', async () => {
    await open();
    type('budgetAmount', '150,5');

    await save();

    httpTesting.expectNone(ORDER_URL);
    expect(text()).toContain('No hay cambios para guardar.');
  });

  it('sends only the changes, including the category and the removed reference', async () => {
    await open();
    type('categoryId', OTHER.id);
    type('description', '  Cambio de tomacorriente en la sala  ');
    type('addressReference', '');

    await save();

    const req = httpTesting.expectOne(ORDER_URL);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      categoryId: OTHER.id,
      description: 'Cambio de tomacorriente en la sala',
      addressReference: null,
    });
    req.flush({
      order: ownerOrder({ category: { ...OTHER, isActive: true } }),
      warnings: [{ code: 'POSIBLE_DATO_PERSONAL', message: 'Revise la descripción' }],
    });
    await settle();

    expect(text()).toContain('Los cambios se guardaron.');
    expect(text()).toContain('Revise la descripción');
  });

  it('keeps an inactive current category without forcing a change', async () => {
    const order = ownerOrder({ category: { ...CATEGORY, isActive: false } });
    await open(order, [CATEGORIES[1]]);

    expect(field('categoryId').value).toBe(CATEGORY.id);
    expect(text()).toContain('Plomería (desactivada)');

    type('budgetAmount', '200');
    await save();

    const req = httpTesting.expectOne(ORDER_URL);
    expect(req.request.body).toEqual({ budgetAmount: '200' });
    req.flush({ order, warnings: [] });
  });

  it('validates before sending', async () => {
    await open();
    type('description', 'corta');
    type('budgetAmount', '0');

    await save();

    httpTesting.expectNone(ORDER_URL);
    expect(text()).toContain('Escriba al menos 10 caracteres.');
    expect(text()).toContain('Ingrese un monto mayor que 0');
  });

  it.each([
    [400, 'La categoría seleccionada no está activa'],
    [404, 'La categoría no existe'],
  ])(
    'shows a category error (%i) on its field and reloads the catalog',
    async (status, message) => {
      await open();
      type('categoryId', OTHER.id);
      await save();

      httpTesting
        .expectOne(ORDER_URL)
        .flush({ statusCode: status, message }, { status, statusText: 'Error' });
      await settle();
      (await expectUrl(CATEGORIES_URL)).flush(CATEGORIES);
      await settle();

      expect(element().querySelector('#edit-categoryId-error')?.textContent).toContain(message);
    },
  );

  it('reloads the order on 409 and stops offering the edition', async () => {
    await open();
    type('budgetAmount', '200');
    await save();

    httpTesting
      .expectOne(ORDER_URL)
      .flush(
        { statusCode: 409, message: 'El pedido venció y ya no se puede modificar.' },
        { status: 409, statusText: 'Conflict' },
      );
    await settle();
    (await expectUrl(ORDER_URL)).flush(
      ownerOrder({ status: 'VENCIDO', canEdit: false, canCancel: false, images: [] }),
    );
    await settle();

    expect(element().querySelector('form')).toBeNull();
    expect(text()).toContain('El pedido venció y ya no se puede modificar.');
    expect(text()).toContain('Este pedido ya no se puede editar');
  });

  it.each(['VENCIDO', 'CANCELADO', 'ACORDADO'] as const)(
    'does not offer the form for a %s order',
    async (status) => {
      const navigation = harness.navigateByUrl(
        `/cliente/mis-pedidos/${ORDER.id}/editar`,
        EditOrderPageComponent,
      );
      (await expectUrl(CATEGORIES_URL)).flush(CATEGORIES);
      (await expectUrl(ORDER_URL)).flush(ownerOrder({ status, canEdit: false, images: [] }));
      await navigation;
      await settle();

      expect(element().querySelector('form')).toBeNull();
      expect(element().querySelector('app-order-photo-manager')).toBeNull();
    },
  );

  it('shows the loading state and then a not found message (404)', async () => {
    const navigation = harness.navigateByUrl(`/cliente/mis-pedidos/${ORDER.id}/editar`);
    (await expectUrl(CATEGORIES_URL)).flush(CATEGORIES);
    const request = await expectUrl(ORDER_URL);
    harness.detectChanges();
    expect(document.body.textContent).toContain('Cargando el pedido…');

    request.flush(
      { statusCode: 404, message: 'El pedido no existe' },
      { status: 404, statusText: 'Not Found' },
    );
    await navigation;
    await settle();

    expect(text()).toContain('Pedido no encontrado');
  });

  it('keeps the unsaved changes when the photos change', async () => {
    await open();
    type('budgetAmount', '300');
    const component = harness.routeDebugElement?.componentInstance as EditOrderPageComponent;

    component['onPhotosChanged'](ownerOrder({ revision: 2 }));
    await settle();

    expect(field('budgetAmount').value).toBe('300');
  });
});
