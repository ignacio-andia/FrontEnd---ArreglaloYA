/**
 * Elemento de navegación de un layout.
 * `path: null` indica una sección prevista cuya página aún no existe: se muestra como
 * "Próximamente" y no es navegable. Al implementar la página se asigna su ruta.
 */
export interface NavItem {
  label: string;
  path: string | null;
  /** Marca el enlace como activo solo si la URL coincide exactamente (raíces de área). */
  exact?: boolean;
}
