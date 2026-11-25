/** Literales exactos del enum `ClaimStatus` del backend. */
export type ClaimStatus = 'ABIERTO' | 'EN_REVISION' | 'RESUELTO';

/** Límite de `CreateClaimDto.description`. */
export const CLAIM_DESCRIPTION_MAX_LENGTH = 2000;
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

/** Campos de `POST /orders/:orderId/claims` (`multipart/form-data`). */
export interface CreateClaimRequest {
  description: string;
  images: readonly File[];
}
