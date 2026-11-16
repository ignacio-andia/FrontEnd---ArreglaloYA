/**
 * Elemento público de catálogo (`CatalogOption` del backend): categoría de servicio o zona.
 * Los endpoints públicos solo devuelven elementos activos, por eso no incluye `isActive`
 * ni fechas. `description` es `null` cuando no se registró.
 */
export interface CatalogOption {
  id: string;
  name: string;
  description: string | null;
}

/**
 * Referencia a un elemento de catálogo embebida en perfiles, pedidos y solicitudes
 * (`CatalogRef` del backend). `isActive` permite señalar una zona o especialidad desactivada.
 */
export interface CatalogRef {
  id: string;
  name: string;
  isActive: boolean;
}
