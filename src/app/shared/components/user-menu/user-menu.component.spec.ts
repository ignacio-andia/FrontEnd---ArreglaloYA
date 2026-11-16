import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { User } from '../../../core/auth/auth.models';
import { SessionStore } from '../../../core/auth/session.store';
import { RoleName } from '../../../core/models/role.model';
import { UserMenuComponent } from './user-menu.component';

function userWithRoles(roles: RoleName[]): User {
  return {
    id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    phone: null,
    status: 'ACTIVO',
    roles,
    createdAt: '2026-11-15T14:30:00.000Z',
    updatedAt: '2026-11-15T14:30:00.000Z',
  };
}

describe('UserMenuComponent', () => {
  let session: SessionStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => sessionStorage.clear());

  function render(roles: RoleName[] | null) {
    if (roles !== null) {
      session.setSession({
        accessToken: 'jwt-token',
        tokenType: 'Bearer',
        user: userWithRoles(roles),
      });
    }
    const fixture = TestBed.createComponent(UserMenuComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function trigger(element: HTMLElement): HTMLButtonElement {
    const button = element.querySelector<HTMLButtonElement>('.user-menu__trigger');
    if (!button) {
      throw new Error('Trigger not found');
    }
    return button;
  }

  it('renders nothing without an authenticated user', () => {
    const { element } = render(null);

    expect(element.querySelector('button')).toBeNull();
  });

  it('identifies the user with the session data', () => {
    const { element } = render(['CLIENTE']);

    expect(trigger(element).textContent).toContain('Ana Pérez');
    expect(element.querySelector('.user-menu__avatar')?.textContent?.trim()).toBe('AP');
    expect(element.querySelector('.user-menu__email')?.textContent).toBe('ana@example.com');
  });

  it('toggles the panel as a disclosure', () => {
    const { fixture, element } = render(['CLIENTE']);
    const panel = element.querySelector<HTMLElement>('#user-menu-panel');

    expect(trigger(element).getAttribute('aria-expanded')).toBe('false');
    expect(trigger(element).getAttribute('aria-controls')).toBe('user-menu-panel');
    expect(panel?.hidden).toBe(true);

    trigger(element).click();
    fixture.detectChanges();

    expect(trigger(element).getAttribute('aria-expanded')).toBe('true');
    expect(panel?.hidden).toBe(false);
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const { fixture, element } = render(['CLIENTE']);
    trigger(element).click();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(trigger(element).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger(element));
  });

  it('lists every area of an account with CLIENTE and TRABAJADOR', () => {
    const { element } = render(['CLIENTE', 'TRABAJADOR']);

    const areas = Array.from(element.querySelectorAll('.user-menu__areas a')).map((link) => [
      link.textContent?.trim(),
      link.getAttribute('href'),
    ]);
    expect(areas).toEqual([
      ['Área de cliente', '/cliente'],
      ['Área de trabajador', '/trabajador'],
    ]);
  });

  it('logs out locally and navigates to the public home', () => {
    const { fixture, element } = render(['CLIENTE']);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    trigger(element).click();
    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>('.user-menu__logout')?.click();

    expect(session.token()).toBeNull();
    expect(session.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
