import { TestBed } from '@angular/core/testing';
import { WorkerProfile } from '../../models/worker-profile.model';
import { workerProfile } from '../../testing/worker-profile.fixtures';
import { WorkerProfileSummaryComponent } from './worker-profile-summary.component';

describe('WorkerProfileSummaryComponent', () => {
  function render(profile: WorkerProfile): HTMLElement {
    const fixture = TestBed.createComponent(WorkerProfileSummaryComponent);
    fixture.componentRef.setInput('profile', profile);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the real status returned by the backend', () => {
    const element = render(workerProfile({ status: 'BORRADOR' }));

    expect(element.querySelector('.status-badge')?.textContent).toBe('Borrador');
    expect(element.querySelector('.status-badge')?.classList).toContain('status-badge--borrador');
    expect(element.textContent).toContain('aún no se envió a revisión');
  });

  it.each([
    ['PENDIENTE', 'Pendiente de revisión'],
    ['OBSERVADO', 'Observado'],
    ['APROBADO', 'Aprobado'],
    ['RECHAZADO', 'Rechazado'],
    ['SUSPENDIDO', 'Suspendido'],
  ] as const)('labels %s as "%s"', (status, label) => {
    expect(render(workerProfile({ status })).querySelector('.status-badge')?.textContent).toBe(
      label,
    );
  });

  it('shows experience, zone, specialties and pending requirements', () => {
    const element = render(workerProfile({ description: 'Instalaciones sanitarias' }));

    expect(element.textContent).toContain('Zona Norte');
    expect(element.querySelector('.summary__tags')?.textContent).toContain('Plomería');
    expect(element.textContent).toContain('Instalaciones sanitarias');
    const pending = Array.from(element.querySelectorAll('.summary__pending li')).map((item) =>
      item.textContent?.trim(),
    );
    expect(pending).toEqual([
      'Registre un teléfono de contacto en su cuenta',
      'Registre al menos un horario de atención activo',
    ]);
  });

  it('marks an inactive zone and inactive specialties', () => {
    const element = render(
      workerProfile({
        zone: { id: 'z', name: 'Zona Sur', isActive: false },
        zoneRequiresChange: true,
        specialties: [{ id: 'c', name: 'Albañilería', isActive: false }],
      }),
    );

    expect(element.textContent).toContain('(zona desactivada)');
    expect(element.textContent).toContain('(desactivada)');
  });

  it('hides optional sections without data', () => {
    const element = render(workerProfile({ description: null, pendingRequirements: [] }));

    expect(element.textContent).not.toContain('Descripción');
    expect(element.querySelector('.summary__pending')).toBeNull();
  });
});
