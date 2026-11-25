import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { CONCEPT_LABELS, METHOD_LABELS, PARTY_LABELS, Receipts } from '../../models/payment.model';

/**
 * Constancias que entrega el backend: la del servicio (emitida al acordar) y una por cada
 * declaración. Son registros de lo declarado, no comprobantes bancarios. `referenceNotice` no se
 * muestra: habla de un comprobante adjunto que todavía no se puede subir.
 */
@Component({
  selector: 'app-receipts-list',
  imports: [DatePipe],
  templateUrl: './receipts-list.component.html',
  styleUrl: './receipts-list.component.scss',
})
export class ReceiptsListComponent {
  readonly receipts = input.required<Receipts>();

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly concepts = CONCEPT_LABELS;
  protected readonly methods = METHOD_LABELS;
  protected readonly parties = PARTY_LABELS;
}
