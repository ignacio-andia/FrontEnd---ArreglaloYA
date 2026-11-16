import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { WorkerDocument, WorkerDocumentType } from '../models/worker-document.model';

/**
 * Documentos de respaldo del trabajador (`/api/worker-profile/me/documents`).
 * Un archivo por petición, en `multipart/form-data`. No se fija `Content-Type`: el navegador
 * agrega el `boundary`. No existe endpoint para eliminar documentos.
 */
@Service()
export class WorkerDocumentsApiService {
  private readonly http = inject(HttpClient);

  /** `GET /worker-profile/me/documents`: vigentes y reemplazados, por tipo y fecha. */
  list(): Observable<WorkerDocument[]> {
    return this.http.get<WorkerDocument[]>(apiUrl('worker-profile', 'me', 'documents'));
  }

  /**
   * `POST /worker-profile/me/documents` con los campos `type` y `file` (201).
   * 409 si el perfil no está en BORRADOR u OBSERVADO; 400 formato; 413 tamaño.
   */
  upload(type: WorkerDocumentType, file: File): Observable<WorkerDocument> {
    const form = new FormData();
    form.append('type', type);
    form.append('file', file, file.name);
    return this.http.post<WorkerDocument>(apiUrl('worker-profile', 'me', 'documents'), form);
  }

  /**
   * `POST /worker-profile/me/documents/:documentId/replace` con el campo `file` (201).
   * Crea una versión nueva del mismo tipo; la anterior queda en el historial como reemplazada.
   * 409 si el documento ya fue reemplazado o el perfil no es editable.
   */
  replace(documentId: string, file: File): Observable<WorkerDocument> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<WorkerDocument>(
      apiUrl('worker-profile', 'me', 'documents', documentId, 'replace'),
      form,
    );
  }

  /** `GET /worker-profile/me/documents/:documentId/download` como Blob (con el token Bearer). */
  download(documentId: string): Observable<Blob> {
    return this.http.get(apiUrl('worker-profile', 'me', 'documents', documentId, 'download'), {
      responseType: 'blob',
    });
  }
}
