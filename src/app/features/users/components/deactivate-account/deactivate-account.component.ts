import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { LoginNavigationState } from '../../../../core/auth/auth-navigation';
import { AuthService } from '../../../../core/auth/auth.service';
import { SessionStore } from '../../../../core/auth/session.store';
import { LOGIN_PATH } from '../../../../core/guards/auth.guard';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { UsersApiService } from '../../services/users-api.service';

const DEACTIVATE_ERROR = 'No se pudo desactivar la cuenta. Inténtelo de nuevo más tarde.';

/**
 * Desactivación de la propia cuenta, con confirmación. Al lograrlo cierra la sesión local y
 * lleva al login. El backend decide si se permite (409 para el único administrador activo).
 */
@Component({
  selector: 'app-deactivate-account',
  imports: [ConfirmDialogComponent],
  template: `
    <section class="danger" aria-labelledby="deactivate-title">
      <h2 id="deactivate-title" class="danger__title">Desactivar mi cuenta</h2>
      <p class="danger__text">
        Dejará de poder iniciar sesión y sus pedidos dejarán de mostrarse a los trabajadores. No
        podrá reactivarla por su cuenta: solo un administrador puede hacerlo.
      </p>
      @if (error(); as message) {
        <p class="danger__error" role="alert">{{ message }}</p>
      }
      <button type="button" class="danger__button" (click)="ask()">Desactivar cuenta</button>
    </section>

    <app-confirm-dialog
      heading="¿Desactivar su cuenta?"
      confirmLabel="Sí, desactivar"
      busyLabel="Desactivando…"
      [open]="confirming()"
      [busy]="submitting()"
      (confirmed)="deactivate()"
      (cancelled)="confirming.set(false)"
    >
      <p>Se cerrará su sesión y solo un administrador podrá reactivar la cuenta.</p>
    </app-confirm-dialog>
  `,
  styleUrl: './deactivate-account.component.scss',
})
export class DeactivateAccountComponent {
  private readonly usersApi = inject(UsersApiService);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly confirming = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected ask(): void {
    this.error.set(null);
    this.confirming.set(true);
  }

  protected deactivate(): void {
    const user = this.session.user();
    if (this.submitting() || user === null) {
      return;
    }
    this.submitting.set(true);
    this.usersApi
      .deactivateOwnAccount(user.id)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.onDeactivated(),
        error: (error: unknown) => {
          this.confirming.set(false);
          this.error.set(apiErrorMessages(error, DEACTIVATE_ERROR).join(' '));
        },
      });
  }

  private onDeactivated(): void {
    this.confirming.set(false);
    this.auth.logout();
    const state: LoginNavigationState = { loginNotice: 'account-deactivated' };
    void this.router.navigateByUrl(LOGIN_PATH, { state: { ...state } });
  }
}
