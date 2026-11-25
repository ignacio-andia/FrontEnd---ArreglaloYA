import { Component } from '@angular/core';

interface Step {
  title: string;
  description: string;
}

const STEPS: readonly Step[] = [
  {
    title: 'Publique su pedido',
    description:
      'Elija la categoría y la zona, describa el problema, indique su presupuesto y adjunte de 1 a 4 fotografías.',
  },
  {
    title: 'Reciba ofertas',
    description:
      'Los trabajadores con perfil aprobado de su zona y especialidad pueden ver el pedido y enviarle ofertas.',
  },
  {
    title: 'Acuerde y pague directamente',
    description:
      'Usted elige la oferta. El pago se realiza directamente entre las partes: ArreglaloYA no procesa dinero.',
  },
];

/** Pasos de la contratación de un servicio. El título de la sección lo pone quien la usa. */
@Component({
  selector: 'app-how-it-works',
  template: `
    <ol class="steps">
      @for (step of steps; track step.title; let index = $index) {
        <li class="step">
          <span class="step__number" aria-hidden="true">{{ index + 1 }}</span>
          <p class="step__title">{{ step.title }}</p>
          <p class="step__description">{{ step.description }}</p>
        </li>
      }
    </ol>
  `,
  styles: `
    @use 'tokens';
    @use 'mixins';

    :host {
      display: block;
    }

    .steps {
      display: grid;
      gap: tokens.$space-4;
      margin: 0;
      padding: 0;
      list-style: none;

      @include mixins.respond-up(md) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    .step {
      display: grid;
      align-content: start;
      gap: tokens.$space-2;
      padding: tokens.$space-6;
      border: 1px solid var(--color-border);
      border-radius: tokens.$radius-lg;
      background-color: var(--color-surface);
    }

    .step__number {
      display: inline-grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background-color: var(--color-primary);
      color: #fff;
      font-weight: tokens.$font-weight-semibold;
    }

    .step__title {
      color: var(--color-primary-dark);
      font-weight: tokens.$font-weight-semibold;
    }

    .step__description {
      color: var(--color-text-secondary);
    }
  `,
})
export class HowItWorksComponent {
  protected readonly steps = STEPS;
}
