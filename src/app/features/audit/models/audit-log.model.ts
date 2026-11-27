import { PageQuery } from '../../../core/models/pagination.model';

/** Literales exactos del enum `AuditAction` del backend. */
export const AUDIT_ACTIONS = [
  'CREACION',
  'EDICION',
  'DESACTIVACION',
  'CAMBIO_ESTADO',
  'APROBACION',
  'RECHAZO',
  'CONSULTA_DOCUMENTOS',
  'VISUALIZACION_DOCUMENTO',
  'DESCARGA_DOCUMENTO',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Readonly<Record<AuditAction, string>> = {
  CREACION: 'Creación',
  EDICION: 'Edición',
  DESACTIVACION: 'Desactivación',
  CAMBIO_ESTADO: 'Cambio de estado',
  APROBACION: 'Aprobación',
  RECHAZO: 'Rechazo',
  CONSULTA_DOCUMENTOS: 'Consulta de documentos',
  VISUALIZACION_DOCUMENTO: 'Vista de un documento',
  DESCARGA_DOCUMENTO: 'Descarga de un documento',
};

/** Literales exactos del enum `AuditEntityType` del backend. */
export const AUDIT_ENTITY_TYPES = [
  'CATEGORIA_SERVICIO',
  'ZONA',
  'PERFIL_TRABAJADOR',
  'SOLICITUD_CAMBIO_ZONA',
  'RECLAMO',
  'USUARIO',
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ENTITY_LABELS: Readonly<Record<AuditEntityType, string>> = {
  CATEGORIA_SERVICIO: 'Categoría',
  ZONA: 'Zona',
  PERFIL_TRABAJADOR: 'Perfil de trabajador',
  SOLICITUD_CAMBIO_ZONA: 'Solicitud de cambio de zona',
  RECLAMO: 'Reclamo',
  USUARIO: 'Cuenta',
};

/** Entrada de `GET /audit-logs` (`AuditLog`). La forma de `details` depende de la acción. */
export interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  details: Readonly<Record<string, unknown>> | null;
  createdAt: string;
  actor: { id: string; firstName: string; lastName: string; email: string };
}

export interface AuditLogsQuery extends PageQuery {
  actorSearch?: string;
  entityType?: AuditEntityType;
  action?: AuditAction;
  /** ISO 8601, inclusivo. */
  from?: string;
  to?: string;
}
