import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { User } from '../../../core/auth/auth.models';
import { SessionStore } from '../../../core/auth/session.store';
import { apiErrorInterceptor } from '../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { NormalizedApiError } from '../../../core/models/api-error.model';
import { UsersApiService } from './users-api.service';

const USER_ID = '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f';

const user: User = {
  id: USER_ID,
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  phone: '70000000',
  status: 'ACTIVO',
  roles: ['CLIENTE'],
  createdAt: '2026-11-15T14:30:00.000Z',
  updatedAt: '2026-11-16T10:00:00.000Z',
};

describe('UsersApiService', () => {
  let service: UsersApiService;
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
      user,
    });
    service = TestBed.inject(UsersApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  it('patches the own account with the token and returns the updated PublicUser', async () => {
    const result = firstValueFrom(service.updateUser(USER_ID, { phone: '70000000' }));

    const req = httpTesting.expectOne(`/api/users/${USER_ID}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    expect(req.request.body).toEqual({ phone: '70000000' });
    req.flush(user);

    expect(await result).toEqual(user);
  });

  it('sends null to delete the phone and only the defined DTO properties', () => {
    const withExtras = {
      firstName: 'Ana',
      phone: null,
      email: 'otra@example.com',
      roles: ['ADMINISTRADOR'],
    };

    service.updateUser(USER_ID, withExtras).subscribe();

    const req = httpTesting.expectOne(`/api/users/${USER_ID}`);
    expect(req.request.body).toEqual({ firstName: 'Ana', phone: null });
    req.flush(user);
  });

  it('propagates normalized validation errors', async () => {
    const result = firstValueFrom(service.updateUser(USER_ID, { phone: '123' })).catch(
      (error: unknown) => error,
    );

    httpTesting.expectOne(`/api/users/${USER_ID}`).flush(
      {
        statusCode: 400,
        message: ['phone debe tener entre 7 y 15 dígitos, opcionalmente precedidos de +'],
        error: 'Bad Request',
      },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(await result).toEqual<NormalizedApiError>({
      statusCode: 400,
      messages: ['phone debe tener entre 7 y 15 dígitos, opcionalmente precedidos de +'],
      error: 'Bad Request',
    });
  });
});
