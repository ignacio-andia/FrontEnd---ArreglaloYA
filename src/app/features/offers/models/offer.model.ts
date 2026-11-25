import { RoleName } from '../../../core/models/role.model';

/** Estados de oferta: literales exactos del enum `OfferStatus` del backend. */
export const OFFER_STATUSES = [
  'VIGENTE',
  'ACEPTADA',
  'RECHAZADA',
  'RETIRADA',
  'VENCIDA',
  'SIN_EFECTO',
] as const;

export type OfferStatus = (typeof OFFER_STATUSES)[number];

export function isOfferStatus(value: string): value is OfferStatus {
  return (OFFER_STATUSES as readonly string[]).includes(value);
}

/** Máximo de rondas: la propuesta y dos contraofertas (regla fija del backend). */
export const OFFER_MAX_ROUNDS = 3;

/** Quién participa en una negociación (`OfferParty`). */
export type OfferParty = 'CLIENTE' | 'TRABAJADOR';

export type OfferEventType =
  'PROPUESTA' | 'CONTRAOFERTA' | 'ACEPTADA' | 'RECHAZADA' | 'RETIRADA' | 'VENCIDA' | 'SIN_EFECTO';

/**
 * Oferta (`OfferView`). `status` es el estado efectivo calculado por el backend, los montos son
 * texto con 2 decimales y las fechas ISO 8601 en UTC.
 */
export interface Offer {
  id: string;
  orderId: string;
  status: OfferStatus;
  round: number;
  amount: string;
  /** Quién debe responder mientras la oferta está vigente. */
  turn: OfferParty;
  requiresVisit: boolean;
  visitCost: string | null;
  materialsIncluded: boolean;
  proposedStartAt: string;
  estimatedDurationMinutes: number;
  expiresAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Oferta vista por el cliente (`ReceivedOfferView`): sin correo ni teléfono del trabajador. */
export interface ReceivedOffer extends Offer {
  worker: { id: string; firstName: string; lastName: string };
}

/** Evento del historial (`OfferEventView`), del más antiguo al más reciente. */
export interface OfferEvent {
  type: OfferEventType;
  round: number;
  amount: string | null;
  actorType: 'USUARIO' | 'SISTEMA';
  actorRole: RoleName | null;
  systemProcess: string | null;
  reason: string | null;
  createdAt: string;
}

export type OfferDetail<T extends Offer = Offer> = T & { history: OfferEvent[] };

/** Cuerpo de `POST /offers/orders/:orderId` (`CreateOfferDto`). */
export interface CreateOfferRequest {
  amount: string;
  requiresVisit: boolean;
  /** Obligatorio si requiere visita (`"0"` = gratis); no se envía en otro caso. */
  visitCost?: string;
  materialsIncluded: boolean;
  /** ISO 8601 con zona horaria explícita, por ejemplo `2026-11-30T10:00:00-04:00`. */
  proposedStartAt: string;
  estimatedDurationMinutes: number;
}

/** Consulta de ofertas propias o recibidas; `orderId` solo aplica a las recibidas. */
export interface OffersQuery {
  status?: OfferStatus;
  orderId?: string;
  page?: number;
  limit?: number;
}

/** Contacto por WhatsApp (`WhatsAppContact`): el teléfono nunca llega por separado. */
export type WhatsAppContact =
  | { available: true; channel: 'WHATSAPP'; contactRole: OfferParty; url: string }
  | {
      available: false;
      channel: 'WHATSAPP';
      contactRole: OfferParty;
      url: null;
      reason: 'TELEFONO_NO_REGISTRADO' | 'TELEFONO_INVALIDO';
    };

export const OFFER_STATUS_LABELS: Readonly<Record<OfferStatus, string>> = {
  VIGENTE: 'Vigente',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
  RETIRADA: 'Retirada',
  VENCIDA: 'Vencida',
  SIN_EFECTO: 'Sin efecto',
};

/** Qué significa cada estado final (04-enums-and-states). */
export const OFFER_CLOSED_DESCRIPTIONS: Readonly<Record<Exclude<OfferStatus, 'VIGENTE'>, string>> =
  {
    ACEPTADA: 'El cliente aceptó esta oferta.',
    RECHAZADA: 'El cliente rechazó esta oferta.',
    RETIRADA: 'El trabajador retiró esta oferta.',
    VENCIDA: 'La oferta venció sin respuesta y ya no admite acciones.',
    SIN_EFECTO: 'La oferta quedó sin efecto y ya no admite acciones.',
  };

export const OFFER_EVENT_LABELS: Readonly<Record<OfferEventType, string>> = {
  PROPUESTA: 'Propuesta inicial',
  CONTRAOFERTA: 'Contraoferta',
  ACEPTADA: 'Aceptación',
  RECHAZADA: 'Rechazo',
  RETIRADA: 'Retiro',
  VENCIDA: 'Vencimiento',
  SIN_EFECTO: 'Cierre sin efecto',
};

/** Estado en que queda la oferta después de cada evento. */
export const OFFER_EVENT_RESULT: Readonly<Record<OfferEventType, OfferStatus>> = {
  PROPUESTA: 'VIGENTE',
  CONTRAOFERTA: 'VIGENTE',
  ACEPTADA: 'ACEPTADA',
  RECHAZADA: 'RECHAZADA',
  RETIRADA: 'RETIRADA',
  VENCIDA: 'VENCIDA',
  SIN_EFECTO: 'SIN_EFECTO',
};

/** Motivos identificables de los cierres del sistema; otros textos se muestran tal cual. */
export const OFFER_REASON_LABELS: Readonly<Partial<Record<string, string>>> = {
  PEDIDO_CANCELADO: 'El pedido fue cancelado.',
  PEDIDO_VENCIDO: 'El pedido venció.',
  CLIENTE_SUSPENDIDO: 'La cuenta del cliente fue suspendida.',
  TRABAJADOR_SUSPENDIDO: 'La cuenta del trabajador fue suspendida.',
  PERFIL_SUSPENDIDO: 'El perfil del trabajador fue suspendido.',
};

/** «90» → «1 h 30 min». */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
