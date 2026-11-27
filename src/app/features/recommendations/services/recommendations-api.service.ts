import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import {
  RecommendationSettingsOverview,
  UpdateRecommendationSettingsRequest,
  WorkerRecommendation,
} from '../models/recommendation.model';

/**
 * Recomendación de trabajadores. El cliente la genera y consulta para sus pedidos
 * (`/api/orders/:orderId/recommendations`); el administrador define los criterios
 * (`/api/admin/recommendation-settings`).
 */
@Service()
export class RecommendationsApiService {
  private readonly http = inject(HttpClient);

  /** `POST`: genera y guarda una recomendación. 409 si el pedido ya no está publicado ni en negociación. */
  generate(orderId: string): Observable<WorkerRecommendation> {
    return this.http.post<WorkerRecommendation>(this.forOrder(orderId), {});
  }

  /** `GET`: recomendaciones guardadas del pedido, de la más reciente a la más antigua (hasta 10). */
  list(orderId: string): Observable<WorkerRecommendation[]> {
    return this.http.get<WorkerRecommendation[]>(this.forOrder(orderId));
  }

  /** `GET`: versión vigente de los criterios e historial de versiones. */
  getSettings(): Observable<RecommendationSettingsOverview> {
    return this.http.get<RecommendationSettingsOverview>(this.settingsUrl());
  }

  /** `PUT`: crea una versión nueva. 400 si los pesos no suman 100; 409 si nada cambió. */
  updateSettings(
    body: UpdateRecommendationSettingsRequest,
  ): Observable<RecommendationSettingsOverview> {
    return this.http.put<RecommendationSettingsOverview>(this.settingsUrl(), {
      reputationWeight: body.reputationWeight,
      completedServicesWeight: body.completedServicesWeight,
      availabilityWeight: body.availabilityWeight,
      reviewsForConfidence: body.reviewsForConfidence,
      completedServicesTarget: body.completedServicesTarget,
      availabilityHoursTarget: body.availabilityHoursTarget,
    });
  }

  private forOrder(orderId: string): string {
    return apiUrl('orders', orderId, 'recommendations');
  }

  private settingsUrl(): string {
    return apiUrl('admin', 'recommendation-settings');
  }
}
