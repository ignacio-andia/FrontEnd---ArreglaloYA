import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, isDevMode } from '@angular/core';
import { Observable, catchError, from, map, of, switchMap, throwError } from 'rxjs';
import { SessionStore } from '../auth/session.store';
import { isApiUrl } from '../http/api-url';
import { ApiError, NormalizedApiError } from '../models/api-error.model';

const NETWORK_ERROR_MESSAGE =
  'No se pudo conectar con el servidor. Verifique su conexión e inténtelo de nuevo.';
const SERVER_ERROR_MESSAGE = 'Ocurrió un error en el servidor. Inténtelo de nuevo más tarde.';
const UNEXPECTED_ERROR_MESSAGE = 'Ocurrió un error inesperado. Inténtelo de nuevo más tarde.';

/**
 * Convierte los errores HTTP de la API en `NormalizedApiError`.
 *
 * - Conserva `statusCode`, los mensajes del backend (`string` o `string[]`) y `error`.
 * - 0 y 5xx: mensaje genérico; los detalles técnicos solo se registran en desarrollo.
 * - 401: limpia la sesión local. 403: no la modifica.
 * - Las peticiones a otros dominios se dejan intactas.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url, inject(DOCUMENT).baseURI)) {
    return next(req);
  }

  const session = inject(SessionStore);
  const tokenAtRequest = session.token();

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      return readErrorBody(error.error).pipe(
        map((body) => normalizeHttpError(error.status, body)),
        switchMap((normalized) => {
          // Solo se limpia si la sesión no cambió mientras la petición estaba en curso.
          if (normalized.statusCode === 401 && session.token() === tokenAtRequest) {
            session.clear();
          }

          if (isDevMode() && (normalized.statusCode === 0 || normalized.statusCode >= 500)) {
            console.error('[apiErrorInterceptor]', req.method, req.urlWithParams, error);
          }

          return throwError(() => normalized);
        }),
      );
    }),
  );
};

/** Obtiene el cuerpo del error; en descargas (`responseType: 'blob'`) el JSON llega como Blob. */
function readErrorBody(body: unknown): Observable<unknown> {
  if (body instanceof Blob) {
    return body.type.includes('json') ? from(body.text()).pipe(map(parseJson)) : of(null);
  }

  return of(typeof body === 'string' ? parseJson(body) : body);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeHttpError(status: number, body: unknown): NormalizedApiError {
  if (status === 0) {
    return { statusCode: 0, messages: [NETWORK_ERROR_MESSAGE] };
  }

  const apiError = isApiError(body) ? body : null;
  const statusCode = apiError?.statusCode ?? status;
  const errorName = apiError?.error !== undefined ? { error: apiError.error } : {};

  if (statusCode >= 500) {
    return { statusCode, messages: [SERVER_ERROR_MESSAGE], ...errorName };
  }

  const messages = apiError ? toMessages(apiError.message) : [];

  return {
    statusCode,
    messages: messages.length > 0 ? messages : [UNEXPECTED_ERROR_MESSAGE],
    ...errorName,
  };
}

function toMessages(message: string | string[]): string[] {
  return (Array.isArray(message) ? message : [message]).filter((text) => text.trim().length > 0);
}

function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const { statusCode, message, error } = candidate;

  return (
    typeof statusCode === 'number' &&
    (typeof message === 'string' ||
      (Array.isArray(message) && message.every((item) => typeof item === 'string'))) &&
    (error === undefined || typeof error === 'string')
  );
}
