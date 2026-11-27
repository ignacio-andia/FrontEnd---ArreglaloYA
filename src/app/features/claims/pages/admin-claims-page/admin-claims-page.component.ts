import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import {
  CLAIM_PRIORITIES,
  CLAIM_PRIORITY_LABELS,
  CLAIM_SITUATIONS,
  CLAIM_SITUATION_LABELS,
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
  ClaimPriority,
  ClaimSituation,
  ClaimStatus,
  isClaimPriority,
  isClaimSituation,
  isClaimStatus,
} from '../../models/claim.model';
import { ClaimsApiService } from '../../services/claims-api.service';

export const CLAIMS_PAGE_SIZE = 20;
const LIST_ERROR = 'No se pudieron cargar los reclamos.';

/**
 * Reclamos para el administrador (#95), en el orden del backend: prioridad (urgentes primero),
 * fecha límite más cercana y antigüedad. Los filtros viven en la URL (`estado`, `prioridad`,
 * `situacion`, `responsable`, `pagina`), así se pueden compartir y sobreviven a recargar.
 */
@Component({
  selector: 'app-admin-claims-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    PaginatorComponent,
  ],
  templateUrl: './admin-claims-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss', './admin-claims-page.component.scss'],
})
export class AdminClaimsPageComponent {
  private readonly claimsApi = inject(ClaimsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly statuses = CLAIM_STATUSES;
  protected readonly labels = CLAIM_STATUS_LABELS;
  protected readonly priorities = CLAIM_PRIORITIES;
  protected readonly priorityLabels = CLAIM_PRIORITY_LABELS;
  protected readonly situations = CLAIM_SITUATIONS;
  protected readonly situationLabels = CLAIM_SITUATION_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;

  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly status = computed((): ClaimStatus | null => {
    const value = this.query().get('estado');
    return value !== null && isClaimStatus(value) ? value : null;
  });
  protected readonly priority = computed((): ClaimPriority | null => {
    const value = this.query().get('prioridad');
    return value !== null && isClaimPriority(value) ? value : null;
  });
  protected readonly situation = computed((): ClaimSituation | null => {
    const value = this.query().get('situacion');
    return value !== null && isClaimSituation(value) ? value : null;
  });
  /** UUID de un administrador o `'none'`; el backend valida el valor. */
  protected readonly assignee = computed(() => this.query().get('responsable'));
  protected readonly page = computed(() => {
    const value = Number(this.query().get('pagina'));
    return Number.isInteger(value) && value >= 1 ? value : 1;
  });

  /** Algún filtro activo, para el mensaje de lista vacía. */
  protected readonly filtered = computed(
    () =>
      this.status() !== null ||
      this.priority() !== null ||
      this.situation() !== null ||
      this.assignee() !== null,
  );

  protected readonly assignees = rxResource({
    stream: () => this.claimsApi.listAssignees(),
  });

  protected readonly claims = rxResource({
    params: () => ({
      status: this.status(),
      priority: this.priority(),
      situation: this.situation(),
      assigneeId: this.assignee(),
      page: this.page(),
    }),
    stream: ({ params }) =>
      this.claimsApi.list({
        status: params.status ?? undefined,
        priority: params.priority ?? undefined,
        situation: params.situation ?? undefined,
        assigneeId: params.assigneeId ?? undefined,
        page: params.page,
        limit: CLAIMS_PAGE_SIZE,
      }),
  });
  protected readonly meta = computed(() =>
    this.claims.hasValue() ? this.claims.value().meta : null,
  );
  protected readonly items = computed(() =>
    this.claims.hasValue() ? this.claims.value().data : [],
  );
  protected readonly errorMessage = computed(() => {
    const error = this.claims.error();
    return error === undefined ? null : apiErrorMessages(error, LIST_ERROR).join(' ');
  });

  protected readonly statusFilter = new FormControl<ClaimStatus | ''>('', { nonNullable: true });
  protected readonly priorityFilter = new FormControl<ClaimPriority | ''>('', {
    nonNullable: true,
  });
  protected readonly situationFilter = new FormControl<ClaimSituation | ''>('', {
    nonNullable: true,
  });
  protected readonly assigneeFilter = new FormControl<string>('', { nonNullable: true });

  constructor() {
    const destroyRef = inject(DestroyRef);
    // La URL manda: los selects reflejan los filtros sin volver a navegar.
    effect(() => {
      this.statusFilter.setValue(this.status() ?? '', { emitEvent: false });
      this.priorityFilter.setValue(this.priority() ?? '', { emitEvent: false });
      this.situationFilter.setValue(this.situation() ?? '', { emitEvent: false });
      this.assigneeFilter.setValue(this.assignee() ?? '', { emitEvent: false });
    });
    // Cambiar un filtro vuelve a la primera página.
    this.statusFilter.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((value) => this.navigate({ estado: value || null, pagina: null }));
    this.priorityFilter.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((value) => this.navigate({ prioridad: value || null, pagina: null }));
    this.situationFilter.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((value) => this.navigate({ situacion: value || null, pagina: null }));
    this.assigneeFilter.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((value) => this.navigate({ responsable: value || null, pagina: null }));
  }

  protected goToPage(page: number): void {
    this.navigate({ pagina: page > 1 ? page : null });
  }

  protected showFirstPage(): void {
    this.navigate({ pagina: null });
  }

  protected clearFilters(): void {
    this.navigate({ estado: null, prioridad: null, situacion: null, responsable: null, pagina: null });
  }

  private navigate(queryParams: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
