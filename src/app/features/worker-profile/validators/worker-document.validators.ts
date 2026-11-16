import {
  DOCUMENT_FORMATS,
  DOCUMENT_MAX_BYTES,
  WorkerDocument,
} from '../models/worker-document.model';
import { formatFileSize } from '../../../shared/pipes/file-size.pipe';

/** Valor del atributo `accept` del selector de archivos (PDF, JPG y PNG). */
export const DOCUMENT_ACCEPT = DOCUMENT_FORMATS.flatMap((format) => [
  format.mimeType,
  ...format.extensions.map((extension) => `.${extension}`),
]).join(',');

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/**
 * Validación previa en el cliente (formato por extensión y tipo informado, tamaño máximo).
 * Devuelve el motivo del rechazo, o `null` si el archivo puede enviarse. El backend vuelve a
 * validar por el contenido real del archivo.
 */
export function documentFileProblem(file: File): string | null {
  if (file.size === 0) {
    return 'El archivo está vacío.';
  }

  const extension = extensionOf(file.name);
  const formatByExtension = DOCUMENT_FORMATS.find((format) =>
    (format.extensions as readonly string[]).includes(extension),
  );
  const typeAllowed =
    file.type === '' || DOCUMENT_FORMATS.some((format) => format.mimeType === file.type);
  if (!formatByExtension || !typeAllowed) {
    return 'Formato no permitido. Formatos aceptados: PDF, JPG y PNG.';
  }

  if (file.size > DOCUMENT_MAX_BYTES) {
    return `El archivo supera el tamaño máximo de ${formatFileSize(DOCUMENT_MAX_BYTES)}.`;
  }
  return null;
}

/** Formato visible (PDF, JPG o PNG) de un archivo local o de un documento registrado. */
export function documentFormatLabel(source: File | WorkerDocument): string {
  const mimeType = source instanceof File ? source.type : source.mimeType;
  const byType = DOCUMENT_FORMATS.find((format) => format.mimeType === mimeType);
  if (byType) {
    return byType.label;
  }
  const name = source instanceof File ? source.name : source.originalName;
  const extension = extensionOf(name);
  const byExtension = DOCUMENT_FORMATS.find((format) =>
    (format.extensions as readonly string[]).includes(extension),
  );
  return byExtension?.label ?? (extension.toUpperCase() || 'Desconocido');
}
