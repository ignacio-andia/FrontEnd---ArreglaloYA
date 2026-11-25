import { ORDER_STATUSES, OrderStatus } from '../../orders/models/order.model';
import { payment, declaration } from '../testing/payments.fixtures';
import { DeclarationContext, allowedMethods, declarationAvailability } from './payment.model';

function context(overrides: Partial<DeclarationContext> = {}): DeclarationContext {
  return {
    viewer: 'CLIENTE',
    status: 'ACORDADO',
    visitRegistered: false,
    balance: 'CALCULADO',
    ...overrides,
  };
}

describe('declarationAvailability', () => {
  const allowedStatuses = (
    concept: 'ANTICIPO' | 'VISITA' | 'SALDO',
    overrides: Partial<DeclarationContext> = {},
  ): OrderStatus[] =>
    ORDER_STATUSES.filter(
      (status) =>
        declarationAvailability(payment({ concept }), context({ status, ...overrides })).allowed,
    );

  it('admits the advance from the agreement until closing, never on a cancelled order', () => {
    expect(allowedStatuses('ANTICIPO')).toEqual([
      'ACORDADO',
      'ANTICIPO_REGISTRADO',
      'VISITA_REALIZADA',
      'PRESUPUESTO_ADICIONAL_PENDIENTE',
      'EN_EJECUCION',
      'TERMINADO',
      'EN_RECLAMO',
      'CERRADO',
    ]);
  });

  it('admits the visit only once registered, also on a cancelled order', () => {
    expect(allowedStatuses('VISITA')).toEqual([]);
    const registered = allowedStatuses('VISITA', { visitRegistered: true });
    expect(registered).toContain('VISITA_REALIZADA');
    expect(registered).toContain('CANCELADO');
    expect(registered).not.toContain('ACORDADO');
  });

  it('admits the balance only with the work finished and when it applies', () => {
    expect(allowedStatuses('SALDO')).toEqual(['TERMINADO', 'EN_RECLAMO', 'CERRADO']);
    expect(allowedStatuses('SALDO', { balance: 'NO_APLICA' })).toEqual([]);
  });

  it('never lets the worker declare the visit', () => {
    const result = declarationAvailability(
      payment({ concept: 'VISITA' }),
      context({ viewer: 'TRABAJADOR', status: 'VISITA_REALIZADA', visitRegistered: true }),
    );

    expect(result.allowed).toBe(false);
  });

  it.each([
    ['ANTICIPO_REGISTRADO', false, 'cuando registre la visita'],
    ['CANCELADO', false, 'no hay cobro que confirmar'],
    ['VISITA_REALIZADA', true, 'por el monto acordado'],
  ] as const)('explains the visit to the worker in %s', (status, visitRegistered, text) => {
    const result = declarationAvailability(
      payment({ concept: 'VISITA' }),
      context({ viewer: 'TRABAJADOR', status, visitRegistered }),
    );

    expect(result).toEqual({ allowed: false, reason: expect.stringContaining(text) });
  });

  it('allows one declaration per party, independently of the other', () => {
    const declared = payment({ declarations: [declaration()] });

    expect(declarationAvailability(declared, context()).allowed).toBe(false);
    expect(declarationAvailability(declared, context({ viewer: 'TRABAJADOR' })).allowed).toBe(true);
  });

  it('only accepts cash for the visit', () => {
    expect(allowedMethods('VISITA')).toEqual(['EFECTIVO']);
    expect(allowedMethods('ANTICIPO')).toEqual(['EFECTIVO', 'QR']);
    expect(allowedMethods('SALDO')).toEqual(['EFECTIVO', 'QR']);
  });
});
