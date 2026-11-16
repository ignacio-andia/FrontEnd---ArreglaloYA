import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../../../core/auth/session.store';
import { apiUrl } from '../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { NormalizedApiError } from '../../../core/models/api-error.model';
import { CreateWorkerProfileRequest } from '../models/worker-profile.model';
import { CATEGORIES, ZONE, userWithRoles, workerProfile } from '../testing/worker-profile.fixtures';
import { WorkerProfileApiService } from './worker-profile-api.service';

describe('WorkerProfileApiService', () => {
  let service: WorkerProfileApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    TestBed.inject(SessionStore).setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: userWithRoles(['CLIENTE']),
    });
    service = TestBed.inject(WorkerProfileApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  it('creates the profile with the exact CreateWorkerProfileDto and the token', async () => {
    const request: CreateWorkerProfileRequest = {
      yearsOfExperience: 5,
      description: 'Instalaciones sanitarias',
      zoneId: ZONE.id,
      categoryIds: [CATEGORIES[0].id, CATEGORIES[1].id],
    };
    const result = firstValueFrom(service.createProfile(request));

    const req = httpTesting.expectOne(apiUrl('worker-profile'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    expect(req.request.body).toEqual(request);
    req.flush(workerProfile(), { status: 201, statusText: 'Created' });

    expect(await result).toEqual(workerProfile());
  });

  it('omits the description when absent and never sends extra properties', () => {
    const withExtras = {
      yearsOfExperience: 0,
      zoneId: ZONE.id,
      categoryIds: [CATEGORIES[0].id],
      status: 'APROBADO',
    };

    service.createProfile(withExtras).subscribe();

    const req = httpTesting.expectOne(apiUrl('worker-profile'));
    expect(req.request.body).toEqual({
      yearsOfExperience: 0,
      zoneId: ZONE.id,
      categoryIds: [CATEGORIES[0].id],
    });
    req.flush(workerProfile(), { status: 201, statusText: 'Created' });
  });

  it('gets the own profile', async () => {
    const result = firstValueFrom(service.getOwnProfile());

    const req = httpTesting.expectOne(apiUrl('worker-profile', 'me'));
    expect(req.request.method).toBe('GET');
    req.flush(workerProfile({ status: 'PENDIENTE' }));

    expect((await result).status).toBe('PENDIENTE');
  });

  it('propagates the duplicate profile error (409)', async () => {
    const result = firstValueFrom(
      service.createProfile({
        yearsOfExperience: 1,
        zoneId: ZONE.id,
        categoryIds: [CATEGORIES[0].id],
      }),
    ).catch((error: unknown) => error);

    httpTesting.expectOne(apiUrl('worker-profile')).flush(
      {
        statusCode: 409,
        message: 'Esta cuenta ya tiene un perfil de trabajador',
        error: 'Conflict',
      },
      { status: 409, statusText: 'Conflict' },
    );

    expect(await result).toEqual<NormalizedApiError>({
      statusCode: 409,
      messages: ['Esta cuenta ya tiene un perfil de trabajador'],
      error: 'Conflict',
    });
  });
});
