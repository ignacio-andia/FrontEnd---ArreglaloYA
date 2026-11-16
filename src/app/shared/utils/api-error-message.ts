import { isNormalizedApiError } from '../../core/models/api-error.model';

/**
 * Mensajes para el usuario de un error de una petición a la API.
 * Acepta el `NormalizedApiError` del interceptor directamente o envuelto en `cause`
 * (como hacen `resource`/`rxResource` con los valores que no son `Error`).
 * Si el error no tiene la forma esperada, devuelve el mensaje genérico indicado.
 */
export function apiErrorMessages(error: unknown, fallback: string): string[] {
  const cause: unknown = error instanceof Error && error.cause !== undefined ? error.cause : error;
  return isNormalizedApiError(cause) && cause.messages.length > 0 ? cause.messages : [fallback];
}

/** Código HTTP de un error de la API (también envuelto en `cause`), o `null` si no lo tiene. */
export function apiErrorStatus(error: unknown): number | null {
  const cause: unknown = error instanceof Error && error.cause !== undefined ? error.cause : error;
  return isNormalizedApiError(cause) ? cause.statusCode : null;
}
