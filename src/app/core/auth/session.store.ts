import { DOCUMENT } from '@angular/common';
import { Service, computed, inject, signal } from '@angular/core';
import { AuthResponse, User } from './auth.models';

const TOKEN_STORAGE_KEY = 'servicios-hogar.access-token';

/**
 * Estado de sesión del frontend.
 *
 * - El token se guarda en memoria (signal) y en sessionStorage para sobrevivir a recargas.
 * - El usuario solo se mantiene en memoria: tras recargar se vuelve a obtener con `GET /auth/me`.
 * - No realiza llamadas HTTP; la validación del token restaurado corresponde a AuthService.
 * - El backend sigue siendo la autoridad: un token presente no garantiza una sesión válida.
 */
@Service()
export class SessionStore {
  private readonly storage = inject(DOCUMENT).defaultView?.sessionStorage ?? null;

  private readonly tokenState = signal<string | null>(this.readStoredToken());
  private readonly userState = signal<User | null>(null);

  /** Token JWT actual, o `null` si no hay sesión. */
  readonly token = this.tokenState.asReadonly();

  /** Usuario autenticado. Es `null` hasta iniciar sesión o validar el token restaurado. */
  readonly user = this.userState.asReadonly();

  /** Hay un token disponible (restaurado o recién obtenido), aunque aún no esté validado. */
  readonly hasToken = computed(() => this.tokenState() !== null);

  /** Hay token y usuario cargado. */
  readonly isAuthenticated = computed(
    () => this.tokenState() !== null && this.userState() !== null,
  );

  /** Inicia la sesión con la respuesta de registro o login. */
  setSession(response: AuthResponse): void {
    this.tokenState.set(response.accessToken);
    this.userState.set(response.user);
    this.writeStoredToken(response.accessToken);
  }

  /** Actualiza el usuario (por ejemplo, tras `GET /auth/me`) sin modificar el token. */
  setUser(user: User): void {
    this.userState.set(user);
  }

  /** Cierra la sesión localmente. El backend no tiene logout ni revocación de tokens. */
  clear(): void {
    this.tokenState.set(null);
    this.userState.set(null);
    this.removeStoredToken();
  }

  private readStoredToken(): string | null {
    try {
      const token = this.storage?.getItem(TOKEN_STORAGE_KEY) ?? null;
      return token !== null && token.length > 0 ? token : null;
    } catch {
      return null;
    }
  }

  private writeStoredToken(token: string): void {
    try {
      this.storage?.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Almacenamiento no disponible (modo privado o cuota): la sesión sigue en memoria.
    }
  }

  private removeStoredToken(): void {
    try {
      this.storage?.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Almacenamiento no disponible: no hay nada que limpiar.
    }
  }
}
