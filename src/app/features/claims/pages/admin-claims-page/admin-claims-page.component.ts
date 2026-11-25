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
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
  ClaimStatus,
  isClaimStatus,
} from '../../models/claim.model';
import { ClaimsApiService } from '../../services/claims-api.service';

export const CLAIMS_PAGE_SIZE = 20;
const LIST_ERROR = 'No se pudieron cargar los reclamos.';

/** Reclamos para el administrador (#95), en el orden del backend: los más antiguos primero. */
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
  protected readonly timezone = DISPLAY_TIMEZONE;

  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly status = computed((): ClaimStatus | null => {
    const value = this.query().get('estado');
    return value !== null && isClaimStatus(value) ? value : null;
  });
  protected readonly page = computed(() => {
    const value = Number(this.query().get('pagina'));
    return Number.isInteger(value) && value >= 1 ? value : 1;
  });

  protected readonly claims = rxResource({
    params: () => ({ status: this.status(), page: this.page() }),
    stream: ({ params }) =>
      this.claimsApi.list({
        ...(params.status !== null ? { status: params.status } : {}),
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

  constructor() {
    effect(() => this.statusFilter.setValue(this.status() ?? '', { emitEvent: false }));
    this.statusFilter.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((status) => this.navigate({ estado: status || null, pagina: null }));
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
