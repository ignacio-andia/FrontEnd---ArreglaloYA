import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { ImageVariant } from '../../../shared/components/private-image/private-image.component';
import { PaginatedResponse } from '../../../core/models/pagination.model';
import {
  Claim,
  ClaimAssignee,
  ClaimParty,
  ClaimSummary,
  ClaimsQuery,
  CreateClaimRequest,
  DecideClaimRequest,
  UpdateClaimAssignmentRequest,
} from '../models/claim.model';

/** Reclamos de un pedido. Un pedido ajeno responde 404. */
@Service()
export class ClaimsApiService {
  private readonly http = inject(HttpClient);

  /**
   * `POST /orders/:orderId/claims` (201): cliente dueño. Se envía como `multipart/form-data`; el
   * navegador fija el `Content-Type` con su separador.
   */
  create(orderId: string, request: CreateClaimRequest): Observable<Claim> {
    const form = new FormData();
    form.append('description', request.description);
    for (const image of request.images) {
      form.append('images', image, image.name);
    }
    return this.http.post<Claim>(apiUrl('orders', orderId, 'claims'), form);
  }

  /**
   * `GET /orders/:orderId/claim`: el cliente recibe el reclamo completo y el trabajador asignado
   * solo estado y decisión. 404 si el pedido no tiene reclamo.
   */
  getForOrder(orderId: string): Observable<Claim | ClaimParty> {
    return this.http.get<Claim | ClaimParty>(apiUrl('orders', orderId, 'claim'));
  }

  /**
   * `GET /admin/claims`: solo administradores. El backend ordena por prioridad, fecha límite y
   * antigüedad. Solo se envían los filtros con valor.
   */
  list(query: ClaimsQuery): Observable<PaginatedResponse<ClaimSummary>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value);
      }
    }
    return this.http.get<PaginatedResponse<ClaimSummary>>(apiUrl('admin', 'claims'), { params });
  }

  /** `GET /admin/claims/assignees`: administradores activos que pueden ser responsables. */
  listAssignees(): Observable<ClaimAssignee[]> {
    return this.http.get<ClaimAssignee[]>(apiUrl('admin', 'claims', 'assignees'));
  }

  /** `PATCH /admin/claims/:claimId/assignment`: prioridad, responsable y fecha límite. */
  updateAssignment(claimId: string, request: UpdateClaimAssignmentRequest): Observable<Claim> {
    return this.http.patch<Claim>(apiUrl('admin', 'claims', claimId, 'assignment'), request);
  }

  /** `GET /admin/claims/:claimId`: solo administradores. */
  get(claimId: string): Observable<Claim> {
    return this.http.get<Claim>(apiUrl('admin', 'claims', claimId));
  }

  /** `POST /admin/claims/:claimId/review`, sin cuerpo: `ABIERTO` → `EN_REVISION`. */
  markInReview(claimId: string): Observable<Claim> {
    return this.http.post<Claim>(apiUrl('admin', 'claims', claimId, 'review'), null);
  }

  /** `POST /admin/claims/:claimId/decision`: resuelve el reclamo y cierra el pedido. */
  decide(claimId: string, { decision, justification }: DecideClaimRequest): Observable<Claim> {
    return this.http.post<Claim>(apiUrl('admin', 'claims', claimId, 'decision'), {
      decision,
      justification,
    });
  }

  /** `GET /claims/:claimId/images/:imageId`: cliente que reclamó o administrador. */
  getImage(claimId: string, imageId: string, variant: ImageVariant): Observable<Blob> {
    return this.http.get(apiUrl('claims', claimId, 'images', imageId), {
      params: new HttpParams().set('variant', variant),
      responseType: 'blob',
    });
  }
}
