import { environment } from '../../../environments/environment';

/** URL base de la API (ya incluye el prefijo `/api`). Único punto de acceso a `environment.apiBaseUrl`. */
export const API_BASE_URL = environment.apiBaseUrl;

/**
 * Construye la URL de un recurso de la API a partir de sus segmentos de ruta.
 * Cada segmento se codifica, por lo que no deben incluir `/` ni parámetros de consulta
 * (los parámetros se envían con la opción `params` de HttpClient).
 *
 * @example apiUrl('orders', 'me', orderId) // '/api/orders/me/<orderId>'
 */
export function apiUrl(...segments: readonly string[]): string {
  if (segments.some((segment) => segment.length === 0)) {
    throw new Error('apiUrl: los segmentos de ruta no pueden estar vacíos.');
  }

  if (segments.length === 0) {
    return API_BASE_URL;
  }

  return `${API_BASE_URL}/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;
}

/**
 * Indica si una URL de petición apunta a la API configurada.
 * Resuelve ambas URLs contra `baseUri` (normalmente `document.baseURI`) y exige el mismo
 * origen y que la ruta sea la base de la API o esté debajo de ella (`/api` o `/api/...`).
 * URLs externas, protocol-relative (`//otro-dominio/api`) o con prefijo parecido (`/apix`)
 * no se consideran de la API.
 */
export function isApiUrl(url: string, baseUri: string): boolean {
  let target: URL;
  let api: URL;

  try {
    api = new URL(API_BASE_URL, baseUri);
    target = new URL(url, baseUri);
  } catch {
    return false;
  }

  if (target.origin !== api.origin) {
    return false;
  }

  const apiPath = api.pathname.replace(/\/+$/, '');
  return target.pathname === apiPath || target.pathname.startsWith(`${apiPath}/`);
}
