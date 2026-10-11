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
  styleUrl: './assessment-page.component.scss',
})
export class AssessmentPageComponent {
  readonly nextSteps = ASSESSMENT_NEXT_STEPS;
}
