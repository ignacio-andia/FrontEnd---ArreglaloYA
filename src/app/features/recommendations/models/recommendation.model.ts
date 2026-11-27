import { OrderStatus } from '../../orders/models/order.model';

/**
 * Versión de los criterios de recomendación (`RecommendationSettingsView`). Los tres pesos son
 * porcentajes enteros que suman 100.
 */
export interface RecommendationSettings {
  id: string;
  version: number;
  reputationWeight: number;
  completedServicesWeight: number;
  availabilityWeight: number;
  /** Calificaciones neutras que se suman al promedio (promedio bayesiano). */
  reviewsForConfidence: number;
  /** Servicios completados con los que el criterio llega al 100 %. */
  completedServicesTarget: number;
  /** Horas libres en el periodo con las que el criterio llega al 100 %. */
  availabilityHoursTarget: number;
  /** Calificación neutra (3 estrellas) y días en los que se mide la disponibilidad. */
  neutralRating: number;
  availabilityWindowDays: number;
  /** ISO 8601 en UTC. */
  createdAt: string;
  /** `null` en la versión inicial, que creó la migración. */
  createdBy: { id: string; firstName: string; lastName: string } | null;
}

/** `GET /admin/recommendation-settings`: versión vigente e historial (más reciente primero). */
export interface RecommendationSettingsOverview {
  current: RecommendationSettings;
  history: RecommendationSettings[];
}

/** Cuerpo de `PUT /admin/recommendation-settings` (`UpdateRecommendationSettingsDto`). */
export type UpdateRecommendationSettingsRequest = Pick<
  RecommendationSettings,
  | 'reputationWeight'
  | 'completedServicesWeight'
  | 'availabilityWeight'
  | 'reviewsForConfidence'
  | 'completedServicesTarget'
  | 'availabilityHoursTarget'
>;

/** Límites de cada campo, iguales a los del DTO del backend. */
export const SETTINGS_LIMITS: Readonly<
  Record<keyof UpdateRecommendationSettingsRequest, { min: number; max: number }>
> = {
  reputationWeight: { min: 0, max: 100 },
  completedServicesWeight: { min: 0, max: 100 },
  availabilityWeight: { min: 0, max: 100 },
  reviewsForConfidence: { min: 0, max: 50 },
  completedServicesTarget: { min: 1, max: 1000 },
  availabilityHoursTarget: { min: 1, max: 168 },
};

/** Puntaje de un criterio: 0 a 100 con 2 decimales, su peso y los puntos que aporta. */
export interface CriterionScore {
  score: string;
  weight: number;
  points: string;
  /** Cómo se obtuvo el puntaje, en una frase (la arma el backend). */
  explanation: string;
}

export interface RecommendedWorker {
  rank: number;
  workerId: string;
  firstName: string;
  lastName: string;
  totalScore: string;
  reputation: CriterionScore & {
    reviewsCount: number;
    averageRating: string | null;
    adjustedRating: string;
  };
  completedServices: CriterionScore & { count: number; target: number };
  availability: CriterionScore & {
    weeklyScheduleHours: string;
    bookedHours: string;
    freeHours: string;
    targetHours: number;
  };
  /** Oferta vigente del trabajador en el pedido cuando se generó la recomendación. */
  openOfferId: string | null;
}

/** Recomendación guardada (`RecommendationView`). */
export interface WorkerRecommendation {
  id: string;
  orderId: string;
  createdAt: string;
  /** Trabajadores que cumplían los filtros; se muestran los mejores (hasta 10). */
  candidatesCount: number;
  criteria: RecommendationSettings;
  workers: RecommendedWorker[];
  message: string | null;
}

/**
 * Estados en los que el cliente todavía elige trabajador. El backend valida lo mismo y responde
 * 409 en cualquier otro estado.
 */
export const RECOMMENDABLE_ORDER_STATUSES: readonly OrderStatus[] = ['PUBLICADO', 'EN_NEGOCIACION'];
