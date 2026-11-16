/**
 * Cuerpo de `PATCH /users/:id` (`UpdateUserDto`). Solo estos datos personales son modificables;
 * el correo, los roles, el estado y el id no. Hay que enviar al menos una propiedad.
 *
 * - `firstName` / `lastName`: se pueden omitir, pero no enviar `null` (1 a 100 caracteres).
 * - `phone`: se puede omitir; `null` elimina el teléfono registrado.
 */
export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
}

/** `@MaxLength(100)` de nombre y apellido en `UpdateUserDto`. */
export const ACCOUNT_NAME_MAX_LENGTH = 100;
