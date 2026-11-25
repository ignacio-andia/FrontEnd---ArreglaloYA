import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { PaginatedResponse } from '../../../core/models/pagination.model';
import {
  PublicOpinion,
  PublicWorkerProfile,
  WorkerSearchPage,
  WorkerSearchQuery,
} from '../models/public-worker.model';

/** Máximo de `limit` en las opiniones. */
export const OPINIONS_MAX_LIMIT = 50;

/** Búsqueda y perfiles públicos de trabajadores aprobados (`/api/workers`). */
@Service()
export class WorkersApiService {
  private readonly http = inject(HttpClient);

  /** `GET /workers/search` (rol CLIENTE). 404 si la categoría o la zona no existen. */
  search({ categoryId, zoneId, page, limit }: WorkerSearchQuery): Observable<WorkerSearchPage> {
    let params = new HttpParams().set('categoryId', categoryId).set('zoneId', zoneId);
    if (page !== undefined) {
      params = params.set('page', page);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<WorkerSearchPage>(apiUrl('workers', 'search'), { params });
  }

  /** `GET /workers/:workerId/public-profile` (público). 404 si no es un trabajador aprobado. */
  getPublicProfile(workerId: string): Observable<PublicWorkerProfile> {
    return this.http.get<PublicWorkerProfile>(apiUrl('workers', workerId, 'public-profile'));
  }

  /** `GET /workers/:workerId/reviews` (público): opiniones más recientes primero. */
  getOpinions(workerId: string): Observable<PaginatedResponse<PublicOpinion>> {
    return this.http.get<PaginatedResponse<PublicOpinion>>(apiUrl('workers', workerId, 'reviews'), {
      params: new HttpParams().set('limit', OPINIONS_MAX_LIMIT),
    });
  }
}
