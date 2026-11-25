import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OrderStatusBadgeComponent } from '../../../orders/components/order-status-badge/order-status-badge.component';
import { ORDER_STATUS_DESCRIPTIONS } from '../../../orders/models/order.model';
import { BUDGET_STATUS_LABELS, Workflow } from '../../models/workflow.model';

/** Estado actual del servicio y lo ya registrado en su flujo. Solo lectura. */
@Component({
  selector: 'app-work-summary',
  imports: [DatePipe, OrderStatusBadgeComponent],
  templateUrl: './work-summary.component.html',
  styleUrl: './work-summary.component.scss',
})
export class WorkSummaryComponent {
  readonly workflow = input.required<Workflow>();

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly descriptions = ORDER_STATUS_DESCRIPTIONS;
  protected readonly budgetLabels = BUDGET_STATUS_LABELS;
}
