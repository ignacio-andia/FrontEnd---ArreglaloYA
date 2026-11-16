import { RoleName } from '../models/role.model';

/** Raíz de cada área privada por rol. */
export const AREA_HOME_PATHS: Readonly<Record<RoleName, string>> = {
  ADMINISTRADOR: '/admin',
  TRABAJADOR: '/trabajador',
  CLIENTE: '/cliente',
};

/**
 * Prioridad para elegir el área predeterminada de una cuenta con varios roles.
 * TRABAJADOR indica el rol, no un perfil aprobado: las páginas que exigen aprobación
 * siguen protegidas por approvedWorkerGuard.
 */
const ROLE_PRIORITY: readonly RoleName[] = ['ADMINISTRADOR', 'TRABAJADOR', 'CLIENTE'];

const PUBLIC_HOME_PATH = '/';
const AUTH_AREA_PATH = '/auth';

/** Área predeterminada de una cuenta según sus roles (o el inicio público si no tiene ninguno). */
export function homePathForRoles(roles: readonly RoleName[]): string {
  const role = ROLE_PRIORITY.find((candidate) => roles.includes(candidate));
  return role ? AREA_HOME_PATHS[role] : PUBLIC_HOME_PATH;
}

/** Indica si una URL interna pertenece al área de autenticación (`/auth`, `/auth/...`). */
export function isAuthAreaUrl(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0];
  return path === AUTH_AREA_PATH || path.startsWith(`${AUTH_AREA_PATH}/`);
}

const PLACEHOLDER_ORIGIN = 'http://return-url.invalid';

/** Barras invertidas (los navegadores las tratan como `/`) y caracteres de control. */
function hasUnsafeCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (character === '\\' || code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Valida un `returnUrl` recibido por query string. Solo admite rutas internas absolutas
 * (`/cliente/...`) y devuelve la ruta normalizada, o `null` si no es segura:
 * URLs con esquema u host (`https://...`, `//host`, `/\host`), caracteres de control,
 * barras invertidas o rutas del área de autenticación (evita ciclos de redirección).
 */
export function safeReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || hasUnsafeCharacters(value)) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== PLACEHOLDER_ORIGIN || isAuthAreaUrl(url.pathname)) {
    return null;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
