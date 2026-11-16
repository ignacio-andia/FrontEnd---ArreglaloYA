import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, share, tap } from 'rxjs';
import { apiUrl } from '../http/api-url';
import { AuthResponse, LoginRequest, RegisterRequest, User } from './auth.models';
import { SessionStore } from './session.store';

/**
 * Operaciones de autenticación contra `/api/auth`.
 * El estado de la sesión vive en SessionStore; este servicio solo lo actualiza.
 * No hay logout, refresh ni revocación en el backend: el cierre de sesión es local.
 */
@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStore);

  private restoreInFlight: Observable<void> | null = null;

  /** `POST /auth/register`: crea una cuenta CLIENTE e inicia la sesión. */
  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(apiUrl('auth', 'register'), toRegisterBody(request))
      .pipe(tap((response) => this.session.setSession(response)));
  }

  /** `POST /auth/login`: inicia la sesión. */
  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(apiUrl('auth', 'login'), toLoginBody(request))
      .pipe(tap((response) => this.session.setSession(response)));
  }

  /** `GET /auth/me`: obtiene el usuario del token actual y lo guarda en la sesión. */
  getCurrentUser(): Observable<User> {
    return this.http
      .get<User>(apiUrl('auth', 'me'))
      .pipe(tap((user) => this.session.setUser(user)));
  }

  /**
   * Cierra la sesión localmente. El backend no tiene endpoint de logout ni revocación:
   * el token deja de usarse en el frontend, pero sigue siendo válido hasta su expiración.
   */
  logout(): void {
    this.session.clear();
  }

  /**
   * Valida el token restaurado de sessionStorage con `GET /auth/me`.
   *
   * - Sin token o con el usuario ya cargado: termina sin peticiones.
   * - Respuesta correcta: guarda el usuario y la sesión queda autenticada.
   * - 401: apiErrorInterceptor limpia la sesión.
   * - Otro error (red, 5xx): el usuario sigue sin cargar, por lo que la sesión no se
   *   considera autenticada; el token se conserva para poder reintentar.
   *
   * Nunca emite error y comparte la petición en curso entre llamadas simultáneas.
   */
  restoreSession(): Observable<void> {
    if (!this.session.hasToken() || this.session.isAuthenticated()) {
      return of(undefined);
    }

    this.restoreInFlight ??= this.getCurrentUser().pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      finalize(() => (this.restoreInFlight = null)),
      share(),
    );

    return this.restoreInFlight;
  }
}

/** Construye el cuerpo con las propiedades exactas de `RegisterDto` (forbidNonWhitelisted). */
function toRegisterBody(request: RegisterRequest): RegisterRequest {
  const body: RegisterRequest = {
    firstName: request.firstName,
    lastName: request.lastName,
    email: request.email,
    password: request.password,
  };

  if (request.phone !== undefined) {
    body.phone = request.phone;
  }

  return body;
}

/** Construye el cuerpo con las propiedades exactas de `LoginDto` (forbidNonWhitelisted). */
function toLoginBody(request: LoginRequest): LoginRequest {
  return { email: request.email, password: request.password };
}
