import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { CatalogOption } from '../../models/catalog.model';
import { CategoriesPageComponent } from './categories-page.component';

const CATEGORIES_URL = apiUrl('catalogs', 'categories');

const categories: CatalogOption[] = [
  {
    id: '2b7e9d1c-3f4a-4b5c-8d6e-7f8091a2b3c4',
    name: 'Electricidad',
    description: 'Instalaciones y reparaciones',
  },
  { id: '3c8f0e2d-4a5b-4c6d-9e7f-8091a2b3c4d5', name: 'Plomería', description: null },
];

describe('CategoriesPageComponent', () => {
  let fixture: ComponentFixture<CategoriesPageComponent>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CategoriesPageComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  /** El resource lanza la petición de forma asíncrona tras el primer ciclo de detección. */
  function pendingRequest(): Promise<TestRequest> {
    return vi.waitFor(() => httpTesting.expectOne(CATEGORIES_URL));
  }

  async function settle(): Promise<void> {
    // Las zonas se prueban aparte: si nadie las respondió, se responden vacías.
    httpTesting.match(apiUrl('catalogs', 'zones')).forEach((request) => request.flush([]));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows a loading state while the categories are requested', async () => {
    const req = await pendingRequest();
    fixture.detectChanges();

    const status = element.querySelector('.categories__state[role="status"]');
    expect(status?.textContent).toContain('Cargando categorías');
    expect(element.querySelector('.categories__list')).toBeNull();

    req.flush(categories);
    await settle();
    expect(element.querySelector('.categories__state[role="status"]')).toBeNull();
  });

  it('renders every category returned by the API', async () => {
    (await pendingRequest()).flush(categories);
    await settle();

    const items = Array.from(element.querySelectorAll('.categories__list > li'));
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.querySelector('h2')?.textContent)).toEqual([
      'Electricidad',
      'Plomería',
    ]);
    expect(items[0].querySelector('p')?.textContent).toBe('Instalaciones y reparaciones');
    expect(items[1].querySelector('p')).toBeNull();
  });

  it('shows an empty state when there are no categories', async () => {
    (await pendingRequest()).flush([]);
    await settle();

    expect(element.textContent).toContain('Todavía no hay categorías disponibles.');
    expect(element.querySelector('.categories__list')).toBeNull();
  });

  it('shows the error and retries the request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    (await pendingRequest()).error(new ProgressEvent('error'));
    await settle();

    const alert = element.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No se pudo conectar con el servidor');

    alert?.querySelector('button')?.click();
    fixture.detectChanges();
    (await pendingRequest()).flush(categories);
    await settle();

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelectorAll('.categories__list > li')).toHaveLength(2);
  });

  it('lists the zones where orders are published', async () => {
    (await pendingRequest()).flush(categories);
    const zones = await vi.waitFor(() => httpTesting.expectOne(apiUrl('catalogs', 'zones')));
    zones.flush([{ id: 'z', name: 'Zona Norte', description: null }]);
    await settle();

    expect(element.textContent).toContain('Zonas donde se publican pedidos');
    expect(element.textContent).toContain('Zona Norte');
  });

  it('uses a generic message for server errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    (await pendingRequest()).flush(
      { statusCode: 500, message: 'Internal server error' },
      { status: 500, statusText: 'Internal Server Error' },
    );
    await settle();

    const alert = element.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Ocurrió un error en el servidor');
    expect(alert?.textContent).not.toContain('Internal server error');
  });
});
