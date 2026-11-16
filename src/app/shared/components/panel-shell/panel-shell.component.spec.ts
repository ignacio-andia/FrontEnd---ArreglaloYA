import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavItem } from '../nav-list/nav-item.model';
import { PanelShellComponent } from './panel-shell.component';

@Component({
  imports: [PanelShellComponent],
  template: `
    <app-panel-shell areaLabel="Área de cliente" [navItems]="navItems">
      <p class="projected">Contenido</p>
    </app-panel-shell>
  `,
})
class HostComponent {
  readonly navItems: readonly NavItem[] = [{ label: 'Resumen', path: '/cliente', exact: true }];
}

describe('PanelShellComponent', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('projects the content inside the main landmark', () => {
    const { element } = render();

    expect(element.querySelector('main .projected')?.textContent).toBe('Contenido');
  });

  it('shows the area and labels the navigation', () => {
    const { element } = render();

    expect(element.querySelector('.shell__brand')?.textContent?.trim()).toBe('ArreglaloYA');
    expect(element.querySelector('.shell__area')?.textContent).toBe('Área de cliente');
    expect(element.querySelector('nav.shell__sidebar')?.getAttribute('aria-label')).toBe(
      'Menú: Área de cliente',
    );
  });

  it('toggles the mobile navigation and closes it with Escape', () => {
    const { fixture, element } = render();
    const toggle = element.querySelector<HTMLButtonElement>('.shell__menu-toggle');
    const nav = element.querySelector('nav.shell__sidebar');

    expect(toggle?.getAttribute('aria-controls')).toBe(nav?.id);
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');

    toggle?.click();
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(nav?.classList).toContain('is-open');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });

  it('moves focus to the main content with the skip link', () => {
    const { element } = render();

    element.querySelector<HTMLAnchorElement>('.skip-link')?.click();

    expect(document.activeElement).toBe(element.querySelector('main'));
  });
});
