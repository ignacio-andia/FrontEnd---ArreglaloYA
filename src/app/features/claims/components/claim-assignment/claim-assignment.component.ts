import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import {
  CLAIM_PRIORITIES,
  CLAIM_PRIORITY_LABELS,
  Claim,
  ClaimPriority,
  UpdateClaimAssignmentRequest,
} from '../../models/claim.model';
import { ClaimsApiService } from '../../services/claims-api.service';
import { ClaimChange } from '../claim-resolution/claim-resolution.component';

const SAVE_ERROR = 'No se pudo guardar la asignación. Inténtelo de nuevo más tarde.';

/** Fecha ISO (UTC) → valor de `<input type="datetime-local">` en la hora del navegador. */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Prioridad, responsable y fecha límite de un reclamo. Muestra los valores actuales y, mientras
 * el reclamo no esté resuelto, permite cambiarlos. Las reglas (responsable administrador activo,
 * fecha futura y a 30 días como máximo, plazo automático por prioridad) las aplica el backend:
 * aquí solo se muestran sus mensajes.
 */
@Component({
  selector: 'app-claim-assignment',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './claim-assignment.component.html',
  styleUrl: './claim-assignment.component.scss',
})
export class ClaimAssignmentComponent {
  private readonly claimsApi = inject(ClaimsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly claim = input.required<Claim>();
  readonly changed = output<ClaimChange>();
  /** Mensajes del backend si se rechaza; vacío al volver a intentarlo. */
  readonly failed = output<string[]>();

  protected readonly priorities = CLAIM_PRIORITIES;
  protected readonly labels = CLAIM_PRIORITY_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly sending = signal(false);
  protected readonly assignees = rxResource({
    stream: () => this.claimsApi.listAssignees(),
  });

  protected readonly form = this.fb.group({
    priority: this.fb.control<ClaimPriority>('MEDIA'),
    assignedToId: this.fb.control(''),
    /** Vacío: el backend calcula el plazo según la prioridad. */
    dueAt: this.fb.control(''),
  });

  constructor() {
    // Cada vez que llega el reclamo (al cargar o tras guardar) el formulario muestra sus valores.
    effect(() => {
      const current = this.claim();
      this.form.reset({
        priority: current.priority,
        assignedToId: current.assignee?.id ?? '',
        dueAt: toLocalInput(current.dueAt),
      });
    });
  }

  /** Deja la fecha vacía: el backend la recalcula si cambia la prioridad. */
  protected useAutomaticDueAt(): void {
    this.form.controls.dueAt.setValue('');
    this.form.controls.dueAt.markAsDirty();
  }

  protected save(): void {
    if (this.sending()) {
      return;
    }
    const { priority, assignedToId, dueAt } = this.form.getRawValue();
    const dueAtChanged = this.form.controls.dueAt.dirty && dueAt !== '';
    const request: UpdateClaimAssignmentRequest = {
      priority,
      assignedToId: assignedToId || null,
      // Solo se envía si el administrador escribió otra fecha.
      ...(dueAtChanged ? { dueAt: new Date(dueAt).toISOString() } : {}),
    };
    this.sending.set(true);
    this.failed.emit([]);
    this.claimsApi
      .updateAssignment(this.claim().id, request)
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (claim) => this.changed.emit({ claim, message: 'Asignación guardada.' }),
        error: (error: unknown) => this.failed.emit(apiErrorMessages(error, SAVE_ERROR)),
      });
  }
}
