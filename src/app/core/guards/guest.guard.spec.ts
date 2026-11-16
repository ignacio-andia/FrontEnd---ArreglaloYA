import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { User } from '../auth/auth.models';
import { SessionStore } from '../auth/session.store';
import { apiUrl } from '../http/api-url';
import { apiErrorInterceptor } from '../interceptors/api-error.interceptor';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { RoleName } from '../models/role.model';
import { guestGuard } from './guest.guard';

const TOKEN_STORAGE_KEY = 'servicios-hogar.access-token';

function userWithRoles(roles: RoleName[]): User {
  return {
    id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    phone: null,
    status: 'ACTIVO',
    roles,
    createdAt: '2026-11-15T14:30:00.000Z',
    updatedAt: '2026-11-15T14:30:00.000Z',
  };
}

function runGuard(): Promise<GuardResult> {
  const result = TestBed.runInInjectionContext(() =>
    guestGuard({} as ActivatedRouteSnapshot, { url: '/auth/login' } as RouterStateSnapshot),
  );
  return isObservable(result) ? firstValueFrom(result) : Promise.resolve(result);
}

describe('guestGuard', () => {
  let httpTesting: HttpTestingController;

  function setup(storedToken: string | null = null): SessionStore {
    if (storedToken !== null) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, storedToken);
    }
    httpTesting = TestBed.inject(HttpTestingController);
    return TestBed.inject(SessionStore);
  }

  function serialize(result: GuardResult): string {
    expect(result).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  it('allows visitors without a session', async () => {
    setup();

    expect(await runGuard()).toBe(true);
  });

  it.each([
    [['CLIENTE'], '/cliente'],
    [['CLIENTE', 'TRABAJADOR'], '/trabajador'],
    [['ADMINISTRADOR'], '/admin'],
  ] as const)('redirects an authenticated %j account to %s', async (roles, path) => {
    const session = setup();
    session.setSession({
      accessToken: 'jwt',
      tokenType: 'Bearer',
      user: userWithRoles([...roles]),
    });

    expect(serialize(await runGuard())).toBe(path);
    expect(session.token()).toBe('jwt');
  });

  it('restores a stored session before deciding (reload on /auth/login)', async () => {
    setup('stored-token');

    const result = runGuard();
    httpTesting.expectOne(apiUrl('auth', 'me')).flush(userWithRoles(['CLIENTE']));

    expect(serialize(await result)).toBe('/cliente');
  });

  it('allows the page when the stored token is no longer valid', async () => {
    const session = setup('expired-token');

    const result = runGuard();
    httpTesting
      .expectOne(apiUrl('auth', 'me'))
      .flush(
        { statusCode: 401, message: 'Sesión inválida', error: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(await result).toBe(true);
    expect(session.hasToken()).toBe(false);
  });
});
