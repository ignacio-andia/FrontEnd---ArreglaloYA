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

/** Texto visible de cada estado. Solo traduce el literal; el valor enviado y recibido no cambia. */
export const WORKER_PROFILE_STATUS_LABELS: Readonly<Record<WorkerProfileStatus, string>> = {
  BORRADOR: 'Borrador',
  PENDIENTE: 'Pendiente de revisión',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  SUSPENDIDO: 'Suspendido',
};

/**
 * Significado de cada estado según el contrato (04-enums-and-states). Solo describe: qué se puede
 * editar o enviar lo deciden `canEdit` y `canSubmit` del backend.
 */
export const WORKER_PROFILE_STATUS_DESCRIPTIONS: Readonly<Record<WorkerProfileStatus, string>> = {
  BORRADOR: 'El perfil fue creado y aún no se envió a revisión.',
  PENDIENTE: 'El perfil fue enviado a revisión.',
  OBSERVADO: 'El perfil tiene observaciones: puede corregirlo y volver a enviarlo a revisión.',
  APROBADO: 'El perfil está habilitado.',
  RECHAZADO: 'El perfil fue rechazado: puede corregirlo y volver a enviarlo a revisión.',
  SUSPENDIDO:
    'El perfil está suspendido: puede regularizar sus datos, pero no enviarlo a revisión. Solo el equipo de revisión puede reactivarlo.',
};
