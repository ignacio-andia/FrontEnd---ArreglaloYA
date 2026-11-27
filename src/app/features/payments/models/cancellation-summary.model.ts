import { PaymentConcept, PaymentDeclaration } from './payment.model';

export type SummaryPaymentStatus = 'CONFIRMADO' | 'DECLARADO_SIN_CONFIRMAR' | 'SIN_DECLARACIONES';

export interface SummaryPayment {
  paymentId: string | null;
  expectedAmount: string | null;
  status: SummaryPaymentStatus;
  declarations: PaymentDeclaration[];
}

/**
 * `GET /orders/:orderId/cancellation-summary` (#116): fotografía de los importes al cancelar.
 * Los calcula el backend; `null` significa que no hay dato o no aplica, nunca cero.
 */
export interface CancellationSummary {
  orderId: string;
  /** Aviso de pago directo que redacta el backend. */
  notice: string;
  capturedAt: string;
  hasAgreement: boolean;
  agreement: { offerId: string; agreedAt: string | null } | null;
  totals: {
    agreedAmount: string | null;
    acceptedAdditionalTotal: string | null;
    updatedTotal: string | null;
    confirmedAdvanceTotal: string | null;
    unconfirmedAdvanceAmount: string | null;
    pendingBalance: string | null;
  };
  advance: SummaryPayment | null;
  /** Solo los aceptados. */
  additionalBudgets: {
    id: string;
    amount: string;
    respondedAt: string | null;
    createdAt: string;
  }[];
  visit:
    | (SummaryPayment & {
        agreedCost: string | null;
        performedAt: string | null;
        registeredCost: string | null;
      })
    | null;
  otherPayments: (SummaryPayment & { concept: PaymentConcept })[];
  /** Registradas después: no cambian la fotografía. */
  declarationsAfterCancellation: (PaymentDeclaration & { concept: PaymentConcept })[];
  schemaVersion: number;
}

export const SUMMARY_STATUS_LABELS: Readonly<Record<SummaryPaymentStatus, string>> = {
  CONFIRMADO: 'Confirmado por el trabajador',
  DECLARADO_SIN_CONFIRMAR: 'Declarado — sin confirmar',
  SIN_DECLARACIONES: 'Sin declaraciones',
};

/**
 * Único texto que distingue los dos 404 de #116 (contrato 11, §6.4): pedido cancelado antes de
 * que existiera el resumen, frente a pedido inexistente o ajeno.
 */
export const SUMMARY_NOT_RECORDED_MESSAGE =
  'El pedido se canceló sin resumen económico registrado.';
