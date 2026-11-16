import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { NormalizedApiError } from '../../../core/models/api-error.model';
import { CatalogOption } from '../models/catalog.model';
import { CatalogsApiService } from './catalogs-api.service';

const CATEGORY_ID = '2b7e9d1c-3f4a-4b5c-8d6e-7f8091a2b3c4';
const ZONE_ID = '5c6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e8f';

const categories: CatalogOption[] = [
  { id: CATEGORY_ID, name: 'Electricidad', description: 'Instalaciones y reparaciones' },
  { id: '3c8f0e2d-4a5b-4c6d-9e7f-8091a2b3c4d5', name: 'Plomería', description: null },
];

const zones: CatalogOption[] = [{ id: ZONE_ID, name: 'Zona Sur', description: null }];

describe('CatalogsApiService', () => {
  let service: CatalogsApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(CatalogsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets the active categories', async () => {
    const result = firstValueFrom(service.getCategories());

    const req = httpTesting.expectOne(apiUrl('catalogs', 'categories'));
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(categories);

    expect(await result).toEqual(categories);
  });

  it('gets one category by id', async () => {
    const result = firstValueFrom(service.getCategory(CATEGORY_ID));

    const req = httpTesting.expectOne(`/api/catalogs/categories/${CATEGORY_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(categories[0]);

    expect(await result).toEqual(categories[0]);
  });

  it('gets the active zones', async () => {
    const result = firstValueFrom(service.getZones());

    const req = httpTesting.expectOne(apiUrl('catalogs', 'zones'));
    expect(req.request.method).toBe('GET');
    req.flush(zones);

    expect(await result).toEqual(zones);
  });

  it('gets one zone by id', async () => {
    const result = firstValueFrom(service.getZone(ZONE_ID));

    httpTesting.expectOne(`/api/catalogs/zones/${ZONE_ID}`).flush(zones[0]);

    expect(await result).toEqual(zones[0]);
  });

  it('propagates normalized errors (404 for missing or inactive items)', async () => {
    const result = firstValueFrom(service.getCategory(CATEGORY_ID)).catch(
      (error: unknown) => error,
    );

    httpTesting
      .expectOne(apiUrl('catalogs', 'categories', CATEGORY_ID))
      .flush(
        { statusCode: 404, message: 'La categoría no existe', error: 'Not Found' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(await result).toEqual<NormalizedApiError>({
      statusCode: 404,
      messages: ['La categoría no existe'],
      error: 'Not Found',
    });
  });
});
