import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OfferParty } from '../../../offers/models/offer.model';
import { BUDGET_STATUS_LABELS, BudgetResult, Workflow } from '../../models/workflow.model';
import { BudgetResponseComponent } from '../budget-response/budget-response.component';

/**
 * Presupuestos adicionales de un trabajo, como los entrega el flujo. El cliente responde el
 * pendiente desde aquí; los totales los calcula el backend y se muestran en «Pagos».
 */
@Component({
  selector: 'app-additional-budget-list',
  imports: [DatePipe, BudgetResponseComponent],
  templateUrl: './additional-budget-list.component.html',
  styleUrls: ['../../../offers/offer-pages.scss', './additional-budget-list.component.scss'],
})
export class AdditionalBudgetListComponent {
  readonly workflow = input.required<Workflow>();
  readonly viewer = input.required<OfferParty>();

  /** El cliente aceptó o rechazó el pendiente. */
  readonly responded = output<BudgetResult>();
  readonly failed = output<string[]>();
  readonly stale = output();

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly labels = BUDGET_STATUS_LABELS;
}
