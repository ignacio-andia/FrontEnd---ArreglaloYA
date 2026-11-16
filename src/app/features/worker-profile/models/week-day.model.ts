/** Días de la semana: literales exactos del enum `WeekDay` del backend. */
export const WEEK_DAYS = [
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
  'DOMINGO',
] as const;

export type WeekDay = (typeof WEEK_DAYS)[number];

export function isWeekDay(value: string): value is WeekDay {
  return (WEEK_DAYS as readonly string[]).includes(value);
}

/** Texto visible de cada día; el valor enviado sigue siendo el literal sin tildes. */
export const WEEK_DAY_LABELS: Readonly<Record<WeekDay, string>> = {
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SABADO: 'Sábado',
  DOMINGO: 'Domingo',
};
