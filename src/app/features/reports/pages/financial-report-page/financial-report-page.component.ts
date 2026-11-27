import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { FileDownloadService } from '../../../../core/services/file-download.service';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { isDateOnly } from '../../../../shared/utils/date-range';
import { ORDER_STATUS_LABELS, OrderStatus } from '../../../orders/models/order.model';
import {
  FINANCIAL_COLUMN_LABELS,
  FINANCIAL_MONEY_COLUMNS,
  FINANCIAL_STATUS_OPTIONS,
  FinancialReportRequest,
} from '../../models/financial-report.model';
import { ReportsApiService } from '../../services/reports-api.service';

const REPORT_ERROR = 'No se pudo generar el reporte financiero.';
const CSV_ERROR = 'No se pudo descargar el archivo.';

/** Celda ya preparada para mostrar: texto, monto o enlace al pedido. */
interface Cell {
  text: string;
  money: boolean;
  orderId: string | null;
}

/**
 * Reporte financiero de servicios (`GET /admin/reports/financiero`): pedidos acordados en un
 * rango, filtrables por estado actual, con ingresos confirmados, pendiente y comisión
 * informativa. Las cifras son las del backend; aquí solo se formatean. La plataforma no procesa
 * pagos.
 */
@Component({
  selector: 'app-financial-report-page',
  imports: [ReactiveFormsModule, RouterLink, ErrorAlertComponent, LoadingStateComponent],
  templateUrl: './financial-report-page.component.html',
  styleUrls: [
    '../../../offers/offer-pages.scss',
    '../reports-page/reports-page.component.scss',
    './financial-report-page.component.scss',
  ],
})
export class FinancialReportPageComponent {
  private readonly reportsApi = inject(ReportsApiService);
  private readonly downloads = inject(FileDownloadService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusOptions = FINANCIAL_STATUS_OPTIONS;
  protected readonly statusLabels = ORDER_STATUS_LABELS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    from: '',
    to: '',
    statuses: new FormGroup(
      Object.fromEntries(
        FINANCIAL_STATUS_OPTIONS.map((status) => [
          status,
          new FormControl(false, { nonNullable: true }),
        ]),
      ) as Record<OrderStatus, FormControl<boolean>>,
    ),
  });
  protected readonly rangeError = signal<string | null>(null);

  /** Reporte pedido: el CSV se descarga con los mismos filtros que se ven. */
  protected readonly request = signal<FinancialReportRequest | null>(null);
  protected readonly report = rxResource({
    params: () => this.request() ?? undefined,
    stream: ({ params }) => this.reportsApi.getFinancial(params),
  });
  protected readonly current = computed(() =>
    this.report.hasValue() ? this.report.value() : null,
  );
  protected readonly errorMessage = computed(() => {
    const error = this.report.error();
    return error === undefined ? null : apiErrorMessages(error, REPORT_ERROR).join(' ');
  });

  protected readonly columns = computed(() =>
    (this.current()?.columns ?? []).map((column) => FINANCIAL_COLUMN_LABELS[column] ?? column),
  );
  protected readonly rows = computed((): Cell[][] => {
    const report = this.current();
    if (report === null) {
      return [];
    }
    return report.rows.map((row) =>
      row.map((value, index): Cell => {
        const column = report.columns[index];
        const text = String(value);
        if (column === 'pedido') {
          return { text: text.slice(0, 8), money: false, orderId: text };
        }
        if (column === 'estado') {
          return {
            text: this.statusLabels[text as OrderStatus] ?? text,
            money: false,
            orderId: null,
          };
        }
        const money = FINANCIAL_MONEY_COLUMNS.includes(column);
        return { text: money ? `Bs ${text}` : text, money, orderId: null };
      }),
    );
  });
  /** Estados filtrados, en palabras; vacío si se pidieron todos. */
  protected readonly filteredStatuses = computed(() =>
    (this.current()?.statuses ?? []).map((status) => this.statusLabels[status]).join(', '),
  );

  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<string | null>(null);

  protected generate(): void {
    const { from, to, statuses } = this.form.getRawValue();
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
    const selected = FINANCIAL_STATUS_OPTIONS.filter((status) => statuses[status]);
    const previous = this.request();
    if (
      previous !== null &&
      previous.from === from &&
      previous.to === to &&
      previous.statuses.join(',') === selected.join(',')
    ) {
      this.report.reload();
      return;
    }
    this.request.set({ from, to, statuses: selected });
  }

  protected clearStatuses(): void {
    this.form.controls.statuses.reset();
  }

  protected download(): void {
    const request = this.request();
    if (request === null || this.downloading()) {
      return;
    }
    this.downloading.set(true);
    this.downloadError.set(null);
    this.reportsApi
      .getFinancialCsv(request)
      .pipe(
        finalize(() => this.downloading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (blob) =>
          this.downloads.saveBlob(blob, `reporte-financiero-${request.from}-${request.to}.csv`),
        error: (error: unknown) =>
          this.downloadError.set(apiErrorMessages(error, CSV_ERROR).join(' ')),
      });
  }
}
