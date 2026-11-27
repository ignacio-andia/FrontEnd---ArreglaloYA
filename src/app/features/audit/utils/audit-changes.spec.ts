import { describe, expect, it } from 'vitest';
import { auditChanges } from './audit-changes';

describe('auditChanges', () => {
  it('muestra booleanos verdaderos y falsos', () => {
    expect(auditChanges({ before: { isActive: true }, after: { isActive: false } }))
      .toEqual([{ field: 'isActive', label: 'Activo', before: 'Sí', after: 'No' }]);
  });
  it('interpreta una creacion sin valor anterior', () => {
    expect(auditChanges({ before: null, after: { name: 'Pintura' } })[0]?.before).toBe('No existía');
  });
  it('respeta el formato historico de cambios de estado', () => {
    expect(auditChanges({ fromStatus: 'ACTIVO', toStatus: 'SUSPENDIDO' })[0]?.after).toBe('SUSPENDIDO');
  });
  it('no inventa datos ausentes', () => {
    expect(auditChanges(null)).toEqual([]);
    expect(auditChanges({ name: 'Pintura' })).toEqual([]);
  });
});
