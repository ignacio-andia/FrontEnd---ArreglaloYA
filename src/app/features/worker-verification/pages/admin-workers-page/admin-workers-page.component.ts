import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { CatalogsApiService } from '../../../catalogs/services/catalogs-api.service';
import {
  WORKER_PROFILE_STATUSES,
  WORKER_PROFILE_STATUS_LABELS,
  WorkerProfileStatus,
} from '../../../worker-profile/models/worker-profile-status.model';
import { AdminWorkerProfilesApiService } from '../../services/admin-worker-profiles-api.service';

export const WORKERS_PAGE_SIZE = 20;
const ALL = 'TODOS';
const LIST_ERROR = 'No se pudieron cargar los perfiles.';

/**
 * Bandeja de revisión de trabajadores. Sin filtro muestra los pendientes; los filtros se guardan
 * en la URL (`?estado=&zona=&categoria=&pagina=`).
 */
@Component({
  selector: 'app-admin-workers-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    PaginatorComponent,
  ],
  templateUrl: './admin-workers-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss', './admin-workers-page.component.scss'],
})
export class AdminWorkersPageComponent {
  private readonly profilesApi = inject(AdminWorkerProfilesApiService);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly all = ALL;
  protected readonly statuses = WORKER_PROFILE_STATUSES;
  protected readonly labels = WORKER_PROFILE_STATUS_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;

  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  /** `null` cuando se piden todos los estados. */
  protected readonly status = computed((): WorkerProfileStatus | null => {
    const value = this.query().get('estado');
    if (value === ALL) {
      return null;
    }
    return WORKER_PROFILE_STATUSES.find((status) => status === value) ?? 'PENDIENTE';
  });
  protected readonly zoneId = computed(() => this.query().get('zona'));
  protected readonly categoryId = computed(() => this.query().get('categoria'));
  protected readonly page = computed(() => {
    const value = Number(this.query().get('pagina'));
    return Number.isInteger(value) && value >= 1 ? value : 1;
  });

  /** Solo alimentan los filtros: si fallan, el listado sigue disponible. */
  private readonly zones = rxResource({ stream: () => this.catalogsApi.getZones() });
  private readonly categories = rxResource({ stream: () => this.catalogsApi.getCategories() });
  protected readonly zoneOptions = computed(() =>
    this.zones.hasValue() ? this.zones.value() : [],
  );
  protected readonly categoryOptions = computed(() =>
    this.categories.hasValue() ? this.categories.value() : [],
  );

  protected readonly profiles = rxResource({
    params: () => ({
      status: this.status(),
      zoneId: this.zoneId(),
      categoryId: this.categoryId(),
      page: this.page(),
    }),
    stream: ({ params }) =>
      this.profilesApi.list({
        status: params.status ?? undefined,
        zoneId: params.zoneId ?? undefined,
        categoryId: params.categoryId ?? undefined,
        page: params.page,
        limit: WORKERS_PAGE_SIZE,
      }),
  });
  protected readonly meta = computed(() =>
    this.profiles.hasValue() ? this.profiles.value().meta : null,
  );
  protected readonly items = computed(() =>
    this.profiles.hasValue() ? this.profiles.value().data : [],
  );
  protected readonly errorMessage = computed(() => {
    const error = this.profiles.error();
    return error === undefined ? null : apiErrorMessages(error, LIST_ERROR).join(' ');
  });

  protected readonly filters = new FormGroup({
    status: new FormControl<string>('PENDIENTE', { nonNullable: true }),
    zone: new FormControl('', { nonNullable: true }),
    category: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      // Las opciones llegan después: se vuelve a aplicar la selección cuando aparecen.
      this.zoneOptions();
      this.categoryOptions();
      this.filters.setValue(
        {
          status: this.status() ?? ALL,
          zone: this.zoneId() ?? '',
          category: this.categoryId() ?? '',
        },
        { emitEvent: false },
      );
    });
    this.filters.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(({ status, zone, category }) =>
        this.navigate({
          estado: status === 'PENDIENTE' ? null : status,
          zona: zone || null,
          categoria: category || null,
          pagina: null,
        }),
      );
  }

  protected goToPage(page: number): void {
    this.navigate({ pagina: page > 1 ? page : null });
  }

  protected showFirstPage(): void {
    this.navigate({ pagina: null });
  }

  private navigate(queryParams: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
