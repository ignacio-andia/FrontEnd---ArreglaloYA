import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { CatalogOption } from '../models/catalog.model';

/**
 * Consulta pública de catálogos (`/api/catalogs`), sin autenticación.
 * Solo devuelve elementos activos, ordenados por nombre. La administración de catálogos
 * (`/api/catalogs/admin/*` y escrituras) no forma parte de este servicio.
 */
@Service()
export class CatalogsApiService {
  private readonly http = inject(HttpClient);

  /** `GET /catalogs/categories`: categorías de servicio activas. */
  getCategories(): Observable<CatalogOption[]> {
    return this.http.get<CatalogOption[]>(apiUrl('catalogs', 'categories'));
  }

  /** `GET /catalogs/categories/:id`: 404 si no existe o está inactiva; 400 si el id no es UUID. */
  getCategory(id: string): Observable<CatalogOption> {
    return this.http.get<CatalogOption>(apiUrl('catalogs', 'categories', id));
  }

  /** `GET /catalogs/zones`: zonas activas. */
  getZones(): Observable<CatalogOption[]> {
    return this.http.get<CatalogOption[]>(apiUrl('catalogs', 'zones'));
  }

  /** `GET /catalogs/zones/:id`: 404 si no existe o está inactiva; 400 si el id no es UUID. */
  getZone(id: string): Observable<CatalogOption> {
    return this.http.get<CatalogOption>(apiUrl('catalogs', 'zones', id));
  }
}
