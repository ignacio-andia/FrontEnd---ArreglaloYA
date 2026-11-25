import { CLAIM_STATUS_LABELS } from '../../claims/models/claim.model';
import { ORDER_STATUS_LABELS } from '../../orders/models/order.model';
import { WORKER_PROFILE_STATUS_LABELS } from '../../worker-profile/models/worker-profile-status.model';
import { Report, ReportCell, ReportType } from '../models/report.model';

const COLUMN_LABELS: Readonly<Record<string, string>> = {
  categoria: 'Categoría',
  zona: 'Zona',
  estado: 'Estado',
  estado_anterior: 'Estado anterior',
  autor: 'Autor',
  estrellas: 'Estrellas',
  visible: 'Visible',
  total: 'Total',
};

/** Los estados tienen nombres distintos según qué se esté contando. */
const STATUS_LABELS: Readonly<Record<ReportType, Readonly<Record<string, string>>>> = {
  pedidos: ORDER_STATUS_LABELS,
  cancelaciones: ORDER_STATUS_LABELS,
  trabajadores: WORKER_PROFILE_STATUS_LABELS,
  reclamos: CLAIM_STATUS_LABELS,
  calificaciones: {},
};

const VALUE_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  autor: { CLIENTE: 'Cliente', TRABAJADOR: 'Trabajador' },
  visible: { si: 'Sí', no: 'No' },
};

export interface ReportTable {
  columns: string[];
  rows: ReportCell[][];
}

/** Traduce columnas y literales para mostrarlos; las cifras quedan como las envía el backend. */
export function reportTable({ report, columns, rows }: Report): ReportTable {
  return {
    columns: columns.map((column) => COLUMN_LABELS[column] ?? column),
    rows: rows.map((row) =>
      row.map((cell, index) => {
        if (typeof cell === 'number') {
          return cell;
        }
        const column = columns[index];
        const labels = column.startsWith('estado') ? STATUS_LABELS[report] : VALUE_LABELS[column];
        return labels?.[cell] ?? cell;
      }),
    ),
  };
}
