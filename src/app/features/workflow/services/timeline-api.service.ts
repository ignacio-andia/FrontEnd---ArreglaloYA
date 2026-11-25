import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { TimelinePage } from '../models/timeline.model';

export const TIMELINE_PAGE_SIZE = 20;

@Service()
export class TimelineApiService {
  private readonly http = inject(HttpClient);

  /** `GET /orders/:orderId/timeline` (`limit` 1–100; `cursor` de la página anterior). */
  get(orderId: string, cursor?: string): Observable<TimelinePage> {
    let params = new HttpParams().set('limit', TIMELINE_PAGE_SIZE);
    if (cursor !== undefined) {
      params = params.set('cursor', cursor);
    }
    return this.http.get<TimelinePage>(apiUrl('orders', orderId, 'timeline'), { params });
  }
}
