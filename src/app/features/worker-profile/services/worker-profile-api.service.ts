import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { WorkerEligibility } from '../models/worker-profile.model';

/**
 * Servicio API del perfil de trabajador (`/api/worker-profile`).
 * Por ahora solo expone la consulta de elegibilidad que necesita approvedWorkerGuard;
 * el resto de operaciones se añadirá con la feature.
 */
@Service()
export class WorkerProfileApiService {
  private readonly http = inject(HttpClient);

  /** `GET /worker-profile/me/eligibility` (rol TRABAJADOR). Nunca responde 404. */
  getEligibility(): Observable<WorkerEligibility> {
    return this.http.get<WorkerEligibility>(apiUrl('worker-profile', 'me', 'eligibility'));
  }
}
