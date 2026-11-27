import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { FileDownloadService } from '../../../../core/services/file-download.service';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { isDateOnly } from '../../../../shared/utils/date-range';
import {
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  ReportRequest,
  ReportType,
} from '../../models/report.model';
import { ReportsApiService } from '../../services/reports-api.service';
import { reportTable } from '../../utils/report-table';

const REPORT_ERROR = 'No se pudo generar el reporte.';
const CSV_ERROR = 'No se pudo descargar el archivo.';

/** Reportes por rango de fechas (#115), en pantalla y como archivo CSV. */
@Component({
  selector: 'app-reports-page',
  imports: [ReactiveFormsModule, RouterLink, ErrorAlertComponent, LoadingStateComponent],
  templateUrl: './reports-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss', './reports-page.component.scss'],
})
export class ReportsPageComponent {
  private readonly reportsApi = inject(ReportsApiService);
  private readonly downloads = inject(FileDownloadService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly types = REPORT_TYPES;
  protected readonly labels = REPORT_TYPE_LABELS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    type: 'pedidos' as ReportType,
    from: '',
    to: '',
  });
  protected readonly rangeError = signal<string | null>(null);

  /** Reporte pedido: el archivo se descarga con los mismos datos que se ven. */
  protected readonly request = signal<ReportRequest | null>(null);
  protected readonly report = rxResource({
    params: () => this.request() ?? undefined,
    stream: ({ params }) => this.reportsApi.get(params),
  });
  protected readonly current = computed(() =>
    this.report.hasValue() ? this.report.value() : null,
  );
  protected readonly table = computed(() => {
    const report = this.current();
    return report === null ? null : reportTable(report);
  });
  protected readonly errorMessage = computed(() => {
    const error = this.report.error();
    return error === undefined ? null : apiErrorMessages(error, REPORT_ERROR).join(' ');
  });

  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<string | null>(null);

  protected generate(): void {
    const { type, from, to } = this.form.getRawValue();
    this.downloadError.set(null);
    if (!isDateOnly(from) || !isDateOnly(to)) {
      this.rangeError.set('Indique las dos fechas.');
      return;
    }
    if (from > to) {
      this.rangeError.set('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    this.rangeError.set(null);
    const previous = this.request();
    if (previous?.type === type && previous.from === from && previous.to === to) {
      this.report.reload();
      return;
    }
    this.request.set({ type, from, to });
  }

  protected download(): void {
    const request = this.request();
    if (request === null || this.downloading()) {
      return;
    }
    this.downloading.set(true);
    this.downloadError.set(null);
    this.reportsApi
      .getCsv(request)
      .pipe(
        finalize(() => this.downloading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (blob) =>
          this.downloads.saveBlob(
            blob,
            `reporte-${request.type}-${request.from}-${request.to}.csv`,
          ),
        error: (error: unknown) =>
          this.downloadError.set(apiErrorMessages(error, CSV_ERROR).join(' ')),
      });
  }
}
