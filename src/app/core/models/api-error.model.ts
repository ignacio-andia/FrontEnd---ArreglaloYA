/**
 * Cuerpo de error estándar del backend (NestJS `HttpException`).
 * `message` es un arreglo en los errores de validación y en algunos de negocio.
 * `error` no está presente en las respuestas 500.
 */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/**
 * Error uniforme que reciben servicios y componentes tras pasar por `apiErrorInterceptor`.
 * `messages` siempre es un arreglo, listo para mostrar al usuario.
 * `statusCode` es 0 cuando no hubo respuesta del servidor (sin conexión o servidor caído).
 */
export interface NormalizedApiError {
  statusCode: number;
  messages: string[];
  error?: string;
}

/** Comprueba si un error recibido en una suscripción HTTP es un `NormalizedApiError`. */
export function isNormalizedApiError(value: unknown): value is NormalizedApiError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const { statusCode, messages } = value as Record<string, unknown>;
  return (
    typeof statusCode === 'number' &&
    Array.isArray(messages) &&
    messages.every((message) => typeof message === 'string')
  );
}
