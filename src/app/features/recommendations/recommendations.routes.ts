import { Routes } from '@angular/router';

/** Criterios de recomendación de trabajadores, en `/admin/recomendaciones` (rol ADMINISTRADOR). */
export const RECOMMENDATION_SETTINGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Criterios de recomendación | ArreglaloYA',
    loadComponent: () =>
      import('./pages/recommendation-settings-page/recommendation-settings-page.component').then(
        (m) => m.RecommendationSettingsPageComponent,
      ),
  },
];
