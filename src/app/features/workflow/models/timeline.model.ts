import { RoleName } from '../../../core/models/role.model';

export type TimelineActor =
  | { type: 'USUARIO'; userId: string | null; role: RoleName | null }
  | { type: 'SISTEMA'; process: string };

/** Acontecimiento del pedido (`TimelineEvent`). `summary` es el texto que redacta el backend. */
export interface TimelineEvent {
  id: string;
  source: string;
  type: string;
  at: string;
  actor: TimelineActor;
  summary: string;
  details?: Readonly<Record<string, string | number | boolean | null>>;
}

/** Página de `GET /orders/:orderId/timeline`, del acontecimiento más antiguo al más reciente. */
export interface TimelinePage {
  data: TimelineEvent[];
  /** Opaco: se devuelve tal cual para pedir la página siguiente. */
  nextCursor: string | null;
}
