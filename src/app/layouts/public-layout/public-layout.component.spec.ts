import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionStore } from '../../core/auth/session.store';
import { PublicLayoutComponent } from './public-layout.component';

describe('PublicLayoutComponent', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => sessionStorage.clear());

  function render() {
    const fixture = TestBed.createComponent(PublicLayoutComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('renders the router outlet inside main', () => {
    const { element } = render();

    expect(element.querySelector('main router-outlet')).not.toBeNull();
  });

  it('shows the ArreglaloYA brand in the header and the footer', () => {
    const { element } = render();

    expect(element.querySelector('.site-header__brand')?.textContent?.trim()).toBe('ArreglaloYA');
    expect(element.querySelector('.site-footer__brand')?.textContent?.trim()).toBe('ArreglaloYA');
  });

  it('renders the public navigation, marking sections without page as pending', () => {
    const { element } = render();

    const main = element.querySelector('nav[aria-label="Principal"]');
    const mainLinks = Array.from(main?.querySelectorAll('a') ?? []);
    expect(mainLinks.map((link) => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
      ['Inicio', '/'],
      ['Categorías', '/categorias'],
    ]);
    const pending = Array.from(main?.querySelectorAll('.nav-link--pending') ?? []);
    expect(pending.map((item) => item.firstChild?.textContent?.trim())).toEqual(['Cómo funciona']);

    const account = element.querySelector('nav[aria-label="Cuenta"]');
    expect(account?.querySelector('.nav-link--pending')).toBeNull();
    const links = Array.from(account?.querySelectorAll('a') ?? []);
    expect(links.map((link) => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
      ['Iniciar sesión', '/auth/login'],
      ['Registrarse', '/auth/registro'],
    ]);
  });

  it('shows the main CTA as pending until order publishing exists', () => {
    const { element } = render();

    const cta = element.querySelector('.cta');
    expect(cta?.textContent).toContain('Solicitar un servicio');
    expect(cta?.tagName).toBe('SPAN');
  });

  it('replaces account links with the session menu when authenticated', () => {
    TestBed.inject(SessionStore).setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: {
        id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        phone: null,
        status: 'ACTIVO',
        roles: ['CLIENTE'],
        createdAt: '2026-11-15T14:30:00.000Z',
        updatedAt: '2026-11-15T14:30:00.000Z',
      },
    });

    const { element } = render();

    expect(element.querySelector('nav[aria-label="Cuenta"]')).toBeNull();
    expect(element.querySelector('app-user-menu')?.textContent).toContain('Ana Pérez');
  });

  it('toggles the mobile menu', () => {
    const { fixture, element } = render();
    const toggle = element.querySelector<HTMLButtonElement>('.site-header__toggle');

    toggle?.click();
    fixture.detectChanges();

    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('#public-menu')?.classList).toContain('is-open');
  });
});
