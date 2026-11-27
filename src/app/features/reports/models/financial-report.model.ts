import { OrderStatus } from '../../orders/models/order.model';
import { ReportCell } from './report.model';

/**
 * Estados que puede tener un pedido después del acuerdo: son los únicos que el reporte
 * financiero puede devolver. Literales exactos de `OrderStatus`.
 */
export const FINANCIAL_STATUS_OPTIONS: readonly OrderStatus[] = [
  'ACORDADO',
  'ANTICIPO_REGISTRADO',
  'VISITA_REALIZADA',
  'PRESUPUESTO_ADICIONAL_PENDIENTE',
  'EN_EJECUCION',
  'TERMINADO',
  'EN_RECLAMO',
  'CERRADO',
  'CANCELADO',
];

/** Columnas de `GET /admin/reports/financiero`, en el orden en que llegan. */
export const FINANCIAL_COLUMN_LABELS: Readonly<Record<string, string>> = {
  pedido: 'Pedido',
  fecha_acuerdo: 'Fecha del acuerdo',
  categoria: 'Categoría',
  zona: 'Zona',
  estado: 'Estado',
  monto_oferta: 'Oferta aceptada',
  adicionales_aceptados: 'Adicionales aceptados',
  costo_visita: 'Visita',
  total_esperado: 'Total esperado',
  ingresos_confirmados: 'Ingresos confirmados',
  pendiente: 'Pendiente',
  comision: 'Comisión',
};

/** Columnas con montos en bolivianos (texto decimal del backend). */
export const FINANCIAL_MONEY_COLUMNS: readonly string[] = [
  'monto_oferta',
  'adicionales_aceptados',
  'costo_visita',
  'total_esperado',
  'ingresos_confirmados',
  'pendiente',
  'comision',
];

/** Totales del reporte, con montos como texto decimal (`"150.50"`). */
export interface FinancialTotals {
  orders: number;
  expected: string;
  income: string;
  pending: string;
  commission: string;
}

/** Respuesta en JSON de `GET /admin/reports/financiero` (`FinancialReport`). */
export interface FinancialReport {
  report: 'financiero';
  from: string;
  to: string;
  /** Qué fecha de cada pedido decide si entra en el rango. */
  basis: string;
  /** Estados filtrados; vacío equivale a todos. */
  statuses: OrderStatus[];
  /** Porcentaje de comisión aplicado, con 2 decimales (`"15.00"`). */
  commissionPercent: string;
  /** Aviso de pago directo y de comisión informativa que redacta el backend. */
  notice: string;
  columns: string[];
  rows: ReportCell[][];
  totals: FinancialTotals;
  /** Aviso cuando no hay pedidos en el rango. */
  message: string | null;
}

/** Rango de días de Bolivia (`AAAA-MM-DD`, ambos incluidos) y estados actuales. */
export interface FinancialReportRequest {
  from: string;
  to: string;
  statuses: readonly OrderStatus[];
}
