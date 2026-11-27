import { Routes } from '@angular/router';

/** Reportes, en `/admin/reportes` (rol ADMINISTRADOR). */
export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Reportes | ArreglaloYA',
    loadComponent: () =>
      import('./pages/reports-page/reports-page.component').then((m) => m.ReportsPageComponent),
  },
  {
    path: 'financiero',
    title: 'Reporte financiero | ArreglaloYA',
    loadComponent: () =>
      import('./pages/financial-report-page/financial-report-page.component').then(
        (m) => m.FinancialReportPageComponent,
      ),
  },
];
