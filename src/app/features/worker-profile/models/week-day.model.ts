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
