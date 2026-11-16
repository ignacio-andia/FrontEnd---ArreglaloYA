/** Estados del perfil de trabajador: literales exactos del enum `WorkerProfileStatus` del backend. */
export const WORKER_PROFILE_STATUSES = [
  'BORRADOR',
  'PENDIENTE',
  'OBSERVADO',
  'APROBADO',
  'RECHAZADO',
  'SUSPENDIDO',
] as const;

export type WorkerProfileStatus = (typeof WORKER_PROFILE_STATUSES)[number];
