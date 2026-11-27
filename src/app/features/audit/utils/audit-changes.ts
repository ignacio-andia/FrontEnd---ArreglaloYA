export interface AuditChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

const labels: Record<string, string> = {
  name: 'Nombre', description: 'Descripción', isActive: 'Activo',
  status: 'Estado', firstName: 'Nombre', lastName: 'Apellido',
  phone: 'Teléfono', roles: 'Roles', zoneId: 'Zona',
};

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function display(value: unknown): string {
  if (value === undefined) return 'No registrado';
  if (value === null) return 'Sin valor';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return value.map(display).join(', ') || 'Ninguno';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Compatible con los registros históricos que guardan cambios de estado
// y con los nuevos registros que guardan los objetos before y after.
export function auditChanges(details: Readonly<Record<string, unknown>> | null): AuditChange[] {
  if (!details) return [];
  const before = object(details['before']);
  const after = object(details['after']);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const changes = fields.map((field) => ({
    field, label: labels[field] ?? field,
    before: details['before'] === null ? 'No existía' : display(before[field]),
    after: display(after[field]),
  }));
  if (!fields.includes('status')) {
    const previous = details['fromStatus'] ?? details['from'];
    const next = details['toStatus'] ?? details['to'];
    if (next !== undefined) changes.push({ field: 'status', label: 'Estado', before: display(previous), after: display(next) });
  }
  if (!fields.includes('zoneId') && details['toZoneId'] !== undefined) {
    changes.push({ field: 'zoneId', label: 'Zona (ID)', before: display(details['fromZoneId']), after: display(details['toZoneId']) });
  }
  return changes;
}
