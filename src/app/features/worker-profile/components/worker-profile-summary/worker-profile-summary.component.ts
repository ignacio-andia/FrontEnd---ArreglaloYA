import { Component, computed, input } from '@angular/core';
import {
  WORKER_PROFILE_STATUS_DESCRIPTIONS,
  WORKER_PROFILE_STATUS_LABELS,
} from '../../models/worker-profile-status.model';
import { WorkerProfile } from '../../models/worker-profile.model';

/**
 * Presenta el perfil de trabajador tal como lo devuelve el backend: estado real, datos,
 * zona, especialidades y requisitos pendientes. No calcula estados ni aprobaciones.
 */
@Component({
  selector: 'app-worker-profile-summary',
  templateUrl: './worker-profile-summary.component.html',
  styleUrl: './worker-profile-summary.component.scss',
})
export class WorkerProfileSummaryComponent {
  readonly profile = input.required<WorkerProfile>();
  /** Muestra los requisitos pendientes (la página de «Mi perfil» los muestra junto al envío). */
  readonly showPending = input(true);

  protected readonly statusLabel = computed(
    () => WORKER_PROFILE_STATUS_LABELS[this.profile().status],
  );
  protected readonly statusDescription = computed(
    () => WORKER_PROFILE_STATUS_DESCRIPTIONS[this.profile().status],
  );
  protected readonly statusClass = computed(
    () => `status-badge status-badge--${this.profile().status.toLowerCase()}`,
  );
}
