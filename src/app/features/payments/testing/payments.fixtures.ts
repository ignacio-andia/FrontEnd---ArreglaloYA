import { ORDER_ID } from '../../offers/testing/offers.fixtures';
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
