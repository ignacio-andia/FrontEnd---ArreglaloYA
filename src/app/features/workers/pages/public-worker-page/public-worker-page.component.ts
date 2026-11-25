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
import { ratingLabel } from '../../models/public-worker.model';
import { WorkersApiService } from '../../services/workers-api.service';

const PROFILE_ERROR = 'No se pudo cargar el perfil.';
const OPINIONS_ERROR = 'No se pudieron cargar las opiniones.';

/**
 * Perfil público de un trabajador aprobado. Lo usan los visitantes (`/trabajadores/:workerId`)
 * y el cliente desde la búsqueda. No muestra documentos ni datos de contacto.
 */
@Component({
  selector: 'app-public-worker-page',
  imports: [DatePipe, RouterLink, EmptyStateComponent, ErrorAlertComponent, LoadingStateComponent],
  templateUrl: './public-worker-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss', './public-worker-page.component.scss'],
})
export class PublicWorkerPageComponent {
  private readonly workersApi = inject(WorkersApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly ratingLabel = ratingLabel;
  /** Dentro del área de cliente se puede volver a la búsqueda. */
  protected readonly fromSearch = this.route.snapshot.data['fromSearch'] === true;

  protected readonly workerId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('workerId') ?? '')),
    { requireSync: true },
  );

  protected readonly worker = rxResource({
    params: () => this.workerId(),
    stream: ({ params }) => this.workersApi.getPublicProfile(params),
  });
  protected readonly unavailable = computed(() => {
    const status = apiErrorStatus(this.worker.error());
    return status === 404 || status === 400;
  });
  protected readonly errorMessage = computed(() => {
    const error = this.worker.error();
    return error === undefined || this.unavailable()
      ? null
      : apiErrorMessages(error, PROFILE_ERROR).join(' ');
  });

  /** Las opiniones restantes se piden solo si el visitante las solicita. */
  protected readonly allRequested = linkedSignal({
    source: this.workerId,
    computation: () => false,
  });
  protected readonly allOpinions = rxResource({
    params: () => (this.allRequested() ? this.workerId() : undefined),
    stream: ({ params }) => this.workersApi.getOpinions(params),
  });
  protected readonly opinionsError = computed(() => {
    const error = this.allOpinions.error();
    return error === undefined ? null : apiErrorMessages(error, OPINIONS_ERROR).join(' ');
  });
  protected readonly opinions = computed(() => {
    if (this.allOpinions.hasValue()) {
      return this.allOpinions.value().data;
    }
    return this.worker.hasValue() ? this.worker.value().recentOpinions : [];
  });
}
