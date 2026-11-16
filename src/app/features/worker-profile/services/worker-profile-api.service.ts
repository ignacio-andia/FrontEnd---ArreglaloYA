import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import {
  CreateWorkerProfileRequest,
  ScheduleItemRequest,
  UpdateWorkerProfileRequest,
  WorkerEligibility,
  WorkerProfile,
  WorkerStatus,
} from '../models/worker-profile.model';

/**
 * Servicio API del perfil de trabajador (`/api/worker-profile`). Cada método envía solo las
 * propiedades de su DTO: el backend (`forbidNonWhitelisted`) rechaza cualquier otra.
 * Los documentos están en `WorkerDocumentsApiService`; los cambios de zona, en su tarea.
 */
@Service()
export class WorkerProfileApiService {
  private readonly http = inject(HttpClient);

  /**
   * `POST /worker-profile` (rol CLIENTE o TRABAJADOR, cuenta ACTIVO). Crea el perfil en BORRADOR
   * y otorga el rol TRABAJADOR a la cuenta; la respuesta no incluye los roles actualizados.
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
    if (request.schedules !== undefined) {
      body.schedules = request.schedules.map(toScheduleBody);
    }

    return this.http.post<WorkerProfile>(apiUrl('worker-profile'), body);
  }

  /** `GET /worker-profile/me` (rol TRABAJADOR). 404 si la cuenta aún no tiene perfil. */
  getOwnProfile(): Observable<WorkerProfile> {
    return this.http.get<WorkerProfile>(apiUrl('worker-profile', 'me'));
  }

  /**
   * `PATCH /worker-profile/me`: experiencia, descripción y zona (al menos una).
   * 409 fuera de BORRADOR/OBSERVADO; 403 si cambia la zona fuera de BORRADOR.
   */
  updateProfile(request: UpdateWorkerProfileRequest): Observable<WorkerProfile> {
    const body: UpdateWorkerProfileRequest = {};
    if (request.yearsOfExperience !== undefined) {
      body.yearsOfExperience = request.yearsOfExperience;
    }
    if (request.description !== undefined) {
      body.description = request.description;
    }
    if (request.zoneId !== undefined) {
      body.zoneId = request.zoneId;
    }
    return this.http.patch<WorkerProfile>(apiUrl('worker-profile', 'me'), body);
  }

  /** `PUT /worker-profile/me/specialties`: reemplaza el conjunto (1 a 10). 409 si no es editable. */
  replaceSpecialties(categoryIds: readonly string[]): Observable<WorkerProfile> {
    return this.http.put<WorkerProfile>(apiUrl('worker-profile', 'me', 'specialties'), {
      categoryIds: [...categoryIds],
    });
  }

  /** `PUT /worker-profile/me/schedules`: reemplaza todos los horarios; se permite en cualquier estado. */
  replaceSchedules(schedules: readonly ScheduleItemRequest[]): Observable<WorkerProfile> {
    return this.http.put<WorkerProfile>(apiUrl('worker-profile', 'me', 'schedules'), {
      schedules: schedules.map(toScheduleBody),
    });
  }

  /**
   * `POST /worker-profile/me/submit` (sin cuerpo): BORRADOR u OBSERVADO → PENDIENTE.
   * 400 con el arreglo de requisitos faltantes; 409 si el estado no lo permite.
   */
  submitForReview(): Observable<WorkerProfile> {
    return this.http.post<WorkerProfile>(apiUrl('worker-profile', 'me', 'submit'), null);
  }

  /** `GET /worker-profile/me/status`: estado vigente, motivo e historial. */
  getStatus(): Observable<WorkerStatus> {
    return this.http.get<WorkerStatus>(apiUrl('worker-profile', 'me', 'status'));
  }

  /** `GET /worker-profile/me/eligibility` (rol TRABAJADOR). Nunca responde 404. */
  getEligibility(): Observable<WorkerEligibility> {
    return this.http.get<WorkerEligibility>(apiUrl('worker-profile', 'me', 'eligibility'));
  }
}

function toScheduleBody(item: ScheduleItemRequest): ScheduleItemRequest {
  const body: ScheduleItemRequest = {
    dayOfWeek: item.dayOfWeek,
    startTime: item.startTime,
    endTime: item.endTime,
  };
  if (item.isActive !== undefined) {
    body.isActive = item.isActive;
  }
  return body;
}
