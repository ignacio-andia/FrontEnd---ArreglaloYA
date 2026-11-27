import { OfferParty } from '../../offers/models/offer.model';
import { TimelineActor } from '../models/timeline.model';

export type TimelineAuthor = 'worker' | 'client' | 'admin' | 'system';

const AUTHOR_LABELS: Readonly<Record<TimelineAuthor, string>> = {
  worker: 'Trabajador',
  client: 'Cliente',
  admin: 'Administrador',
  system: 'Sistema',
};

export function authorOf(actor: TimelineActor): TimelineAuthor {
  if (actor.type === 'SISTEMA') {
    return 'system';
  }
  switch (actor.role) {
    case 'TRABAJADOR':
      return 'worker';
    case 'CLIENTE':
      return 'client';
    case 'ADMINISTRADOR':
      return 'admin';
    default:
      return 'system';
  }
}

/**
 * Autor de un acontecimiento: el rol (el contrato no da el nombre) y «(usted)» cuando quien mira
 * es esa parte; `viewer` es `null` si no es ninguna de las dos.
 */
export function authorLabel(actor: TimelineActor, viewer: OfferParty | null): string {
  const author = authorOf(actor);
  const own = viewer !== null && author === (viewer === 'CLIENTE' ? 'client' : 'worker');
  return own ? `${AUTHOR_LABELS[author]} (usted)` : AUTHOR_LABELS[author];
}
