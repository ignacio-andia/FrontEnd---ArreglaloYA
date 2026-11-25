import { Routes } from '@angular/router';

/** Rutas públicas de catálogos, montadas en `/categorias` dentro de PublicLayout. */
export const CATALOGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Categorías | ArreglaloYA',
    loadComponent: () =>
      import('./pages/categories-page/categories-page.component').then(
        (m) => m.CategoriesPageComponent,
      ),
  },
];

const adminCatalogPage = () =>
  import('./pages/admin-catalog-page/admin-catalog-page.component').then(
    (m) => m.AdminCatalogPageComponent,
  );

/** Administración de categorías, en `/admin/categorias` (rol ADMINISTRADOR). */
export const ADMIN_CATEGORIES_ROUTES: Routes = [
  {
    path: '',
    title: 'Categorías | ArreglaloYA',
    data: { kind: 'categories' },
    loadComponent: adminCatalogPage,
  },
];

/** Administración de zonas, en `/admin/zonas` (rol ADMINISTRADOR). */
export const ADMIN_ZONES_ROUTES: Routes = [
  {
    path: '',
    title: 'Zonas | ArreglaloYA',
    data: { kind: 'zones' },
    loadComponent: adminCatalogPage,
  },
];
