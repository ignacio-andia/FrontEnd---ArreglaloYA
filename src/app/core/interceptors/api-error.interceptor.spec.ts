import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { AuthResponse } from '../auth/auth.models';
import { SessionStore } from '../auth/session.store';
import { apiUrl } from '../http/api-url';
import { NormalizedApiError } from '../models/api-error.model';
import { apiErrorInterceptor } from './api-error.interceptor';

const authResponse: AuthResponse = {
  accessToken: 'jwt-token',
  tokenType: 'Bearer',
  user: {
    id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    phone: null,
    status: 'ACTIVO',
    roles: ['CLIENTE'],
    createdAt: '2026-11-15T14:30:00.000Z',
    updatedAt: '2026-11-15T14:30:00.000Z',
  },
};

/** Resuelve con el error emitido por el observable (o falla si emite un valor). */
function captureError(source: Observable<unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    source.subscribe({
      next: () => reject(new Error('Se esperaba un error')),
      error: (error: unknown) => resolve(error),
    });
  });
}

describe('apiErrorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('normalizes a string message into messages[] and keeps statusCode and error', async () => {
    const url = apiUrl('worker-profile', 'admin', 'zone-change-requests', 'id', 'approve');
    const result = captureError(http.post(url, {}));

    httpTesting
      .expectOne(url)
      .flush(
        { statusCode: 409, message: 'La solicitud ya fue resuelta', error: 'Conflict' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(await result).toEqual<NormalizedApiError>({
      statusCode: 409,
      messages: ['La solicitud ya fue resuelta'],
      error: 'Conflict',
    });
  });

  it('keeps every message when the backend returns string[]', async () => {
    const url = apiUrl('auth', 'register');
    const result = captureError(http.post(url, {}));

    httpTesting.expectOne(url).flush(
      {
        statusCode: 400,
        message: [
          'email must be an email',
          'password debe contener al menos una letra y un número',
        ],
        error: 'Bad Request',
      },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(await result).toEqual<NormalizedApiError>({
      statusCode: 400,
      messages: ['email must be an email', 'password debe contener al menos una letra y un número'],
      error: 'Bad Request',
    });
  });

  it('clears the session on 401', async () => {
    session.setSession(authResponse);
    const url = apiUrl('auth', 'me');
    const result = captureError(http.get(url));

    httpTesting
      .expectOne(url)
      .flush(
        { statusCode: 401, message: 'Sesión inválida', error: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(await result).toEqual<NormalizedApiError>({
      statusCode: 401,
      messages: ['Sesión inválida'],
      error: 'Unauthorized',
    });
    expect(session.token()).toBeNull();
    expect(session.user()).toBeNull();
  });

  it('does not clear a session started while the failed request was in flight', async () => {
    const url = apiUrl('auth', 'me');
    const result = captureError(http.get(url));
    session.setSession(authResponse);

    httpTesting
      .expectOne(url)
      .flush(
        { statusCode: 401, message: 'Sesión inválida', error: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );

    await result;
    expect(session.token()).toBe('jwt-token');
  });

  it('keeps the session on 403', async () => {
    session.setSession(authResponse);
    const url = apiUrl('users');
    const result = captureError(http.get(url));

    httpTesting.expectOne(url).flush(
      {
        statusCode: 403,
        message: 'Operación reservada a administradores',
        error: 'Forbidden',
      },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(await result).toEqual<NormalizedApiError>({
      statusCode: 403,
      messages: ['Operación reservada a administradores'],
      error: 'Forbidden',
    });
    expect(session.token()).toBe('jwt-token');
    expect(session.isAuthenticated()).toBe(true);
  });

  it('replaces 500 technical messages with a generic one', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const url = apiUrl('orders', 'me');
    const result = captureError(http.get(url));

    httpTesting
      .expectOne(url)
      .flush(
        { statusCode: 500, message: 'Internal server error' },
        { status: 500, statusText: 'Internal Server Error' },
      );

    const error = (await result) as NormalizedApiError;
    expect(error.statusCode).toBe(500);
    expect(error.messages).toHaveLength(1);
    expect(error.messages[0]).not.toContain('Internal server error');
  });

  it('returns statusCode 0 with a connection message on network errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const url = apiUrl('auth', 'me');
    const result = captureError(http.get(url));

    httpTesting.expectOne(url).error(new ProgressEvent('error'));

    const error = (await result) as NormalizedApiError;
    expect(error.statusCode).toBe(0);
    expect(error.messages).toHaveLength(1);
  });

  it('uses a generic message when the body is not an ApiError', async () => {
    const url = apiUrl('orders', 'me');
    const result = captureError(http.get(url));

    httpTesting.expectOne(url).flush('<html>Not Found</html>', {
      status: 404,
      statusText: 'Not Found',
    });

    const error = (await result) as NormalizedApiError;
    expect(error.statusCode).toBe(404);
    expect(error.messages).toHaveLength(1);
    expect(error.messages[0]).not.toContain('<html>');
    expect(error.error).toBeUndefined();
  });

  it('reads ApiError bodies from blob downloads', async () => {
    const url = apiUrl('orders', 'me', 'order-id', 'images', 'image-id');
    const result = captureError(http.get(url, { responseType: 'blob' }));
    const body = new Blob(
      [JSON.stringify({ statusCode: 404, message: 'Pedido no encontrado', error: 'Not Found' })],
      { type: 'application/json' },
    );

    httpTesting.expectOne(url).flush(body, { status: 404, statusText: 'Not Found' });

    expect(await result).toEqual<NormalizedApiError>({
      statusCode: 404,
      messages: ['Pedido no encontrado'],
      error: 'Not Found',
    });
  });

  it('leaves errors from external URLs untouched', async () => {
    session.setSession(authResponse);
    const url = 'https://external.example.com/data';
    const result = captureError(http.get(url));

    httpTesting.expectOne(url).flush('', { status: 401, statusText: 'Unauthorized' });

    expect(await result).toBeInstanceOf(HttpErrorResponse);
    expect(session.token()).toBe('jwt-token');
  });
});
