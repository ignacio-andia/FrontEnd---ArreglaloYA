import { OfferParty } from '../../offers/models/offer.model';
import { OrderStatus } from '../../orders/models/order.model';

export type PaymentConcept = 'VISITA' | 'ANTICIPO' | 'SALDO';
export type PaymentMethod = 'EFECTIVO' | 'QR';

export type DeclarationComparison =
  | 'SIN_DECLARACIONES'
  | 'SOLO_CLIENTE'
  | 'SOLO_TRABAJADOR'
  | 'MONTOS_COINCIDEN'
  | 'MONTOS_DIFERENTES';

/** Declaración de una parte: no se edita ni se borra. */
export interface PaymentDeclaration {
  id: string;
  declaredBy: OfferParty;
  userId: string;
  method: PaymentMethod;
  amount: string;
  createdAt: string;
}

export interface Payment {
  concept: PaymentConcept;
  /** `null` mientras nadie declaró. */
  paymentId: string | null;
  /** `null` en el saldo. */
  expectedAmount: string | null;
  requiredConfirmation: 'TRABAJADOR';
  declarations: PaymentDeclaration[];
  /** Informativa: no concilia ni cambia el pedido. */
  comparison: DeclarationComparison;
  /** Monto del trabajador menos el del cliente. */
  difference: string | null;
  methodsMatch: boolean | null;
}

export interface Balance {
  status: 'CALCULADO' | 'PENDIENTE_INTEGRACION' | 'NO_APLICA';
  amount: string | null;
  advanceAmount: string | null;
  additionalBudgetsTotal: string | null;
  note: string;
}

/** `GET /orders/:orderId/payments` (`PaymentsOverview`). */
export interface PaymentsOverview {
  orderId: string;
  orderStatus: OrderStatus;
  /** Aviso de pago directo que redacta el backend. */
  notice: string;
  agreement: { baseAmount: string; acceptedAdditional: string; totalAmount: string } | null;
  advanceTransition: 'ACTIVA';
  payments: Payment[];
  balance: Balance;
}

/** `GET /orders/:orderId/receipts` (`ReceiptsView`). */
export interface Receipts {
  orderId: string;
  notice: string;
  referenceNotice: string;
  service: { clientId: string; workerId: string; agreedAmount: string; issuedAt: string } | null;
  payments: { concept: PaymentConcept; paymentId: string; declaration: PaymentDeclaration }[];
}

/** Cuerpo de `POST /orders/:orderId/payments/:concept/declarations` (`DeclarePaymentDto`). */
export interface DeclarePaymentRequest {
  amount: string;
  method: PaymentMethod;
}

export interface DeclarationResult {
  notice: string;
  payment: Payment;
  orderTransition: 'ANTICIPO_REGISTRADO' | 'NO_APLICA';
}

export const CONCEPT_LABELS: Readonly<Record<PaymentConcept, string>> = {
  VISITA: 'Visita',
  ANTICIPO: 'Anticipo (25 %)',
  SALDO: 'Saldo',
};

export const METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  EFECTIVO: 'Efectivo',
  QR: 'QR',
};

export const PARTY_LABELS: Readonly<Record<OfferParty, string>> = {
  CLIENTE: 'Cliente',
  TRABAJADOR: 'Trabajador',
};

export const COMPARISON_LABELS: Readonly<Record<DeclarationComparison, string>> = {
  SIN_DECLARACIONES: 'Sin declaraciones',
  SOLO_CLIENTE: 'Solo declaró el cliente',
  SOLO_TRABAJADOR: 'Solo declaró el trabajador',
  MONTOS_COINCIDEN: 'Los montos declarados coinciden',
  MONTOS_DIFERENTES: 'Los montos declarados difieren',
};

/** La visita solo se paga en efectivo. */
export function allowedMethods(concept: PaymentConcept): readonly PaymentMethod[] {
  return concept === 'VISITA' ? ['EFECTIVO'] : ['EFECTIVO', 'QR'];
}

const AFTER_ADVANCE: readonly OrderStatus[] = [
  'ANTICIPO_REGISTRADO',
  'VISITA_REALIZADA',
  'PRESUPUESTO_ADICIONAL_PENDIENTE',
  'EN_EJECUCION',
  'TERMINADO',
  'EN_RECLAMO',
  'CERRADO',
];

/** Estados en los que el backend admite declarar cada concepto. */
const DECLARABLE: Readonly<Record<PaymentConcept, readonly OrderStatus[]>> = {
  ANTICIPO: ['ACORDADO', ...AFTER_ADVANCE],
  VISITA: [...AFTER_ADVANCE.filter((status) => status !== 'ANTICIPO_REGISTRADO'), 'CANCELADO'],
  SALDO: ['TERMINADO', 'EN_RECLAMO', 'CERRADO'],
};

export interface DeclarationContext {
  viewer: OfferParty;
  status: OrderStatus;
  visitRegistered: boolean;
  balance: Balance['status'];
}

/**
 * Si quien mira puede declarar este pago y, si no, por qué. Es una ayuda de la interfaz con las
 * reglas del contrato: el backend decide (403 o 409).
 */
export function declarationAvailability(
  payment: Payment,
  context: DeclarationContext,
): { allowed: true } | { allowed: false; reason: string } {
  const deny = (reason: string) => ({ allowed: false, reason }) as const;
  const { concept } = payment;
  const collectsVisit = concept === 'VISITA' && context.viewer === 'TRABAJADOR';
  if (payment.declarations.some((item) => item.declaredBy === context.viewer)) {
    return deny(
      collectsVisit
        ? 'Ya confirmó el cobro de la visita: no se edita ni se repite.'
        : 'Ya registró su declaración: no se edita ni se repite.',
    );
  }
  // El trabajador no declara la visita: confirma su cobro (#84), por el monto acordado.
  if (collectsVisit) {
    if (context.visitRegistered) {
      return deny('El cobro de la visita se confirma por el monto acordado.');
    }
    return deny(
      context.status === 'CANCELADO' || context.status === 'CERRADO'
        ? 'No hay una visita registrada: no hay cobro que confirmar.'
        : 'Podrá confirmar el cobro cuando registre la visita.',
    );
  }
  if (concept === 'SALDO' && context.balance === 'NO_APLICA') {
    return deny('En este pedido no corresponde un saldo.');
  }
  const visitMissing = concept === 'VISITA' && !context.visitRegistered;
  if (!DECLARABLE[concept].includes(context.status) || visitMissing) {
    if (context.status === 'CANCELADO') {
      return deny('En un pedido cancelado solo se declara una visita ya realizada.');
    }
    return deny(
      concept === 'VISITA'
        ? 'Se puede declarar cuando el trabajador registre la visita.'
        : concept === 'SALDO'
          ? 'Se puede declarar cuando el trabajo esté terminado.'
          : 'No se puede declarar en el estado actual del pedido.',
    );
  }
  return { allowed: true };
}
