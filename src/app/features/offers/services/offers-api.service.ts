import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { EMPTY, Observable, expand, last, map } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { PaginatedResponse } from '../../../core/models/pagination.model';
import {
  CreateOfferRequest,
  Offer,
  OfferDetail,
  OffersQuery,
  ReceivedOffer,
  WhatsAppContact,
} from '../models/offer.model';

/** Máximo de `limit` que admite el backend. */
const MAX_PAGE_SIZE = 50;

/**
 * Ofertas y negociación (`/api/offers`). `me` son las del trabajador y `received` las de los
 * pedidos del cliente; una oferta ajena responde 404. Quién puede actuar, el turno, las rondas y
 * la vigencia los valida el backend (409 si ya no corresponde).
 */
@Service()
export class OffersApiService {
  private readonly http = inject(HttpClient);

  /** `POST /offers/orders/:orderId` (201, trabajador aprobado). */
  create(orderId: string, request: CreateOfferRequest): Observable<OfferDetail> {
    const body: CreateOfferRequest = {
      amount: request.amount,
      requiresVisit: request.requiresVisit,
      materialsIncluded: request.materialsIncluded,
      proposedStartAt: request.proposedStartAt,
      estimatedDurationMinutes: request.estimatedDurationMinutes,
    };
    if (request.requiresVisit && request.visitCost !== undefined) {
      body.visitCost = request.visitCost;
    }
    return this.http.post<OfferDetail>(apiUrl('offers', 'orders', orderId), body);
  }

  /** `GET /offers/me`: ofertas propias del trabajador. */
  listOwn(query: OffersQuery = {}): Observable<PaginatedResponse<Offer>> {
    return this.http.get<PaginatedResponse<Offer>>(apiUrl('offers', 'me'), {
      params: toParams({ status: query.status, page: query.page, limit: query.limit }),
    });
  }

  /**
   * La oferta más reciente del trabajador en un pedido, o `null` si no tiene ninguna.
   * `GET /offers/me` no filtra por pedido: se recorren sus páginas (de la más reciente a la más
   * antigua) hasta encontrarla o llegar a ofertas anteriores a la publicación del pedido, que ya
   * no pueden ser suyas (`publishedAt` no se reinicia nunca).
   */
  findOwnForOrder(orderId: string, publishedAt: string): Observable<Offer | null> {
    const page = (number: number) => this.listOwn({ page: number, limit: MAX_PAGE_SIZE });
    const published = Date.parse(publishedAt);
    return page(1).pipe(
      expand(({ data, meta }) => {
        const oldest = data.at(-1);
        const finished =
          oldest === undefined ||
          meta.page >= meta.totalPages ||
          Date.parse(oldest.createdAt) < published ||
          data.some((offer) => offer.orderId === orderId);
        return finished ? EMPTY : page(meta.page + 1);
      }),
      last(),
      map(({ data }) => data.find((offer) => offer.orderId === orderId) ?? null),
    );
  }

  getOwn(offerId: string): Observable<OfferDetail> {
    return this.http.get<OfferDetail>(apiUrl('offers', 'me', offerId));
  }

  /** `GET /offers/received`: ofertas de los pedidos propios, opcionalmente de uno solo. */
  listReceived(query: OffersQuery = {}): Observable<PaginatedResponse<ReceivedOffer>> {
    return this.http.get<PaginatedResponse<ReceivedOffer>>(apiUrl('offers', 'received'), {
      params: toParams({
        orderId: query.orderId,
        status: query.status,
        page: query.page,
        limit: query.limit,
      }),
    });
  }

  getReceived(offerId: string): Observable<OfferDetail<ReceivedOffer>> {
    return this.http.get<OfferDetail<ReceivedOffer>>(apiUrl('offers', 'received', offerId));
  }

  /** `POST /offers/:offerId/counter`: solo cambia el monto. La usa quien tiene el turno. */
  counter(offerId: string, amount: string): Observable<OfferDetail> {
    return this.http.post<OfferDetail>(apiUrl('offers', offerId, 'counter'), { amount });
  }

  /** `POST /offers/:offerId/accept` (cliente, en su turno): asigna al trabajador. */
  accept(offerId: string): Observable<OfferDetail<ReceivedOffer>> {
    return this.http.post<OfferDetail<ReceivedOffer>>(apiUrl('offers', offerId, 'accept'), null);
  }

  /** `POST /offers/:offerId/reject` (cliente, en su turno). */
  reject(offerId: string): Observable<OfferDetail<ReceivedOffer>> {
    return this.http.post<OfferDetail<ReceivedOffer>>(apiUrl('offers', offerId, 'reject'), null);
  }

  /** `POST /offers/:offerId/withdraw` (trabajador, en cualquier turno). */
  withdraw(offerId: string): Observable<OfferDetail> {
    return this.http.post<OfferDetail>(apiUrl('offers', offerId, 'withdraw'), null);
  }

  /** `GET /offers/received/:offerId/whatsapp`: contacto del trabajador, para el cliente. */
  getWorkerContact(offerId: string): Observable<WhatsAppContact> {
    return this.http.get<WhatsAppContact>(apiUrl('offers', 'received', offerId, 'whatsapp'));
  }

  /** `GET /offers/me/:offerId/whatsapp`: contacto del cliente, para el trabajador. */
  getClientContact(offerId: string): Observable<WhatsAppContact> {
    return this.http.get<WhatsAppContact>(apiUrl('offers', 'me', offerId, 'whatsapp'));
  }
}

/** Solo los parámetros definidos (`forbidNonWhitelisted`). */
function toParams(values: Record<string, string | number | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      params = params.set(key, value);
    }
  }
  return params;
}
