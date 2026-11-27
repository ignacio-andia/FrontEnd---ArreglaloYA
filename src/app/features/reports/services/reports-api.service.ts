import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { FinancialReport, FinancialReportRequest } from '../models/financial-report.model';
import { Report, ReportRequest } from '../models/report.model';

/** Reportes (`GET /admin/reports/:type`), solo para administradores. */
@Service()
export class ReportsApiService {
  private readonly http = inject(HttpClient);

  /** Tabla y totales. 400 si el tipo, el formato o el rango no son válidos. */
  get({ type, from, to }: ReportRequest): Observable<Report> {
    return this.http.get<Report>(apiUrl('admin', 'reports', type), {
      params: new HttpParams().set('from', from).set('to', to),
    });
  }

  /** El mismo reporte como archivo CSV. */
  getCsv({ type, from, to }: ReportRequest): Observable<Blob> {
    return this.http.get(apiUrl('admin', 'reports', type), {
      params: new HttpParams().set('from', from).set('to', to).set('format', 'csv'),
      responseType: 'blob',
    });
  }

  /** `GET /admin/reports/financiero`: pedidos acordados en el rango, montos y totales. */
  getFinancial(request: FinancialReportRequest): Observable<FinancialReport> {
    return this.http.get<FinancialReport>(apiUrl('admin', 'reports', 'financiero'), {
      params: financialParams(request),
    });
  }

  /** El mismo reporte financiero como CSV, con una fila final de totales. */
  getFinancialCsv(request: FinancialReportRequest): Observable<Blob> {
    return this.http.get(apiUrl('admin', 'reports', 'financiero'), {
      params: financialParams(request).set('format', 'csv'),
      responseType: 'blob',
    });
  }
}

/** Sin estados no se envía `status`: el backend devuelve todos. */
function financialParams({ from, to, statuses }: FinancialReportRequest): HttpParams {
  const params = new HttpParams().set('from', from).set('to', to);
  return statuses.length > 0 ? params.set('status', statuses.join(',')) : params;
}
