import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { FileDropzoneComponent } from '../../../../shared/components/file-dropzone/file-dropzone.component';
import { OrderWarning } from '../../models/order.model';
import {
  CATEGORY,
  CLIENT,
  ZONE,
  ownerOrder,
  photo,
  stubObjectUrls,
} from '../../testing/order.fixtures';
import { PublishOrderPageComponent } from './publish-order-page.component';

const CATEGORIES_URL = apiUrl('catalogs', 'categories');
const ZONES_URL = apiUrl('catalogs', 'zones');
const CHECK_URL = apiUrl('orders', 'duplicate-check');
const ORDERS_URL = apiUrl('orders');

const DUPLICATE: OrderWarning = {
  code: 'POSIBLE_DUPLICADO',
  message: 'Ya tiene un pedido activo muy parecido en la misma categoría y zona.',
  orderIds: ['e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b'],
};
const PERSONAL: OrderWarning = {
  code: 'POSIBLE_DATO_PERSONAL',
  message: 'La descripción parece incluir un teléfono o un correo.',
};

describe('PublishOrderPageComponent', () => {
  let fixture: ComponentFixture<PublishOrderPageComponent>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;

  async function render(): Promise<void> {
    sessionStorage.clear();
    stubObjectUrls();
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
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PublishOrderPageComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  async function loadCatalogs(categories = [CATEGORY], zones = [ZONE]): Promise<void> {
    (await pending(CATEGORIES_URL)).flush(categories);
    (await pending(ZONES_URL)).flush(zones);
    await settle();
  }

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  function pending(url: string): Promise<TestRequest> {
    return vi.waitFor(() => httpTesting.expectOne(url));
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function field<T extends HTMLElement>(id: string): T {
    const control = element.querySelector<T>(`#order-${id}`);
    if (!control) {
      throw new Error(`No field ${id}`);
    }
    return control;
  }

  function type(id: string, value: string): void {
    const control = field<HTMLInputElement | HTMLTextAreaElement>(id);
    control.value = value;
    control.dispatchEvent(new Event('input'));
  }

  function select(id: string, value: string): void {
    const control = field<HTMLSelectElement>(id);
    control.value = value;
    control.dispatchEvent(new Event('change'));
  }

  function addPhotos(...files: File[]): void {
    fixture.debugElement
      .query(By.directive(FileDropzoneComponent))
      .triggerEventHandler('filesSelected', files);
    fixture.detectChanges();
  }

  function fillValidForm(): void {
    select('categoryId', CATEGORY.id);
    select('zoneId', ZONE.id);
    type('description', '  Fuga de agua debajo del lavaplatos de la cocina  ');
    type('budgetAmount', '150,50');
    type('addressLine', ' Av. Ejemplo 123 ');
    type('addressReference', 'Portón verde');
    addPhotos(photo('fuga.jpg'), photo('detalle.png', 'image/png'));
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!found) {
      throw new Error(`No button ${label}`);
    }
    return found;
  }

  function continueToReview(): void {
    button('Continuar a la revisión').click();
    fixture.detectChanges();
  }

  /** Completa el formulario y llega al resumen con los avisos indicados. */
  async function reachReview(warnings: OrderWarning[] = []): Promise<void> {
    await render();
    await loadCatalogs();
    fillValidForm();
    continueToReview();
    httpTesting.expectOne(CHECK_URL).flush({ warnings });
    await settle();
  }

  it('shows the form sections with the active categories and zones', async () => {
    await render();
    expect(element.textContent).toContain('Cargando categorías y zonas');
    await loadCatalogs();

    const legends = Array.from(element.querySelectorAll('legend')).map((legend) =>
      legend.textContent?.trim(),
    );
    expect(legends).toEqual(['Servicio', 'Problema y presupuesto', 'Dirección', 'Fotografías']);
    expect(
      Array.from(field<HTMLSelectElement>('zoneId').options).map((option) => option.text),
    ).toEqual(['Seleccione una zona', 'Norte']);
    expect(element.querySelector('[aria-current="step"]')?.textContent).toContain(
      'Datos del pedido',
    );
  });

  it('blocks the form when there are no active zones', async () => {
    await render();
    await loadCatalogs([CATEGORY], []);

    expect(element.textContent).toContain('no hay zonas habilitadas');
    expect(button('Continuar a la revisión').disabled).toBe(true);
  });

  it('validates every field, including the photos, without calling the API', async () => {
    await render();
    await loadCatalogs();
    type('description', 'Corto');
    type('budgetAmount', '0');
    continueToReview();
    await settle();

    httpTesting.expectNone(CHECK_URL);
    const errors = Array.from(element.querySelectorAll('.field__error')).map((error) =>
      error.textContent?.trim(),
    );
    expect(errors).toEqual([
      'Seleccione la categoría del servicio.',
      'Seleccione la zona.',
      'Escriba al menos 10 caracteres.',
      'Ingrese un monto mayor que 0, con hasta 8 dígitos enteros y 2 decimales (por ejemplo, 150.50).',
      'Ingrese la dirección exacta.',
      'Adjunte al menos una fotografía del problema.',
    ]);
    expect(document.activeElement).toBe(field('categoryId'));
  });

  it('checks duplicates, reviews the data and publishes the order as multipart', async () => {
    await render();
    await loadCatalogs();
    fillValidForm();
    continueToReview();
    expect(button('Comprobando…').disabled).toBe(true);

    const check = httpTesting.expectOne(CHECK_URL);
    expect(check.request.body).toEqual({
      categoryId: CATEGORY.id,
      zoneId: ZONE.id,
      description: 'Fuga de agua debajo del lavaplatos de la cocina',
    });
    check.flush({ warnings: [] });
    await settle();

    expect(document.activeElement?.id).toBe('publish-review-title');
    expect(element.querySelector('app-order-warnings')).toBeNull();
    const review = element.querySelector('app-order-review')?.textContent ?? '';
    expect(review).toContain('Plomería');
    expect(review).toContain('Norte');
    expect(review).toContain('Bs 150.50');
    expect(review).toContain('Referencia: Portón verde');
    expect(review).toContain('Fotografías (2)');

    button('Publicar pedido').click();
    fixture.detectChanges();
    const create = httpTesting.expectOne(ORDERS_URL);
    const body = create.request.body as FormData;
    expect(body.get('description')).toBe('Fuga de agua debajo del lavaplatos de la cocina');
    expect(body.get('budgetAmount')).toBe('150.50');
    expect(body.get('addressLine')).toBe('Av. Ejemplo 123');
    expect(body.getAll('images')).toHaveLength(2);
    create.flush({ order: ownerOrder(), warnings: [] }, { status: 201, statusText: 'Created' });
    await settle();

    expect(document.activeElement?.id).toBe('publish-done-title');
    const summary = element.querySelector('.publish__summary')?.textContent ?? '';
    expect(summary).toContain('Publicado');
    expect(summary).toContain('Bs 150.50');
    expect(summary).toContain('22/11/2026 10:40');
  });

  it('shows the warnings, lets the user go back with the data intact and publish anyway', async () => {
    await reachReview([DUPLICATE, PERSONAL]);

    const warnings = element.querySelector('app-order-warnings')?.textContent ?? '';
    expect(warnings).toContain('Posible pedido repetido');
    expect(warnings).toContain(DUPLICATE.message);
    expect(warnings).toContain('Posibles datos personales en la descripción');
    expect(button('Publicar pedido').disabled).toBe(false);

    button('Modificar datos').click();
    await settle();

    expect(field<HTMLTextAreaElement>('description').value).toContain('Fuga de agua');
    expect(field<HTMLInputElement>('budgetAmount').value).toBe('150,50');
    expect(element.querySelectorAll('.photos__item')).toHaveLength(2);
    expect(document.activeElement?.id).toBe('publish-form-title');
  });

  it('sends a single request when the publish button is clicked twice', async () => {
    await reachReview();

    button('Publicar pedido').click();
    fixture.detectChanges();
    expect(button('Publicando…').disabled).toBe(true);
    button('Publicando…').click();

    httpTesting
      .expectOne(ORDERS_URL)
      .flush({ order: ownerOrder(), warnings: [] }, { status: 201, statusText: 'Created' });
    await settle();
  });

  it('keeps the publication and shows the warnings returned with it', async () => {
    await reachReview();
    button('Publicar pedido').click();
    httpTesting
      .expectOne(ORDERS_URL)
      .flush({ order: ownerOrder(), warnings: [PERSONAL] }, { status: 201, statusText: 'Created' });
    await settle();

    expect(element.textContent).toContain('Su pedido fue publicado');
    expect(element.querySelector('app-order-warnings')?.textContent).toContain(PERSONAL.message);
  });

  it('starts a new empty form after publishing', async () => {
    await reachReview();
    button('Publicar pedido').click();
    httpTesting
      .expectOne(ORDERS_URL)
      .flush({ order: ownerOrder(), warnings: [] }, { status: 201, statusText: 'Created' });
    await settle();

    button('Publicar otro pedido').click();
    await settle();

    expect(field<HTMLTextAreaElement>('description').value).toBe('');
    expect(element.querySelectorAll('.photos__item')).toHaveLength(0);
    expect(element.querySelector('.field__error')).toBeNull();
  });

  it('continues to the review when the duplicate check is unavailable', async () => {
    await render();
    await loadCatalogs();
    fillValidForm();
    continueToReview();
    httpTesting
      .expectOne(CHECK_URL)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await settle();

    expect(element.textContent).toContain('No se pudo comprobar si tiene pedidos parecidos');
    expect(button('Publicar pedido').disabled).toBe(false);
  });

  it('returns to the form with the photo error rejected by the backend (400)', async () => {
    await reachReview();
    button('Publicar pedido').click();
    httpTesting.expectOne(ORDERS_URL).flush(
      {
        statusCode: 400,
        message: 'El archivo no es una imagen válida o está dañado',
        error: 'Bad Request',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    (await pending(CATEGORIES_URL)).flush([CATEGORY]);
    (await pending(ZONES_URL)).flush([ZONE]);
    await settle();

    expect(document.activeElement?.id).toBe('order-error-summary');
    expect(element.querySelector('#order-images-error')?.textContent).toBe(
      'El archivo no es una imagen válida o está dañado',
    );
    expect(element.querySelectorAll('.photos__item')).toHaveLength(2);
  });

  it('marks the zone when it was deactivated and reloads the catalogs', async () => {
    await reachReview();
    button('Publicar pedido').click();
    httpTesting
      .expectOne(ORDERS_URL)
      .flush(
        { statusCode: 400, message: 'La zona seleccionada no está activa', error: 'Bad Request' },
        { status: 400, statusText: 'Bad Request' },
      );
    (await pending(CATEGORIES_URL)).flush([CATEGORY]);
    (await pending(ZONES_URL)).flush([ZONE]);
    await settle();

    expect(element.querySelector('#order-zoneId-error')?.textContent).toBe(
      'La zona seleccionada no está activa',
    );
  });

  it('marks the photos when one is too large (413)', async () => {
    await reachReview();
    button('Publicar pedido').click();
    httpTesting.expectOne(ORDERS_URL).flush(
      {
        statusCode: 413,
        message: 'Cada fotografía puede pesar como máximo 10 MB',
        error: 'Payload Too Large',
      },
      { status: 413, statusText: 'Payload Too Large' },
    );
    await settle();

    expect(element.querySelector('#order-images-error')?.textContent).toBe(
      'Cada fotografía puede pesar como máximo 10 MB',
    );
  });

  it('keeps the review and allows a retry after a network error', async () => {
    await reachReview();
    button('Publicar pedido').click();
    httpTesting.expectOne(ORDERS_URL).error(new ProgressEvent('error'));
    await settle();

    expect(element.querySelector('#publish-error')).not.toBeNull();
    expect(element.querySelector('app-order-review')).not.toBeNull();

    button('Publicar pedido').click();
    httpTesting
      .expectOne(ORDERS_URL)
      .flush({ order: ownerOrder(), warnings: [] }, { status: 201, statusText: 'Created' });
    await settle();
    expect(element.textContent).toContain('Su pedido fue publicado');
  });
});
