import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import {
  CatalogItem,
  CatalogKind,
  CreateCatalogItemRequest,
  UpdateCatalogItemRequest,
} from '../models/catalog-admin.model';

/** Administración de categorías y zonas (`/api/catalogs`), solo para administradores. */
@Service()
export class CatalogsAdminApiService {
  private readonly http = inject(HttpClient);

  /** `GET /catalogs/admin/{kind}`: sin filtro devuelve activos e inactivos. */
  list(kind: CatalogKind, isActive?: boolean): Observable<CatalogItem[]> {
    let params = new HttpParams();
    if (isActive !== undefined) {
      params = params.set('isActive', isActive);
    }
    return this.http.get<CatalogItem[]>(apiUrl('catalogs', 'admin', kind), { params });
  }

  /** `POST /catalogs/{kind}` (201). 409 si el nombre ya existe, también entre los inactivos. */
  create(kind: CatalogKind, request: CreateCatalogItemRequest): Observable<CatalogItem> {
    const body: CreateCatalogItemRequest = { name: request.name };
    if (request.description !== undefined) {
      body.description = request.description;
    }
    return this.http.post<CatalogItem>(apiUrl('catalogs', kind), body);
  }

  /** `PATCH /catalogs/{kind}/:id`: nombre y descripción. 409 nombre duplicado. */
  update(
    kind: CatalogKind,
    id: string,
    request: UpdateCatalogItemRequest,
  ): Observable<CatalogItem> {
    const body: UpdateCatalogItemRequest = {};
    if (request.name !== undefined) {
      body.name = request.name;
    }
    if (request.description !== undefined) {
      body.description = request.description;
    }
    return this.http.patch<CatalogItem>(apiUrl('catalogs', kind, id), body);
  }

  /** `PATCH /catalogs/{kind}/:id/deactivate`, sin cuerpo. No existe la reactivación. */
  deactivate(kind: CatalogKind, id: string): Observable<CatalogItem> {
    return this.http.patch<CatalogItem>(apiUrl('catalogs', kind, id, 'deactivate'), null);
  }
}
