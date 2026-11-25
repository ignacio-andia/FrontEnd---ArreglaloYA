/** Tipos de reporte que acepta `GET /admin/reports/:type`. */
export const REPORT_TYPES = [
  'pedidos',
  'trabajadores',
  'calificaciones',
  'cancelaciones',
  'reclamos',
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Readonly<Record<ReportType, string>> = {
  pedidos: 'Pedidos',
  trabajadores: 'Trabajadores',
  calificaciones: 'Calificaciones',
  cancelaciones: 'Cancelaciones',
  reclamos: 'Reclamos',
};

export type ReportCell = string | number;

/** Respuesta en JSON (`Report`). La última columna de cada fila es `total`. */
export interface Report {
  report: ReportType;
  from: string;
  to: string;
  /** Qué fecha de cada registro decide si entra en el rango. */
  basis: string;
  columns: string[];
  rows: ReportCell[][];
  total: number;
  /** Aviso cuando no hay datos en el rango. */
  message: string | null;
}

/** Rango de días de Bolivia (`AAAA-MM-DD`), ambos incluidos. */
export interface ReportRequest {
  type: ReportType;
  from: string;
  to: string;
}
