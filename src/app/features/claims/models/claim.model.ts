/** Literales exactos del enum `ClaimStatus` del backend. */
export const CLAIM_STATUSES = ['ABIERTO', 'EN_REVISION', 'RESUELTO'] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export function isClaimStatus(value: string): value is ClaimStatus {
  return (CLAIM_STATUSES as readonly string[]).includes(value);
}

/** Literales exactos del enum `ClaimPriority` del backend, de más a menos urgente. */
export const CLAIM_PRIORITIES = ['URGENTE', 'ALTA', 'MEDIA', 'BAJA'] as const;

export type ClaimPriority = (typeof CLAIM_PRIORITIES)[number];

export function isClaimPriority(value: string): value is ClaimPriority {
  return (CLAIM_PRIORITIES as readonly string[]).includes(value);
}

export const CLAIM_PRIORITY_LABELS: Readonly<Record<ClaimPriority, string>> = {
  URGENTE: 'Urgente',
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
};

/**
 * Filtro `situation` de `GET /admin/claims`. Pendiente = ABIERTO o EN_REVISION; vencido =
 * pendiente con la fecha límite pasada; en plazo = pendiente con la fecha límite por delante.
 */
export const CLAIM_SITUATIONS = ['PENDIENTE', 'VENCIDO', 'EN_PLAZO'] as const;

export type ClaimSituation = (typeof CLAIM_SITUATIONS)[number];

export function isClaimSituation(value: string): value is ClaimSituation {
  return (CLAIM_SITUATIONS as readonly string[]).includes(value);
}

export const CLAIM_SITUATION_LABELS: Readonly<Record<ClaimSituation, string>> = {
  PENDIENTE: 'Pendientes',
  VENCIDO: 'Vencidos',
  EN_PLAZO: 'En plazo',
};

/** Administrador responsable de un reclamo (`ClaimAssigneeView`). */
export interface ClaimAssignee {
  id: string;
  firstName: string;
  lastName: string;
}

/** Límite de `CreateClaimDto.description`. */
export const CLAIM_DESCRIPTION_MAX_LENGTH = 2000;
/** Límite de `decision` y `justification` en `DecideClaimDto`. */
export const CLAIM_DECISION_MAX_LENGTH = 2000;

/** Cuerpo de `POST /admin/claims/:claimId/decision` (`DecideClaimDto`). */
export interface DecideClaimRequest {
  decision: string;
  justification: string;
}
/**
 * Fotografías por reclamo: por defecto son opcionales y hasta 20 (`CLAIM_MIN_IMAGES` y
 * `CLAIM_MAX_IMAGES`). La API no expone esa configuración: si cambia, responde 400.
 */
export const CLAIM_MAX_IMAGES = 20;

export interface ClaimImage {
  id: string;
  position: number;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/** Reclamo completo (`ClaimView`), para el cliente que lo presentó y el administrador. */
export interface Claim {
  id: string;
  orderId: string;
  status: ClaimStatus;
  description: string;
  images: ClaimImage[];
  decision: string | null;
  justification: string | null;
  decidedAt: string | null;
  createdAt: string;
  priority: ClaimPriority;
  dueAt: string;
  assignedAt: string | null;
  assignee: ClaimAssignee | null;
  /** Lo calcula el backend: pendiente y con la fecha límite pasada. */
  overdue: boolean;
}

/**
 * Lo que recibe el trabajador asignado (`ClaimPartyView`): sin descripción ni fotografías. La
 * decisión llega solo con el reclamo resuelto.
 */
export interface ClaimParty {
  id: string;
  orderId: string;
  status: ClaimStatus;
  decision: string | null;
  justification: string | null;
  decidedAt: string | null;
}

/** Distingue la respuesta completa de la que recibe el trabajador. */
export function isFullClaim(claim: Claim | ClaimParty): claim is Claim {
  return 'description' in claim;
}

export const CLAIM_STATUS_LABELS: Readonly<Record<ClaimStatus, string>> = {
  ABIERTO: 'Abierto',
  EN_REVISION: 'En revisión',
  RESUELTO: 'Resuelto',
};

/** Fila de `GET /admin/claims` (`ClaimSummary`): el listado no trae a las partes. */
export interface ClaimSummary {
  id: string;
  orderId: string;
  status: ClaimStatus;
  imageCount: number;
  createdAt: string;
  priority: ClaimPriority;
  dueAt: string;
  assignedAt: string | null;
  assignee: ClaimAssignee | null;
  overdue: boolean;
}

/** Consulta del listado administrativo (`limit` máximo 50). */
export interface ClaimsQuery {
  status?: ClaimStatus;
  priority?: ClaimPriority;
  situation?: ClaimSituation;
  /** UUID de un administrador, o `'none'` para los reclamos sin responsable. */
  assigneeId?: string;
  page?: number;
  limit?: number;
}

/** Cuerpo de `PATCH /admin/claims/:claimId/assignment`. */
export interface UpdateClaimAssignmentRequest {
  priority: ClaimPriority;
  assignedToId: string | null;
  /** ISO 8601. Ausente: el backend calcula el plazo según la prioridad. */
  dueAt?: string;
}

/** Campos de `POST /orders/:orderId/claims` (`multipart/form-data`). */
export interface CreateClaimRequest {
  description: string;
  images: readonly File[];
}
