import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { dayBounds, isDateOnly } from '../../../../shared/utils/date-range';
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  AUDIT_ENTITY_TYPES,
  AuditLog,
} from '../../models/audit-log.model';
import { AuditApiService } from '../../services/audit-api.service';
import { describeAuditDetails } from '../../utils/audit-details';

export const AUDIT_PAGE_SIZE = 20;
const LIST_ERROR = 'No se pudo cargar la bitácora.';
const RANGE_ERROR = 'La fecha inicial no puede ser posterior a la final.';

/** Entidades con una pantalla administrativa propia. */
const ENTITY_PATHS: Partial<Record<AuditLog['entityType'], string>> = {
  PERFIL_TRABAJADOR: '/admin/trabajadores',
  RECLAMO: '/admin/reclamos',
};

/**
 * Bitácora de acciones administrativas, de solo lectura. Filtros en la URL
 * (`?entidad=&accion=&desde=&hasta=&pagina=`); las fechas son días de Bolivia.
 */
@Component({
  selector: 'app-audit-log-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    PaginatorComponent,
  ],
  templateUrl: './audit-log-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss', './audit-log-page.component.scss'],
})
export class AuditLogPageComponent {
  private readonly auditApi = inject(AuditApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly actions = AUDIT_ACTIONS;
  protected readonly actionLabels = AUDIT_ACTION_LABELS;
  protected readonly entityTypes = AUDIT_ENTITY_TYPES;
  protected readonly entityLabels = AUDIT_ENTITY_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;

  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly filtersFromUrl = computed(() => {
    const params = this.query();
    const date = (name: string) => {
      const value = params.get(name) ?? '';
      return isDateOnly(value) ? value : '';
    };
    return {
      entityType: AUDIT_ENTITY_TYPES.find((type) => type === params.get('entidad')) ?? '',
      action: AUDIT_ACTIONS.find((action) => action === params.get('accion')) ?? '',
      from: date('desde'),
      to: date('hasta'),
    } as const;
  });
  protected readonly page = computed(() => {
    const value = Number(this.query().get('pagina'));
    return Number.isInteger(value) && value >= 1 ? value : 1;
  });
  protected readonly filtered = computed(() =>
    Object.values(this.filtersFromUrl()).some((value) => value !== ''),
  );

  protected readonly logs = rxResource({
    params: () => ({ ...this.filtersFromUrl(), page: this.page() }),
    stream: ({ params }) =>
      this.auditApi.list({
        entityType: params.entityType || undefined,
        action: params.action || undefined,
        from: params.from ? dayBounds(params.from).start : undefined,
        to: params.to ? dayBounds(params.to).end : undefined,
        page: params.page,
        limit: AUDIT_PAGE_SIZE,
      }),
  });
  protected readonly meta = computed(() => (this.logs.hasValue() ? this.logs.value().meta : null));
  protected readonly items = computed(() =>
    this.logs.hasValue()
      ? this.logs.value().data.map((entry) => ({
          ...entry,
          lines: describeAuditDetails(entry),
          path: ENTITY_PATHS[entry.entityType],
        }))
      : [],
  );
  protected readonly errorMessage = computed(() => {
    const error = this.logs.error();
    return error === undefined ? null : apiErrorMessages(error, LIST_ERROR).join(' ');
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    entityType: '',
    action: '',
    from: '',
    to: '',
  });
  protected readonly rangeError = signal<string | null>(null);

  constructor() {
    effect(() => this.form.setValue({ ...this.filtersFromUrl() }));
  }

  protected apply(): void {
    const { entityType, action, from, to } = this.form.getRawValue();
    if (from !== '' && to !== '' && from > to) {
      this.rangeError.set(RANGE_ERROR);
      return;
    }
    this.rangeError.set(null);
    this.navigate({
      entidad: entityType || null,
      accion: action || null,
      desde: from || null,
      hasta: to || null,
      pagina: null,
    });
  }

  protected clear(): void {
    this.rangeError.set(null);
    this.form.reset();
    this.apply();
  }

  protected goToPage(page: number): void {
    this.navigate({ pagina: page > 1 ? page : null });
  }

  private navigate(queryParams: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
