import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { CatalogsApiService } from '../../../catalogs/services/catalogs-api.service';
import { WEEK_DAY_LABELS } from '../../../worker-profile/models/week-day.model';
import { ratingLabel } from '../../models/public-worker.model';
import { WorkersApiService } from '../../services/workers-api.service';

export const SEARCH_PAGE_SIZE = 10;
const SEARCH_ERROR = 'No se pudo realizar la búsqueda.';
const CATALOGS_ERROR = 'No se pudieron cargar las categorías y las zonas.';

/**
 * Búsqueda de trabajadores aprobados por categoría y zona (`?categoria=&zona=&pagina=`). La
 * búsqueda se ejecuta solo cuando están elegidas las dos.
 */
@Component({
  selector: 'app-worker-search-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    PaginatorComponent,
  ],
  templateUrl: './worker-search-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss', './worker-search-page.component.scss'],
})
export class WorkerSearchPageComponent {
  private readonly workersApi = inject(WorkersApiService);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly dayLabels = WEEK_DAY_LABELS;
  protected readonly ratingLabel = ratingLabel;

  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly categoryId = computed(() => this.query().get('categoria'));
  private readonly zoneId = computed(() => this.query().get('zona'));
  protected readonly page = computed(() => {
    const value = Number(this.query().get('pagina'));
    return Number.isInteger(value) && value >= 1 ? value : 1;
  });

  protected readonly categories = rxResource({ stream: () => this.catalogsApi.getCategories() });
  protected readonly zones = rxResource({ stream: () => this.catalogsApi.getZones() });
  protected readonly catalogsError = computed(() =>
    this.categories.error() !== undefined || this.zones.error() !== undefined
      ? CATALOGS_ERROR
      : null,
  );
  protected readonly categoryOptions = computed(() =>
    this.categories.hasValue() ? this.categories.value() : [],
  );
  protected readonly zoneOptions = computed(() =>
    this.zones.hasValue() ? this.zones.value() : [],
  );

  protected readonly results = rxResource({
    params: () => {
      const categoryId = this.categoryId();
      const zoneId = this.zoneId();
      return categoryId && zoneId ? { categoryId, zoneId, page: this.page() } : undefined;
    },
    stream: ({ params }) => this.workersApi.search({ ...params, limit: SEARCH_PAGE_SIZE }),
  });
  protected readonly searched = computed(() => !!this.categoryId() && !!this.zoneId());
  protected readonly items = computed(() =>
    this.results.hasValue() ? this.results.value().data : [],
  );
  protected readonly meta = computed(() =>
    this.results.hasValue() ? this.results.value().meta : null,
  );
  protected readonly emptyMessage = computed(() =>
    this.results.hasValue() ? this.results.value().message : null,
  );
  protected readonly errorMessage = computed(() => {
    const error = this.results.error();
    return error === undefined ? null : apiErrorMessages(error, SEARCH_ERROR).join(' ');
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    categoryId: ['', Validators.required],
    zoneId: ['', Validators.required],
  });
  protected readonly attempted = signal(false);

  constructor() {
    effect(() => {
      // Las opciones llegan después: se vuelve a aplicar la selección cuando aparecen.
      this.categoryOptions();
      this.zoneOptions();
      this.form.setValue({ categoryId: this.categoryId() ?? '', zoneId: this.zoneId() ?? '' });
    });
  }

  protected search(): void {
    this.attempted.set(true);
    if (this.form.invalid) {
      return;
    }
    const { categoryId, zoneId } = this.form.getRawValue();
    if (categoryId === this.categoryId() && zoneId === this.zoneId() && this.page() === 1) {
      this.results.reload();
      return;
    }
    this.navigate({ categoria: categoryId, zona: zoneId, pagina: null });
  }

  protected goToPage(page: number): void {
    this.navigate({ pagina: page > 1 ? page : null });
  }

  protected retryCatalogs(): void {
    this.categories.reload();
    this.zones.reload();
  }

  private navigate(queryParams: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
