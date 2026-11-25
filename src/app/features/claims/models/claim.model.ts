/** Literales exactos del enum `ClaimStatus` del backend. */
export const CLAIM_STATUSES = ['ABIERTO', 'EN_REVISION', 'RESUELTO'] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export function isClaimStatus(value: string): value is ClaimStatus {
  return (CLAIM_STATUSES as readonly string[]).includes(value);
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
}

/** Consulta del listado administrativo (`limit` máximo 50). */
export interface ClaimsQuery {
  status?: ClaimStatus;
  page?: number;
  limit?: number;
}

/** Campos de `POST /orders/:orderId/claims` (`multipart/form-data`). */
export interface CreateClaimRequest {
  description: string;
  images: readonly File[];
}
