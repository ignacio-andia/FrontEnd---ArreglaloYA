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
