import { Location } from '@angular/common';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  LoginNotice,
  homePathForRoles,
  loginNoticeFrom,
  safeReturnUrl,
} from '../../../../core/auth/auth-navigation';
import { AuthResponse, LoginRequest } from '../../../../core/auth/auth.models';
import { AuthService } from '../../../../core/auth/auth.service';
import { isNormalizedApiError } from '../../../../core/models/api-error.model';
import {
  SERVER_FIELD_MESSAGE,
  applyServerValidationErrors,
} from '../../../../shared/utils/server-validation';
import { EMAIL_MAX_LENGTH, trimmedEmail } from '../../validators/auth.validators';
import { trimmedMaxLength, trimmedRequired } from '../../../../shared/validators/text.validators';

type LoginField = keyof LoginRequest;

const NOTICE_MESSAGES: Readonly<Record<LoginNotice, string>> = {
  'session-expired': 'Su sesión terminó. Inicie sesión nuevamente para continuar.',
  'account-deactivated': 'Su cuenta fue desactivada y se cerró la sesión.',
};

/** `LoginDto.password`: `@IsNotEmpty` y `@MaxLength(255)`, sin recorte ni otras reglas. */
const PASSWORD_MAX_LENGTH = 255;

const INVALID_FORM_MESSAGE = 'No se pudo iniciar sesión. Revise los campos marcados.';
const UNEXPECTED_MESSAGE = 'Ocurrió un error inesperado. Inténtelo de nuevo más tarde.';

function noticeMessage(notice: LoginNotice | null): string | null {
  return notice === null ? null : NOTICE_MESSAGES[notice];
}

/**
 * Inicio de sesión (`POST /auth/login` mediante AuthService, que guarda la sesión).
 * Tras autenticarse vuelve a `returnUrl` si es una ruta interna segura; si no, al área
 * predeterminada según los roles (ADMINISTRADOR > TRABAJADOR > CLIENTE).
 */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.component.html',
  styleUrl: '../../auth-form.scss',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Destino solicitado antes del login; `null` si no existe o no es seguro. */
  private readonly returnUrl = safeReturnUrl(
    inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl'),
  );

  /**
   * Aviso con el que se llegó al login (sesión terminada o cuenta desactivada). Si la página se
   * crea cuando la navegación ya terminó, el estado se lee del historial.
   */
  protected readonly notice = noticeMessage(
    loginNoticeFrom(this.router.currentNavigation()?.extras.state ?? inject(Location).getState()),
  );

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [trimmedRequired, trimmedMaxLength(EMAIL_MAX_LENGTH), trimmedEmail]],
    password: ['', [Validators.required, Validators.maxLength(PASSWORD_MAX_LENGTH)]],
  });

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  /** Mensaje de error visible de un campo, o `null` si no debe mostrarse todavía. */
  protected errorFor(field: LoginField): string | null {
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
      return field === 'email' ? 'Ingrese su correo electrónico.' : 'Ingrese su contraseña.';
    }
    if (errors['maxlength']) {
      const max = field === 'email' ? EMAIL_MAX_LENGTH : PASSWORD_MAX_LENGTH;
      return `Use como máximo ${max} caracteres.`;
    }
    if (errors['email']) {
      return 'Ingrese un correo electrónico válido, con el formato nombre@dominio.com.';
    }
    return SERVER_FIELD_MESSAGE;
  }

  /** `aria-describedby` del campo con su error visible. */
  protected describedBy(field: LoginField): string | null {
    return this.errorFor(field) === null ? null : `login-${field}-error`;
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

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.auth
      .login({ email: email.trim(), password })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => void this.router.navigateByUrl(this.destinationFor(response)),
        error: (error: unknown) => this.handleError(error),
      });
  }

  private destinationFor(response: AuthResponse): string {
    return this.returnUrl ?? homePathForRoles(response.user.roles);
  }

  private handleError(error: unknown): void {
    if (!isNormalizedApiError(error)) {
      this.formError.set(UNEXPECTED_MESSAGE);
    } else if (error.statusCode === 400) {
      const unmatched = applyServerValidationErrors(this.form, error.messages);
      this.formError.set([INVALID_FORM_MESSAGE, ...unmatched].join(' '));
    } else {
      // 401 "Credenciales inválidas", 403 "La cuenta no está activa", red o 5xx.
      this.formError.set(error.messages.join(' '));
    }

    this.focusAfterRender('#login-error-summary');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
