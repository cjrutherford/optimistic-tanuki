import { Component } from '@angular/core';
import { PageIntroComponent } from '../../components/page-intro/page-intro.component';
import { AssessmentFormComponent } from '../../components/assessment/assessment-form.component';
import { ASSESSMENT_NEXT_STEPS } from '../../content/assessment';

@Component({
  selector: 'hai-assessment-page',
  standalone: true,
  imports: [PageIntroComponent, AssessmentFormComponent],
  template: `
    <hai-page-intro
      eyebrow="Private cloud"
      title="Private cloud assessment"
      summary="A few questions about what you keep and who uses it. It takes a few minutes, and there is no obligation."
    ></hai-page-intro>
    <section class="next-steps" aria-labelledby="next-steps-heading">
      <h2 id="next-steps-heading">What happens next</h2>
      <ol>
        @for (step of nextSteps; track step) {
        <li>{{ step }}</li>
        }
      </ol>
    </section>
    <hai-assessment-form></hai-assessment-form>
  `,
  styles: `
    .next-steps {
      margin-top: 1.5rem;
    }
    .next-steps h2 {
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
    }
    .next-steps ol {
      margin: 0;
      padding-left: 1.25rem;
      line-height: 1.7;
      color: color-mix(in srgb, var(--foreground) 80%, transparent);
    }
  `,
})
export class AssessmentPageComponent {
  readonly nextSteps = ASSESSMENT_NEXT_STEPS;
}
