import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OfferParty } from '../../../offers/models/offer.model';
import {
  SUMMARY_NOT_RECORDED_MESSAGE,
  SUMMARY_STATUS_LABELS,
} from '../../models/cancellation-summary.model';
import { CONCEPT_LABELS } from '../../models/payment.model';
import { PaymentsApiService } from '../../services/payments-api.service';
import { DeclarationListComponent } from '../declaration-list/declaration-list.component';

const SUMMARY_ERROR = 'No se pudo cargar el resumen de la cancelación.';
const NOT_RECORDED = 'Este pedido se canceló sin un resumen económico registrado.';
const NOT_FOUND = 'No se encontró el resumen: el pedido no existe o no tiene acceso a él.';
const NO_DATA = 'Sin dato';

interface TotalRow {
  label: string;
  value: string;
  highlight?: 'total' | 'balance';
}

/**
 * Fotografía económica de una cancelación (#116): importes, anticipo, adicionales aceptados,
 * visita (aparte) y declaraciones. Solo muestra lo que entrega el backend: no suma, resta ni
 * convierte importes. La pueden ver las partes y el administrador.
 * Junto a «Pagos», el saldo y su explicación se presentan allí; las declaraciones, aquí.
 */
@Component({
  selector: 'app-cancellation-summary',
  imports: [
    DatePipe,
    DeclarationListComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
  ],
  templateUrl: './cancellation-summary.component.html',
  styleUrls: [
    '../../../offers/offer-pages.scss',
    // Mismas tarjetas de importes y de pagos que la sección «Pagos».
    '../payments-section/payments-section.component.scss',
    './cancellation-summary.component.scss',
  ],
})
export class CancellationSummaryComponent {
  private readonly paymentsApi = inject(PaymentsApiService);

  readonly orderId = input.required<string>();
  readonly viewer = input.required<OfferParty | null>();
  /** Cuando cambia, la página volvió a consultar: pueden constar declaraciones posteriores. */
  readonly version = input<unknown>();
  /** La misma página muestra el saldo en «Pagos»: no se repite aquí. */
  readonly alongsidePayments = input(false);

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly concepts = CONCEPT_LABELS;
  protected readonly statuses = SUMMARY_STATUS_LABELS;

  protected readonly summary = rxResource({
    params: () => this.orderId(),
    stream: ({ params }) => this.paymentsApi.getCancellationSummary(params),
  });
  protected readonly current = computed(() =>
    this.summary.hasValue() ? this.summary.value() : null,
  );

  private readonly errorStatus = computed(() => apiErrorStatus(this.summary.error()));
  /** Respuestas sin nada que reintentar: no hay resumen o no hay pedido visible. */
  protected readonly unavailable = computed(() => {
    const status = this.errorStatus();
    if (status !== 404 && status !== 400) {
      return null;
    }
    const messages = apiErrorMessages(this.summary.error(), '');
    return messages.includes(SUMMARY_NOT_RECORDED_MESSAGE) ? NOT_RECORDED : NOT_FOUND;
  });
  /** No hay resumen que mostrar (sin registro, sin acceso o con error). */
  readonly failed = computed(() => this.summary.error() !== undefined);
  protected readonly errorMessage = computed(() => {
    const error = this.summary.error();
    return error === undefined ? null : apiErrorMessages(error, SUMMARY_ERROR).join(' ');
  });
  protected readonly retryable = computed(() => this.errorStatus() !== 403);

  protected readonly totals = computed((): TotalRow[] => {
    const totals = this.current()?.totals;
    if (totals === undefined) {
      return [];
    }
    const rows: TotalRow[] = [
      { label: 'Monto acordado', value: this.money(totals.agreedAmount) },
      { label: 'Adicionales aceptados', value: this.money(totals.acceptedAdditionalTotal) },
      { label: 'Total actualizado', value: this.money(totals.updatedTotal), highlight: 'total' },
      { label: 'Anticipo confirmado', value: this.money(totals.confirmedAdvanceTotal) },
      {
        label: 'Anticipo declarado sin confirmar',
        value: this.money(totals.unconfirmedAdvanceAmount, 'No aplica'),
      },
    ];
    if (!this.alongsidePayments()) {
      const value = this.money(totals.pendingBalance);
      rows.push({ label: 'Saldo pendiente', value, highlight: 'balance' });
    }
    return rows;
  });

  constructor() {
    let first = true;
    effect(() => {
      this.version();
      if (!first) {
        untracked(() => this.summary.reload());
      }
      first = false;
    });
  }

  /** Un importe tal como llega; `null` nunca se presenta como cero. */
  protected money(value: string | null, missing = NO_DATA): string {
    return value === null ? missing : `Bs ${value}`;
  }
}
