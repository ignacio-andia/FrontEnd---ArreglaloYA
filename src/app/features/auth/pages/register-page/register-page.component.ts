import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { RegisterRequest } from '../../../../core/auth/auth.models';
import { AuthService } from '../../../../core/auth/auth.service';
import { isNormalizedApiError } from '../../../../core/models/api-error.model';
import {
  SERVER_FIELD_MESSAGE,
  applyServerValidationErrors,
  setServerError,
} from '../../../../shared/utils/server-validation';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  optionalPhone,
  passwordPolicy,
  trimmedEmail,
  trimmedMaxLength,
  trimmedRequired,
} from '../../validators/auth.validators';

type RegisterField = keyof RegisterRequest;

/** Destino tras registrarse: el registro crea una cuenta CLIENTE con la sesión iniciada. */
const AFTER_REGISTER_PATH = '/cliente';

const REQUIRED_MESSAGES: Record<RegisterField, string> = {
  firstName: 'Ingrese su nombre.',
  lastName: 'Ingrese su apellido.',
  email: 'Ingrese su correo electrónico.',
  password: 'Ingrese una contraseña.',
  phone: '',
};

const INVALID_FORM_MESSAGE = 'No se pudo crear la cuenta. Revise los campos marcados.';
const UNEXPECTED_MESSAGE = 'Ocurrió un error inesperado. Inténtelo de nuevo más tarde.';

/**
 * Registro de cuenta (`POST /auth/register` mediante AuthService).
 * El backend crea la cuenta como CLIENTE y ACTIVO; AuthService guarda la sesión y la página
 * redirige al área de cliente.
 */
@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register-page.component.html',
  styleUrl: '../../auth-form.scss',
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: ['', [trimmedRequired, trimmedMaxLength(NAME_MAX_LENGTH)]],
    lastName: ['', [trimmedRequired, trimmedMaxLength(NAME_MAX_LENGTH)]],
    email: ['', [trimmedRequired, trimmedMaxLength(EMAIL_MAX_LENGTH), trimmedEmail]],
    password: ['', [Validators.required, passwordPolicy]],
    phone: ['', [optionalPhone]],
  });

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly passwordHint = `Mínimo ${PASSWORD_MIN_LENGTH} caracteres, con al menos una letra y un número.`;

  /** Mensaje de error visible de un campo, o `null` si no debe mostrarse todavía. */
  protected errorFor(field: RegisterField): string | null {
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
      return REQUIRED_MESSAGES[field];
    }
    if (errors['maxlength']) {
      const max = field === 'email' ? EMAIL_MAX_LENGTH : NAME_MAX_LENGTH;
      return `Use como máximo ${max} caracteres.`;
    }
    if (errors['email']) {
      return 'Ingrese un correo electrónico válido, con el formato nombre@dominio.com.';
    }
    if (errors['minlength']) {
      return `Use al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
    }
    if (errors['letterAndDigit']) {
      return 'Incluya al menos una letra y un número.';
    }
    if (errors['maxbytes']) {
      return `La contraseña es demasiado larga: admite hasta ${PASSWORD_MAX_BYTES} bytes (las letras con tilde y la ñ ocupan 2).`;
    }
    if (errors['phone']) {
      return 'Ingrese entre 7 y 15 dígitos, sin espacios ni guiones. Puede empezar con +.';
    }
    return SERVER_FIELD_MESSAGE;
  }

  /** `aria-describedby` del campo: su ayuda (si la tiene) y su error visible. */
  protected describedBy(field: RegisterField, hasHint = false): string | null {
    const ids: string[] = [];
    if (hasHint) {
      ids.push(`register-${field}-hint`);
    }
    if (this.errorFor(field) !== null) {
      ids.push(`register-${field}-error`);
    }
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected togglePassword(): void {
    this.showPassword.update((show) => !show);
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }

    this.submitted.set(true);
    this.formError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusAfterRender('[aria-invalid="true"]');
      return;
    }

    this.submitting.set(true);
    this.auth
      .register(this.buildRequest())
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl(AFTER_REGISTER_PATH),
        error: (error: unknown) => this.handleError(error),
      });
  }

  /** Cuerpo con los valores recortados (como hace el backend); el teléfono vacío se omite. */
  private buildRequest(): RegisterRequest {
    const { firstName, lastName, email, password, phone } = this.form.getRawValue();
    const request: RegisterRequest = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
    };

    const trimmedPhone = phone.trim();
    if (trimmedPhone !== '') {
      request.phone = trimmedPhone;
    }

    return request;
  }

  private handleError(error: unknown): void {
    if (!isNormalizedApiError(error)) {
      this.formError.set(UNEXPECTED_MESSAGE);
    } else if (error.statusCode === 409) {
      // "El correo electrónico ya está registrado".
      const message = error.messages.join(' ');
      setServerError(this.form.controls.email, message);
      this.formError.set(message);
    } else if (error.statusCode === 400) {
      const unmatched = applyServerValidationErrors(this.form, error.messages);
      this.formError.set([INVALID_FORM_MESSAGE, ...unmatched].join(' '));
    } else {
      this.formError.set(error.messages.join(' '));
    }

    this.focusAfterRender('#register-error-summary');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
