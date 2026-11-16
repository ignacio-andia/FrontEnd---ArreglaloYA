/**
 * Roles de cuenta: literales exactos del enum `RoleName` del backend.
 * Una cuenta puede tener varios roles a la vez (por ejemplo, CLIENTE y TRABAJADOR).
 */
export const ROLE_NAMES = ['CLIENTE', 'TRABAJADOR', 'ADMINISTRADOR'] as const;

export type RoleName = (typeof ROLE_NAMES)[number];
