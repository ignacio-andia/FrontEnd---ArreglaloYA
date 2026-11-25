import { PageQuery, PaginationMeta } from '../../../core/models/pagination.model';
import { CatalogRef } from '../../catalogs/models/catalog.model';
import { WeekDay } from '../../worker-profile/models/week-day.model';

/** Datos públicos de un trabajador aprobado: sin correo, teléfono ni documentos. */
export interface PublicWorker {
  workerId: string;
  firstName: string;
  lastName: string;
  yearsOfExperience: number;
  description: string | null;
  zone: CatalogRef | null;
  specialties: CatalogRef[];
}

/** Promedio y cantidad de calificaciones visibles; `average` es `null` si no hay ninguna. */
export interface RatingSummary {
  average: number | null;
  count: number;
}

export interface WorkerSearchResult extends PublicWorker {
  /** Horarios de atención activos. No son reservas. */
  schedules: { dayOfWeek: WeekDay; startTime: string; endTime: string }[];
  rating: RatingSummary;
}

/** Respuesta de `GET /workers/search` (`WorkerSearchPage`). */
export interface WorkerSearchPage {
  data: WorkerSearchResult[];
  meta: PaginationMeta;
  /** Aviso cuando no hay resultados; `null` si hay. */
  message: string | null;
}

export interface WorkerSearchQuery extends PageQuery {
  categoryId: string;
  zoneId: string;
}

/** Opinión visible de un cliente (`PublicOpinionView`). */
export interface PublicOpinion {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  /** Nombre e inicial, por ejemplo «María P.». */
  author: string;
}

/** Respuesta de `GET /workers/:workerId/public-profile` (`PublicWorkerProfileView`). */
export interface PublicWorkerProfile {
  profile: PublicWorker;
  rating: RatingSummary & { message: string | null };
  /** Hasta 5; el resto se pide paginado. */
  recentOpinions: PublicOpinion[];
}

/** Calificación como texto. Sin calificaciones no se inventa un promedio. */
export function ratingLabel({ average, count }: RatingSummary): string {
  if (average === null || count === 0) {
    return 'Sin calificaciones todavía';
  }
  const noun = count === 1 ? 'calificación' : 'calificaciones';
  return `${String(average).replace('.', ',')} de 5 (${count} ${noun})`;
}
