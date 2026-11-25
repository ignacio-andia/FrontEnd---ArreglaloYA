import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize, map } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import {
  ActionNotice,
  ActionNoticeComponent,
} from '../../../workflow/components/action-notice/action-notice.component';
import { CatalogItemFormComponent } from '../../components/catalog-item-form/catalog-item-form.component';
import { CATALOG_COPY, CatalogItem, CatalogKind } from '../../models/catalog-admin.model';
import { CatalogsAdminApiService } from '../../services/catalogs-admin-api.service';

const LIST_ERROR = 'No se pudo cargar el catálogo.';
const DEACTIVATE_ERROR = 'No se pudo desactivar. Inténtelo de nuevo más tarde.';
type StateFilter = 'all' | 'active' | 'inactive';

/**
 * Administración de un catálogo (categorías o zonas, según la ruta): alta, edición, listado con
 * activos e inactivos y desactivación con confirmación.
 */
@Component({
  selector: 'app-admin-catalog-page',
  imports: [
    ReactiveFormsModule,
    ActionNoticeComponent,
    CatalogItemFormComponent,
    ConfirmDialogComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
  ],
  templateUrl: './admin-catalog-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss', './admin-catalog-page.component.scss'],
})
export class AdminCatalogPageComponent {
  private readonly catalogsApi = inject(CatalogsAdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly kind = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => data['kind'] as CatalogKind)),
    { requireSync: true },
  );
  protected readonly copy = computed(() => CATALOG_COPY[this.kind()]);

  protected readonly stateFilter = new FormControl<StateFilter>('all', { nonNullable: true });
  private readonly state = toSignal(this.stateFilter.valueChanges, {
    initialValue: this.stateFilter.value,
  });

  protected readonly items = rxResource({
    params: () => ({ kind: this.kind(), state: this.state() }),
    stream: ({ params }) =>
      this.catalogsApi.list(
        params.kind,
        params.state === 'all' ? undefined : params.state === 'active',
      ),
  });
  protected readonly errorMessage = computed(() => {
    const error = this.items.error();
    return error === undefined ? null : apiErrorMessages(error, LIST_ERROR).join(' ');
  });

  /** Los avisos y la edición abierta pertenecen a un catálogo. */
  protected readonly notice = linkedSignal<CatalogKind, ActionNotice | null>({
    source: this.kind,
    computation: () => null,
  });
  protected readonly editing = linkedSignal<CatalogKind, string | null>({
    source: this.kind,
    computation: () => null,
  });
  protected readonly deactivating = signal<CatalogItem | null>(null);
  protected readonly sending = signal(false);

  protected onCreated(): void {
    this.done(this.copy().created);
  }

  protected onUpdated(): void {
    this.editing.set(null);
    this.done(this.copy().updated);
  }

  protected edit(item: CatalogItem): void {
    this.notice.set(null);
    this.editing.set(item.id);
  }

  protected askDeactivate(item: CatalogItem): void {
    this.notice.set(null);
    this.deactivating.set(item);
  }

  protected deactivate(): void {
    const item = this.deactivating();
    if (item === null || this.sending()) {
      return;
    }
    this.sending.set(true);
    this.catalogsApi
      .deactivate(this.kind(), item.id)
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.deactivating.set(null);
          this.done(this.copy().deactivated);
        },
        error: (error: unknown) => {
          this.deactivating.set(null);
          this.notice.set({ failed: true, messages: apiErrorMessages(error, DEACTIVATE_ERROR) });
          const status = apiErrorStatus(error);
          if (status === 404 || status === 409) {
            this.items.reload();
          }
        },
      });
  }

  private done(message: string): void {
    this.notice.set({ failed: false, messages: [message] });
    this.items.reload();
  }
}
