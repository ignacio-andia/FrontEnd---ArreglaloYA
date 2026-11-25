import { CLAIM_STATUS_LABELS } from '../../claims/models/claim.model';
import {
  WORKER_DOCUMENT_TYPE_LABELS,
  isWorkerDocumentType,
} from '../../worker-profile/models/worker-document.model';
import { WORKER_PROFILE_STATUS_LABELS } from '../../worker-profile/models/worker-profile-status.model';
import { AuditLog } from '../models/audit-log.model';

/** Estados que aparecen en los detalles: perfiles, reclamos y solicitudes de cambio de zona. */
const STATUS_LABELS: Readonly<Record<string, string>> = {
  ...WORKER_PROFILE_STATUS_LABELS,
  ...CLAIM_STATUS_LABELS,
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
};

const FIELD_LABELS: Readonly<Record<string, string>> = {
  name: 'Nombre',
  description: 'Descripción',
};

const CAUSE_LABELS: Readonly<Record<string, string>> = {
  SUSPENSION_PERFIL: 'suspensión del perfil',
  SUSPENSION_CUENTA: 'suspensión de la cuenta',
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

const record = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const status = (value: unknown): string | null => {
  const literal = text(value);
  return literal === null ? null : (STATUS_LABELS[literal] ?? literal);
};

/**
 * Detalles de una entrada como frases. Solo muestra los datos legibles que documenta el
 * contrato; los identificadores internos se omiten.
 */
export function describeAuditDetails({ details }: Pick<AuditLog, 'details'>): string[] {
  if (details === null) {
    return [];
  }
  const lines: string[] = [];

  const before = record(details['before']);
  for (const [key, value] of Object.entries(record(details['after']))) {
    const label = FIELD_LABELS[key] ?? key;
    lines.push(`${label}: ${text(before[key]) ?? 'sin dato'} → ${text(value) ?? 'sin dato'}`);
  }

  const from = status(details['from'] ?? details['fromStatus']);
  const to = status(details['to'] ?? details['toStatus']);
  if (to !== null) {
    lines.push(from === null ? `Estado: ${to}` : `Estado: ${from} → ${to}`);
  }

  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    const value = text(details[key]);
    if (value !== null) {
      lines.push(`${label}: ${value}`);
    }
  }

  const reason = text(details['reason']) ?? text(details['comment']);
  if (reason !== null) {
    lines.push(`Motivo: ${reason}`);
  }
  const cause = text(details['cause']);
  if (cause !== null) {
    lines.push(`Causa: ${CAUSE_LABELS[cause] ?? cause}`);
  }
  if (typeof details['documentCount'] === 'number') {
    lines.push(`Documentos consultados: ${details['documentCount']}`);
  }
  const documentType = text(details['documentType']);
  if (documentType !== null) {
    const label = isWorkerDocumentType(documentType)
      ? WORKER_DOCUMENT_TYPE_LABELS[documentType]
      : documentType;
    lines.push(`Tipo de documento: ${label}`);
  }
  const orderId = text(details['orderId']);
  if (orderId !== null) {
    lines.push(`Pedido: ${orderId.slice(0, 8)}`);
  }
  return lines;
}
