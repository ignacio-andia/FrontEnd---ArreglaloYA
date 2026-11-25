import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { PaginatedResponse } from '../../../core/models/pagination.model';
import { AuditLog, AuditLogsQuery } from '../models/audit-log.model';

/** Bitácora (`GET /audit-logs`): solo lectura y solo para administradores. */
@Service()
export class AuditApiService {
  private readonly http = inject(HttpClient);

  /** Las acciones más recientes primero. 400 si la fecha inicial es posterior a la final. */
  list(query: AuditLogsQuery): Observable<PaginatedResponse<AuditLog>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params = params.set(key, value);
      }
    }
    return this.http.get<PaginatedResponse<AuditLog>>(apiUrl('audit-logs'), { params });
  }
}
