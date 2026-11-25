import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import {
  ActionNotice,
  ActionNoticeComponent,
} from '../../../workflow/components/action-notice/action-notice.component';
import { WEEK_DAY_LABELS } from '../../../worker-profile/models/week-day.model';
import { WORKER_PROFILE_STATUS_LABELS } from '../../../worker-profile/models/worker-profile-status.model';
import { AdminWorkerDocumentsComponent } from '../../components/admin-worker-documents/admin-worker-documents.component';
import { ProfileDecisionComponent } from '../../components/profile-decision/profile-decision.component';
import { AdminWorkerProfilesApiService } from '../../services/admin-worker-profiles-api.service';

const PROFILE_ERROR = 'No se pudo cargar el perfil.';

/**
 * Perfil de un trabajador para su revisión: cuenta, datos, horarios, documentos, historial y las
 * decisiones que permite el estado actual.
 */
@Component({
  selector: 'app-admin-worker-page',
  imports: [
    DatePipe,
    RouterLink,
    ActionNoticeComponent,
    AdminWorkerDocumentsComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    ProfileDecisionComponent,
  ],
  templateUrl: './admin-worker-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss'],
})
export class AdminWorkerPageComponent {
  private readonly profilesApi = inject(AdminWorkerProfilesApiService);

  protected readonly labels = WORKER_PROFILE_STATUS_LABELS;
  protected readonly dayLabels = WEEK_DAY_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;

  private readonly profileId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('profileId') ?? '')),
    { requireSync: true },
  );

  protected readonly detail = rxResource({
    params: () => this.profileId(),
    stream: ({ params }) => this.profilesApi.get(params),
  });
  protected readonly current = computed(() =>
    this.detail.hasValue() ? this.detail.value() : null,
  );
  protected readonly notFound = computed(() => {
    const status = apiErrorStatus(this.detail.error());
    return status === 404 || status === 400;
  });
  protected readonly errorMessage = computed(() => {
    const error = this.detail.error();
    return error === undefined || this.notFound()
      ? null
      : apiErrorMessages(error, PROFILE_ERROR).join(' ');
  });

  /** Se borra al pasar a otro perfil. */
  protected readonly notice = linkedSignal<string, ActionNotice | null>({
    source: this.profileId,
    computation: () => null,
  });

  protected refresh(): void {
    this.notice.set(null);
    this.detail.reload();
  }

  protected onChanged(message: string): void {
    this.notice.set({ failed: false, messages: [message] });
    this.detail.reload();
  }

  protected onActionFailed(messages: string[]): void {
    this.notice.set(messages.length === 0 ? null : { failed: true, messages });
  }

  protected reload(): void {
    this.detail.reload();
  }
}
