import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthResponse } from '../auth/auth.models';
import { SessionStore } from '../auth/session.store';
import { apiUrl } from '../http/api-url';
import { authInterceptor } from './auth.interceptor';

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

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
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
  });

  it('does not add Authorization when there is no token', () => {
    http.get(apiUrl('auth', 'me')).subscribe();

    const req = httpTesting.expectOne(apiUrl('auth', 'me'));
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('adds the Bearer token to API requests', () => {
    session.setSession(authResponse);

    http.get(apiUrl('auth', 'me')).subscribe();

    const req = httpTesting.expectOne(apiUrl('auth', 'me'));
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    expect(req.request.withCredentials).toBe(false);
    req.flush({});
  });

  it('adds the token to API requests resolved as absolute URLs on the same origin', () => {
    session.setSession(authResponse);
    const url = new URL(apiUrl('orders', 'me'), document.baseURI).href;

    http.get(url).subscribe();

    const req = httpTesting.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush({});
  });

  it.each([
    'https://external.example.com/api/orders',
    '//external.example.com/api/orders',
    'https://fonts.googleapis.com/css2?family=Inter',
  ])('does not send the token to external URL %s', (url) => {
    session.setSession(authResponse);

    http.get(url).subscribe();

    const req = httpTesting.expectOne(url);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not send the token to same-origin paths outside the API prefix', () => {
    session.setSession(authResponse);

    http.get('/apix/orders').subscribe();
    http.get('/assets/logo.svg').subscribe();

    for (const url of ['/apix/orders', '/assets/logo.svg']) {
      const req = httpTesting.expectOne(url);
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    }
  });
});
