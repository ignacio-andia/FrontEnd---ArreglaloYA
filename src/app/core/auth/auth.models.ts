import { RoleName } from '../models/role.model';

/** Estados de cuenta: literales exactos del enum `UserStatus` del backend. */
export const USER_STATUSES = ['ACTIVO', 'INACTIVO', 'SUSPENDIDO'] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

/** Usuario público (`PublicUser` del backend). Las fechas son strings ISO 8601 en UTC. */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  roles: RoleName[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Cuerpo de `POST /auth/register` (`RegisterDto`). `phone` se puede omitir o enviar `null`.
 * El backend rechaza cualquier otra propiedad (por ejemplo `roles` o `status`).
 */
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string | null;
}

/** Cuerpo de `POST /auth/login` (`LoginDto`). */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Respuesta de `POST /auth/register` y `POST /auth/login`. */
export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  user: User;
}
