import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import {
  CreateWorkerProfileRequest,
  WorkerEligibility,
  WorkerProfile,
} from '../models/worker-profile.model';

/**
 * Servicio API del perfil de trabajador (`/api/worker-profile`).
 * Horarios, documentos, envío a revisión y cambios de zona se añadirán en sus tareas.
 */
@Service()
export class WorkerProfileApiService {
  private readonly http = inject(HttpClient);

  /**
   * `POST /worker-profile` (rol CLIENTE o TRABAJADOR, cuenta ACTIVO). Crea el perfil en BORRADOR
   * y otorga el rol TRABAJADOR a la cuenta; la respuesta no incluye los roles actualizados.
   * Envía solo las propiedades del DTO (el backend rechaza cualquier otra).
   */
  createProfile(request: CreateWorkerProfileRequest): Observable<WorkerProfile> {
    const body: CreateWorkerProfileRequest = {
      yearsOfExperience: request.yearsOfExperience,
      zoneId: request.zoneId,
      categoryIds: [...request.categoryIds],
    };
    if (request.description !== undefined) {
      body.description = request.description;
    }

    return this.http.post<WorkerProfile>(apiUrl('worker-profile'), body);
  }

  /** `GET /worker-profile/me` (rol TRABAJADOR). 404 si la cuenta aún no tiene perfil. */
  getOwnProfile(): Observable<WorkerProfile> {
    return this.http.get<WorkerProfile>(apiUrl('worker-profile', 'me'));
  }

  /** `GET /worker-profile/me/eligibility` (rol TRABAJADOR). Nunca responde 404. */
  getEligibility(): Observable<WorkerEligibility> {
    return this.http.get<WorkerEligibility>(apiUrl('worker-profile', 'me', 'eligibility'));
  }
}
