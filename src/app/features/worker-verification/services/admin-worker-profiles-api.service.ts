import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { PaginatedResponse } from '../../../core/models/pagination.model';
import { WorkerDocument } from '../../worker-profile/models/worker-document.model';
import { WorkerProfile } from '../../worker-profile/models/worker-profile.model';
import {
  AdminWorkerProfile,
  AdminWorkerProfileSummary,
  AdminWorkerProfilesQuery,
  ChangeProfileStatusRequest,
} from '../models/admin-worker-profile.model';

/** Revisión de trabajadores (`/api/worker-profile/admin/profiles`), solo para administradores. */
@Service()
export class AdminWorkerProfilesApiService {
  private readonly http = inject(HttpClient);

  /** `GET`: los enviados a revisión hace más tiempo primero. */
  list(query: AdminWorkerProfilesQuery): Observable<PaginatedResponse<AdminWorkerProfileSummary>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params = params.set(key, value);
      }
    }
    return this.http.get<PaginatedResponse<AdminWorkerProfileSummary>>(this.url(), { params });
  }

  /** `GET /:profileId`: 403 sobre el propio perfil; 404 si no existe. */
  get(profileId: string): Observable<AdminWorkerProfile> {
    return this.http.get<AdminWorkerProfile>(this.url(profileId));
  }

  /**
   * `PATCH /:profileId/status`. 409 si la transición no está permitida o no se cumplen los
   * requisitos de aprobación o reactivación.
   */
  changeStatus(profileId: string, request: ChangeProfileStatusRequest): Observable<WorkerProfile> {
    const body: ChangeProfileStatusRequest = { status: request.status };
    if (request.reason !== undefined) {
      body.reason = request.reason;
    }
    return this.http.patch<WorkerProfile>(this.url(profileId, 'status'), body);
  }

  /** `GET /:profileId/documents`: solo metadatos; el backend registra la consulta. */
  getDocuments(profileId: string): Observable<WorkerDocument[]> {
    return this.http.get<WorkerDocument[]>(this.url(profileId, 'documents'));
  }

  /** `GET …/view`: contenido para mostrarlo en pantalla. Queda registrado en la bitácora. */
  viewDocument(profileId: string, documentId: string): Observable<Blob> {
    return this.http.get(this.url(profileId, 'documents', documentId, 'view'), {
      responseType: 'blob',
    });
  }

  /** `GET …/download`: contenido para guardarlo. Queda registrado en la bitácora. */
  downloadDocument(profileId: string, documentId: string): Observable<Blob> {
    return this.http.get(this.url(profileId, 'documents', documentId, 'download'), {
      responseType: 'blob',
    });
  }

  private url(...segments: string[]): string {
    return apiUrl('worker-profile', 'admin', 'profiles', ...segments);
  }
}
