import { ORDER_ID } from '../../offers/testing/offers.fixtures';
import { CancellationSummary } from '../models/cancellation-summary.model';
import { Payment, PaymentDeclaration, PaymentsOverview, Receipts } from '../models/payment.model';

/**
 * Datos de prueba de pagos, con la forma exacta de los contratos. Solo se importan desde
 * archivos `.spec.ts`.
 */
export const NOTICE = 'El pago se realiza directamente al trabajador.';

export function declaration(overrides: Partial<PaymentDeclaration> = {}): PaymentDeclaration {
  return {
    id: 'd1',
    declaredBy: 'CLIENTE',
    userId: 'client',
    method: 'QR',
    amount: '25.00',
    createdAt: '2026-11-21T14:00:00.000Z',
    ...overrides,
  };
}

export function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    concept: 'ANTICIPO',
    paymentId: null,
    expectedAmount: '25.00',
    requiredConfirmation: 'TRABAJADOR',
    declarations: [],
    comparison: 'SIN_DECLARACIONES',
    difference: null,
    methodsMatch: null,
    ...overrides,
  };
}

export function overview(overrides: Partial<PaymentsOverview> = {}): PaymentsOverview {
  return {
    orderId: ORDER_ID,
    orderStatus: 'ACORDADO',
    notice: NOTICE,
    agreement: { baseAmount: '100.00', acceptedAdditional: '0.00', totalAmount: '100.00' },
    advanceTransition: 'ACTIVA',
    payments: [payment(), payment({ concept: 'SALDO', expectedAmount: null })],
    balance: {
      status: 'CALCULADO',
      amount: '75.00',
      advanceAmount: '25.00',
      additionalBudgetsTotal: '0.00',
      note: 'Informativo: el saldo real es lo que las partes declaran.',
    },
    ...overrides,
  };
}

export function receipts(overrides: Partial<Receipts> = {}): Receipts {
  return {
    orderId: ORDER_ID,
    notice: NOTICE,
    referenceNotice: 'El comprobante adjunto es solo una referencia.',
    service: {
      clientId: 'client',
      workerId: 'worker',
      agreedAmount: '100.00',
      issuedAt: '2026-11-20T15:00:00.000Z',
    },
    payments: [],
    ...overrides,
  };
}

/** Resumen de una cancelación con acuerdo; `withoutAgreement()` da la forma sin acuerdo. */
export function cancellationSummary(
  overrides: Partial<CancellationSummary> = {},
): CancellationSummary {
  return {
    orderId: ORDER_ID,
    notice: NOTICE,
    capturedAt: '2026-11-22T14:00:00.000Z',
    hasAgreement: true,
    agreement: { offerId: 'offer', agreedAt: '2026-11-20T15:00:00.000Z' },
    totals: {
      agreedAmount: '400.00',
      acceptedAdditionalTotal: '50.00',
      updatedTotal: '450.00',
      confirmedAdvanceTotal: '100.00',
      unconfirmedAdvanceAmount: null,
      pendingBalance: '350.00',
    },
    advance: {
      paymentId: 'p-advance',
      expectedAmount: '100.00',
      status: 'CONFIRMADO',
      declarations: [
        declaration({ id: 'a1', amount: '150.00' }),
        declaration({ id: 'a2', declaredBy: 'TRABAJADOR', amount: '100.00', method: 'EFECTIVO' }),
      ],
    },
    additionalBudgets: [
      {
        id: 'b1',
        amount: '50.00',
        respondedAt: '2026-11-21T15:00:00.000Z',
        createdAt: '2026-11-21T14:00:00.000Z',
      },
    ],
    visit: {
      paymentId: 'p-visit',
      expectedAmount: '30.00',
      status: 'DECLARADO_SIN_CONFIRMAR',
      declarations: [declaration({ id: 'v1', amount: '30.00', method: 'EFECTIVO' })],
      agreedCost: '30.00',
      performedAt: '2026-11-21T13:00:00.000Z',
      registeredCost: '30.00',
    },
    otherPayments: [],
    declarationsAfterCancellation: [],
    schemaVersion: 1,
    ...overrides,
  };
}

export function withoutAgreement(): CancellationSummary {
  return cancellationSummary({
    hasAgreement: false,
    agreement: null,
    totals: {
      agreedAmount: null,
      acceptedAdditionalTotal: null,
      updatedTotal: null,
      confirmedAdvanceTotal: null,
      unconfirmedAdvanceAmount: null,
      pendingBalance: null,
    },
    advance: null,
    additionalBudgets: [],
    visit: null,
  });
}
