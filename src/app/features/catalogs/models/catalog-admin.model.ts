/** Los dos catálogos administrables; cada uno es un segmento de la API. */
export type CatalogKind = 'categories' | 'zones';

/** Elemento visto por el administrador (`CatalogItem`). */
export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Cuerpo de alta (`CreateCatalogItemDto`). */
export interface CreateCatalogItemRequest {
  name: string;
  description?: string;
}

/** Cuerpo de edición (`UpdateCatalogItemDto`): `description: null` la borra. */
export interface UpdateCatalogItemRequest {
  name?: string;
  description?: string | null;
}

export const CATALOG_NAME_MIN_LENGTH = 2;
export const CATALOG_NAME_MAX_LENGTH = 100;
export const CATALOG_DESCRIPTION_MAX_LENGTH = 500;

/** Textos de cada catálogo. */
export interface CatalogCopy {
  title: string;
  intro: string;
  createHeading: string;
  empty: string;
  /** Consecuencia de desactivar. El backend no permite reactivar. */
  deactivation: string;
  created: string;
  updated: string;
  deactivated: string;
}

export const CATALOG_COPY: Readonly<Record<CatalogKind, CatalogCopy>> = {
  categories: {
    title: 'Categorías',
    intro: 'Categorías de servicio que se usan en pedidos y perfiles.',
    createHeading: 'Nueva categoría',
    empty: 'No hay categorías con este filtro.',
    deactivation:
      'Dejará de ofrecerse al publicar pedidos y en los perfiles. Los registros que ya la usan la conservan.',
    created: 'Categoría creada.',
    updated: 'Categoría actualizada.',
    deactivated: 'Categoría desactivada.',
  },
  zones: {
    title: 'Zonas',
    intro: 'Zonas de Cochabamba donde se publican pedidos y atienden los trabajadores.',
    createHeading: 'Nueva zona',
    empty: 'No hay zonas con este filtro.',
    deactivation:
      'Dejará de ofrecerse en pedidos y perfiles nuevos. Los perfiles que ya la usan quedarán marcados con zona desactivada.',
    created: 'Zona creada.',
    updated: 'Zona actualizada.',
    deactivated: 'Zona desactivada.',
  },
};
