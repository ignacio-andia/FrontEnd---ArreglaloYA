/** Bolivia no usa horario de verano: America/La_Paz es siempre UTC-4. */
const LA_PAZ_OFFSET = '-04:00';

/** `true` si el texto es una fecha `AAAA-MM-DD` que existe. */
export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Primer y último instante de un día de Bolivia, en ISO 8601 con su desfase. */
export function dayBounds(day: string): { start: string; end: string } {
  return {
    start: `${day}T00:00:00.000${LA_PAZ_OFFSET}`,
    end: `${day}T23:59:59.999${LA_PAZ_OFFSET}`,
  };
}
