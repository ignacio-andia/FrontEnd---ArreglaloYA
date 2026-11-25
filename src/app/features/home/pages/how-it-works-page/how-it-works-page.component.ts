import { Component } from '@angular/core';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';

/** Página pública «Cómo funciona». */
@Component({
  selector: 'app-how-it-works-page',
  imports: [HowItWorksComponent],
  template: `
    <section class="home home--public" aria-labelledby="how-title">
      <header>
        <h1 id="how-title" class="home__title">Cómo funciona</h1>
        <p class="home__intro">Contrate un servicio técnico para su hogar en tres pasos.</p>
      </header>
      <app-how-it-works />
    </section>
  `,
  styleUrl: '../../home-page.scss',
})
export class HowItWorksPageComponent {}
