import { DOCUMENT } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionStore } from '../auth/session.store';
import { isApiUrl } from '../http/api-url';

/**
 * Añade `Authorization: Bearer <token>` solo a las peticiones dirigidas a la API configurada.
 * No modifica peticiones externas ni habilita `withCredentials` (el backend no usa cookies).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(SessionStore).token();

  if (token === null || !isApiUrl(req.url, inject(DOCUMENT).baseURI)) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
