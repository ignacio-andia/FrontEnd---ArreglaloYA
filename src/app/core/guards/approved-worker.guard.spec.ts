import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  GuardResult,
  RedirectCommand,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { WorkerEligibility } from '../../features/worker-profile/models/worker-profile.model';
import { User } from '../auth/auth.models';
import { SessionStore } from '../auth/session.store';
import { apiUrl } from '../http/api-url';
import { apiErrorInterceptor } from '../interceptors/api-error.interceptor';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { approvedWorkerGuard } from './approved-worker.guard';

const ELIGIBILITY_URL = apiUrl('worker-profile', 'me', 'eligibility');

const worker: User = {
  id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  phone: '70000000',
  status: 'ACTIVO',
  roles: ['CLIENTE', 'TRABAJADOR'],
  createdAt: '2026-11-15T14:30:00.000Z',
  updatedAt: '2026-11-15T14:30:00.000Z',
};

function runGuard(guard: CanActivateFn, url: string): Promise<GuardResult> {
  const result = TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
  return isObservable(result) ? firstValueFrom(result) : Promise.resolve(result);
}

describe('approvedWorkerGuard', () => {
  let httpTesting: HttpTestingController;
  let session: SessionStore;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    session = TestBed.inject(SessionStore);
    session.setSession({ accessToken: 'jwt-token', tokenType: 'Bearer', user: worker });
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('allows an approved worker (eligible: true)', async () => {
    const result = runGuard(approvedWorkerGuard, '/trabajador/pedidos-disponibles');
    const req = httpTesting.expectOne(ELIGIBILITY_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush({
      eligible: true,
      status: 'APROBADO',
      message: 'Su perfil está aprobado.',
      reason: null,
    } satisfies WorkerEligibility);

    expect(await result).toBe(true);
  });

  it('denies a non-eligible worker and keeps the eligibility for the destination', async () => {
    const eligibility: WorkerEligibility = {
      eligible: false,
      status: 'OBSERVADO',
      message: 'Su perfil de trabajador tiene observaciones.',
      reason: 'Falta el certificado de antecedentes.',
    };

    const result = runGuard(approvedWorkerGuard, '/trabajador/pedidos-disponibles');
    httpTesting.expectOne(ELIGIBILITY_URL).flush(eligibility);
    const outcome = await result;

    expect(outcome).toBeInstanceOf(RedirectCommand);
    const command = outcome as RedirectCommand;
    expect(router.serializeUrl(command.redirectTo)).toBe('/trabajador');
    expect(command.navigationBehaviorOptions?.state).toEqual({ workerEligibility: eligibility });
    expect(session.isAuthenticated()).toBe(true);
  });

  it('relies only on eligible, not on the profile status', async () => {
    const result = runGuard(approvedWorkerGuard, '/trabajador/pedidos-disponibles');
    httpTesting.expectOne(ELIGIBILITY_URL).flush({
      eligible: false,
      status: 'APROBADO',
      message: 'La cuenta no está activa.',
      reason: null,
    } satisfies WorkerEligibility);

    expect(await result).toBeInstanceOf(RedirectCommand);
  });

  it('cancels instead of redirecting when already at the worker home', async () => {
    const result = runGuard(approvedWorkerGuard, '/trabajador');
    httpTesting.expectOne(ELIGIBILITY_URL).flush({
      eligible: false,
      status: null,
      message: 'No tiene un perfil de trabajador.',
      reason: null,
    } satisfies WorkerEligibility);

    expect(await result).toBe(false);
  });

  it('denies and redirects to the worker home when the endpoint returns 403', async () => {
    const result = runGuard(approvedWorkerGuard, '/trabajador/pedidos-disponibles');
    httpTesting.expectOne(ELIGIBILITY_URL).flush(
      {
        statusCode: 403,
        message: 'No tiene permisos para realizar esta operación',
        error: 'Forbidden',
      },
      { status: 403, statusText: 'Forbidden' },
    );

    const outcome = await result;
    expect(outcome).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(outcome as UrlTree)).toBe('/trabajador');
    expect(session.isAuthenticated()).toBe(true);
  });

  it('denies on network errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = runGuard(approvedWorkerGuard, '/trabajador/pedidos-disponibles');
    httpTesting.expectOne(ELIGIBILITY_URL).error(new ProgressEvent('error'));

    const outcome = await result;
    expect(outcome).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(outcome as UrlTree)).toBe('/trabajador');
  });

  it('redirects to login on 401 after the interceptor clears the session', async () => {
    const result = runGuard(approvedWorkerGuard, '/trabajador/pedidos-disponibles');
    httpTesting
      .expectOne(ELIGIBILITY_URL)
      .flush(
        { statusCode: 401, message: 'Sesión inválida', error: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );

    const outcome = await result;
    expect(outcome).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(outcome as UrlTree)).toBe(
      '/auth/login?returnUrl=%2Ftrabajador%2Fpedidos-disponibles',
    );
    expect(session.hasToken()).toBe(false);
  });
});
