import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationInitStatus, inject, provideAppInitializer } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../http/api-url';
import { apiErrorInterceptor } from '../interceptors/api-error.interceptor';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { NormalizedApiError } from '../models/api-error.model';
import { AuthResponse, LoginRequest, RegisterRequest, User } from './auth.models';
import { AuthService } from './auth.service';
import { SessionStore } from './session.store';

const TOKEN_STORAGE_KEY = 'servicios-hogar.access-token';

const user: User = {
  id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  phone: '70000000',
  status: 'ACTIVO',
  roles: ['CLIENTE'],
  createdAt: '2026-11-15T14:30:00.000Z',
  updatedAt: '2026-11-15T14:30:00.000Z',
};

const authResponse: AuthResponse = { accessToken: 'new-token', tokenType: 'Bearer', user };

describe('AuthService', () => {
  let httpTesting: HttpTestingController;

  function setup(storedToken: string | null = null) {
    if (storedToken !== null) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, storedToken);
    }
    httpTesting = TestBed.inject(HttpTestingController);
    return { service: TestBed.inject(AuthService), session: TestBed.inject(SessionStore) };
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('posts the exact RegisterDto and stores the session', async () => {
      const { service, session } = setup();
      const request: RegisterRequest = {
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        password: 'Clave1234',
        phone: null,
      };

      const result = firstValueFrom(service.register(request));
      const req = httpTesting.expectOne(apiUrl('auth', 'register'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(authResponse, { status: 201, statusText: 'Created' });

      expect(await result).toEqual(authResponse);
      expect(session.token()).toBe('new-token');
      expect(session.user()).toEqual(user);
      expect(session.isAuthenticated()).toBe(true);
      expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe('new-token');
    });

    it('omits phone when not provided and never sends extra properties', () => {
      const { service } = setup();
      const withExtras = {
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        password: 'Clave1234',
        roles: ['ADMINISTRADOR'],
        status: 'ACTIVO',
      };

      service.register(withExtras).subscribe();

      const req = httpTesting.expectOne(apiUrl('auth', 'register'));
      expect(req.request.body).toEqual({
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        password: 'Clave1234',
      });
      req.flush(authResponse, { status: 201, statusText: 'Created' });
    });
  });

  describe('login', () => {
    it('posts the exact LoginDto and stores the session', async () => {
      const { service, session } = setup();
      const request: LoginRequest = { email: 'ana@example.com', password: 'Clave1234' };

      const result = firstValueFrom(service.login({ ...request, ...{ rememberMe: true } }));
      const req = httpTesting.expectOne(apiUrl('auth', 'login'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(authResponse);

      expect(await result).toEqual(authResponse);
      expect(session.token()).toBe('new-token');
      expect(session.isAuthenticated()).toBe(true);
    });

    it('does not start a session when credentials are rejected', async () => {
      const { service, session } = setup();

      const result = firstValueFrom(
        service.login({ email: 'ana@example.com', password: 'incorrecta1' }),
      ).catch((error: unknown) => error);
      httpTesting
        .expectOne(apiUrl('auth', 'login'))
        .flush(
          { statusCode: 401, message: 'Credenciales inválidas', error: 'Unauthorized' },
          { status: 401, statusText: 'Unauthorized' },
        );

      expect(await result).toEqual<NormalizedApiError>({
        statusCode: 401,
        messages: ['Credenciales inválidas'],
        error: 'Unauthorized',
      });
      expect(session.hasToken()).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('gets /auth/me with the token and updates the user', async () => {
      const { service, session } = setup('stored-token');
      const updated: User = { ...user, roles: ['CLIENTE', 'TRABAJADOR'] };

      const result = firstValueFrom(service.getCurrentUser());
      const req = httpTesting.expectOne(apiUrl('auth', 'me'));
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer stored-token');
      req.flush(updated);

      expect(await result).toEqual(updated);
      expect(session.user()).toEqual(updated);
      expect(session.token()).toBe('stored-token');
    });
  });

  describe('logout', () => {
    it('clears the session locally without calling the backend', () => {
      const { service, session } = setup();
      session.setSession(authResponse);

      service.logout();

      expect(session.token()).toBeNull();
      expect(session.user()).toBeNull();
      expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
      httpTesting.expectNone(() => true);
    });
  });

  describe('restoreSession', () => {
    it('completes without requests when there is no stored token', async () => {
      const { service, session } = setup();

      await firstValueFrom(service.restoreSession(), { defaultValue: undefined });

      httpTesting.expectNone(apiUrl('auth', 'me'));
      expect(session.isAuthenticated()).toBe(false);
    });

    it('authenticates the session when the stored token is valid', async () => {
      const { service, session } = setup('stored-token');

      const result = firstValueFrom(service.restoreSession());
      const req = httpTesting.expectOne(apiUrl('auth', 'me'));
      expect(req.request.headers.get('Authorization')).toBe('Bearer stored-token');
      req.flush(user);
      await result;

      expect(session.user()).toEqual(user);
      expect(session.isAuthenticated()).toBe(true);
    });

    it('clears the session through the interceptor when the token is invalid (401)', async () => {
      const { service, session } = setup('expired-token');

      const result = firstValueFrom(service.restoreSession());
      httpTesting
        .expectOne(apiUrl('auth', 'me'))
        .flush(
          { statusCode: 401, message: 'Sesión inválida', error: 'Unauthorized' },
          { status: 401, statusText: 'Unauthorized' },
        );
      await result;

      expect(session.hasToken()).toBe(false);
      expect(session.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('does not authenticate on network errors and keeps the token for a retry', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { service, session } = setup('stored-token');

      const result = firstValueFrom(service.restoreSession());
      httpTesting.expectOne(apiUrl('auth', 'me')).error(new ProgressEvent('error'));
      await result;

      expect(session.isAuthenticated()).toBe(false);
      expect(session.user()).toBeNull();
      expect(session.token()).toBe('stored-token');
    });

    it('does not authenticate on server errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { service, session } = setup('stored-token');

      const result = firstValueFrom(service.restoreSession());
      httpTesting
        .expectOne(apiUrl('auth', 'me'))
        .flush(
          { statusCode: 500, message: 'Internal server error' },
          { status: 500, statusText: 'Internal Server Error' },
        );
      await result;

      expect(session.isAuthenticated()).toBe(false);
    });

    it('shares a single request between concurrent calls', async () => {
      const { service } = setup('stored-token');

      const first = firstValueFrom(service.restoreSession());
      const second = firstValueFrom(service.restoreSession());
      httpTesting.expectOne(apiUrl('auth', 'me')).flush(user);
      await Promise.all([first, second]);

      // Ya autenticada: una nueva llamada no repite la petición.
      await firstValueFrom(service.restoreSession());
      httpTesting.expectNone(apiUrl('auth', 'me'));
    });
  });
});

describe('Session restoration on app initialization', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('waits for /auth/me before finishing initialization, without duplicate requests', async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        provideAppInitializer(() => inject(AuthService).restoreSession()),
      ],
    });

    const initStatus = TestBed.inject(ApplicationInitStatus);
    const httpTesting = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(SessionStore);

    // Una llamada adicional durante la inicialización reutiliza la petición en curso.
    const extraCall = firstValueFrom(TestBed.inject(AuthService).restoreSession());

    expect(initStatus.done).toBe(false);
    expect(session.isAuthenticated()).toBe(false);

    httpTesting.expectOne(apiUrl('auth', 'me')).flush(user);
    await Promise.all([initStatus.donePromise, extraCall]);

    expect(initStatus.done).toBe(true);
    expect(session.isAuthenticated()).toBe(true);
    httpTesting.verify();
  });
});
