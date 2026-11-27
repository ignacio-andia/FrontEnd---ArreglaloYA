import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, of, switchMap } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { TimelineEvent, TimelinePage, isCancellation } from '../models/timeline.model';

export const TIMELINE_PAGE_SIZE = 20;
/** Máximo que admite el backend: se usa al buscar un acontecimiento. */
const TIMELINE_SEARCH_SIZE = 100;

@Service()
export class TimelineApiService {
  private readonly http = inject(HttpClient);

  /** `GET /orders/:orderId/timeline` (`limit` 1–100; `cursor` de la página anterior). */
  get(orderId: string, cursor?: string, limit = TIMELINE_PAGE_SIZE): Observable<TimelinePage> {
    let params = new HttpParams().set('limit', limit);
    if (cursor !== undefined) {
      params = params.set('cursor', cursor);
    }
    return this.http.get<TimelinePage>(apiUrl('orders', orderId, 'timeline'), { params });
  }

  /** Recorre las páginas desde `cursor` hasta la cancelación; `null` si no está. */
  findCancellation(orderId: string, cursor: string): Observable<TimelineEvent | null> {
    return this.get(orderId, cursor, TIMELINE_SEARCH_SIZE).pipe(
      switchMap((page) => {
        const found = page.data.find(isCancellation) ?? null;
        return found === null && page.nextCursor !== null
          ? this.findCancellation(orderId, page.nextCursor)
          : of(found);
      }),
    );
  }
}
