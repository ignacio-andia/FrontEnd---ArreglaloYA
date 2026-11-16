/** Tipos de documento: literales exactos del enum `WorkerDocumentType` del backend. */
export const WORKER_DOCUMENT_TYPES = [
  'IDENTIDAD',
  'ANTECEDENTES',
  'CERTIFICADO',
  'REFERENCIA',
] as const;

export type WorkerDocumentType = (typeof WORKER_DOCUMENT_TYPES)[number];

export function isWorkerDocumentType(value: string): value is WorkerDocumentType {
  return (WORKER_DOCUMENT_TYPES as readonly string[]).includes(value);
}

/**
 * Texto visible de cada tipo (RF-07: identidad, antecedentes, certificados o referencias).
 * Ninguno es obligatorio: la obligatoriedad está pendiente de confirmación del docente.
 */
export const WORKER_DOCUMENT_TYPE_LABELS: Readonly<Record<WorkerDocumentType, string>> = {
  IDENTIDAD: 'Identidad',
  ANTECEDENTES: 'Antecedentes',
  CERTIFICADO: 'Certificado',
  REFERENCIA: 'Referencia',
};

/**
 * Documento registrado (`WorkerDocumentView`). El listado incluye los vigentes y los
 * reemplazados: `replacedById === null` indica la versión vigente. No expone rutas ni claves
 * de almacenamiento.
 */
export interface WorkerDocument {
  id: string;
  type: WorkerDocumentType;
  originalName: string;
  /** `application/pdf`, `image/jpeg` o `image/png`, detectado por el contenido. */
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  replacedAt: string | null;
  replacedById: string | null;
}

/**
 * Formatos aceptados por el backend (detectados por la firma de bytes del contenido).
 * El cliente solo puede comprobar la extensión y el tipo informado por el navegador.
 */
export const DOCUMENT_FORMATS = [
  { label: 'PDF', mimeType: 'application/pdf', extensions: ['pdf'] },
  { label: 'JPG', mimeType: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  { label: 'PNG', mimeType: 'image/png', extensions: ['png'] },
] as const;

/**
 * Tamaño máximo por archivo: 5 MB (`WORKER_DOCUMENT_MAX_MB` del backend; su `.env` no lo
 * redefine). Si el backend cambia la configuración, responde 413 con el límite vigente.
 */
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
