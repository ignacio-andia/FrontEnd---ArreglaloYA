import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize, tap } from 'rxjs';
import { User } from '../../../../core/auth/auth.models';
import { AuthService } from '../../../../core/auth/auth.service';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import {
  SERVER_FIELD_MESSAGE,
  applyServerValidationErrors,
} from '../../../../shared/utils/server-validation';
import { optionalPhone } from '../../../../shared/validators/phone.validators';
import { trimmedMaxLength, trimmedRequired } from '../../../../shared/validators/text.validators';
import { ACCOUNT_NAME_MAX_LENGTH, UpdateUserRequest } from '../../models/user-account.model';
import { UsersApiService } from '../../services/users-api.service';

type AccountField = keyof UpdateUserRequest;

const LOAD_ERROR = 'No se pudieron cargar los datos de su cuenta.';
const INVALID_FORM_MESSAGE = 'No se pudieron guardar los cambios. Revise los campos marcados.';
const UNEXPECTED_MESSAGE = 'Ocurrió un error inesperado. Inténtelo de nuevo más tarde.';
const SAVED_MESSAGE = 'Sus datos se actualizaron correctamente.';
const NO_CHANGES_MESSAGE = 'No hay cambios para guardar.';

/**
 * «Mi cuenta»: consulta (`GET /auth/me`) y actualización (`PATCH /users/:id`) de los datos
 * personales de la cuenta autenticada. Solo se editan nombre, apellido y teléfono; el correo,
 * los roles, el estado y el id no son modificables. La respuesta (el `PublicUser` completo)
 * se guarda en SessionStore, de modo que toda la aplicación ve los datos actualizados.
 *
 * La página no depende del área en la que se monta (cliente, trabajador o administración).
 */
@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.scss',
})
export class AccountPageComponent {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly usersApi = inject(UsersApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly nameMaxLength = ACCOUNT_NAME_MAX_LENGTH;

  protected readonly form = this.fb.group({
    firstName: this.fb.control('', [trimmedRequired, trimmedMaxLength(ACCOUNT_NAME_MAX_LENGTH)]),
    lastName: this.fb.control('', [trimmedRequired, trimmedMaxLength(ACCOUNT_NAME_MAX_LENGTH)]),
    phone: this.fb.control('', [optionalPhone]),
  });

  /** Datos actuales del servidor; al llegar actualizan la sesión y rellenan el formulario. */
  protected readonly account = rxResource({
    stream: () => this.auth.getCurrentUser().pipe(tap((user) => this.resetForm(user))),
  });

  /** Usuario mostrado: la sesión se mantiene al día con la consulta y con cada guardado. */
  protected readonly user = this.session.user;

  protected readonly loadError = computed(() => {
    const error = this.account.error();
    return error === undefined ? null : apiErrorMessages(error, LOAD_ERROR).join(' ');
  });

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly statusMessage = signal<string | null>(null);

  /** Al editar, el aviso anterior («guardado» o «sin cambios») deja de ser válido. */
  private readonly clearStatusOnEdit = this.form.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(() => this.statusMessage.set(null));

  /** Mensaje de error visible de un campo, o `null` si no debe mostrarse todavía. */
  protected errorFor(field: AccountField): string | null {
    const control = this.form.controls[field];
    if (control.valid || !(control.touched || this.submitted())) {
      return null;
    }

    const errors = control.errors ?? {};
    const server: unknown = errors['server'];
    if (typeof server === 'string') {
      return server;
    }
    if (errors['required']) {
      return field === 'firstName' ? 'Ingrese su nombre.' : 'Ingrese su apellido.';
    }
    if (errors['maxlength']) {
      return `Use como máximo ${ACCOUNT_NAME_MAX_LENGTH} caracteres.`;
    }
    if (errors['phone']) {
      return 'Ingrese entre 7 y 15 dígitos, sin espacios ni guiones. Puede empezar con +.';
    }
    return SERVER_FIELD_MESSAGE;
  }

  /** `aria-describedby` del campo: su ayuda (si la tiene) y su error visible. */
  protected describedBy(field: AccountField, hasHint = false): string | null {
    const ids: string[] = [];
    if (hasHint) {
      ids.push(`account-${field}-hint`);
    }
    if (this.errorFor(field) !== null) {
      ids.push(`account-${field}-error`);
    }
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected retry(): void {
    this.account.reload();
  }

  protected submit(): void {
    const user = this.session.user();
    if (this.submitting() || user === null) {
      return;
    }

    this.submitted.set(true);
    this.formErrors.set([]);
    this.statusMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusAfterRender('[aria-invalid="true"]');
      return;
    }

    const changes = this.changesFrom(user);
    if (Object.keys(changes).length === 0) {
      // El backend responde 400 si no se envía ningún dato: no se hace la petición.
      this.statusMessage.set(NO_CHANGES_MESSAGE);
      return;
    }

    this.submitting.set(true);
    this.usersApi
      .updateUser(user.id, changes)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => this.onSaved(updated),
        error: (error: unknown) => this.handleError(error),
      });
  }

  /**
   * Solo los datos modificados, recortados como hace el backend. Un teléfono borrado se envía
   * como `null` (el DTO lo interpreta como «eliminar»); nunca se envía `null` en los nombres.
   */
  private changesFrom(user: User): UpdateUserRequest {
    const firstName = this.form.controls.firstName.value.trim();
    const lastName = this.form.controls.lastName.value.trim();
    const phoneText = this.form.controls.phone.value.trim();
    const phone = phoneText === '' ? null : phoneText;

    const changes: UpdateUserRequest = {};
    if (firstName !== user.firstName) {
      changes.firstName = firstName;
    }
    if (lastName !== user.lastName) {
      changes.lastName = lastName;
    }
    if (phone !== user.phone) {
      changes.phone = phone;
    }
    return changes;
  }

  private onSaved(updated: User): void {
    this.session.setUser(updated);
    this.resetForm(updated);
    this.submitted.set(false);
    this.statusMessage.set(SAVED_MESSAGE);
  }

  private resetForm(user: User): void {
    this.form.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? '',
    });
  }

  private handleError(error: unknown): void {
    const messages = apiErrorMessages(error, UNEXPECTED_MESSAGE);
    if (apiErrorStatus(error) === 400) {
      const unmatched = applyServerValidationErrors(this.form, messages);
      this.formErrors.set([INVALID_FORM_MESSAGE, ...unmatched]);
    } else {
      this.formErrors.set(messages);
    }
    this.focusAfterRender('#account-error-summary');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
