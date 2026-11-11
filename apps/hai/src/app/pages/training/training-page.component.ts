import { Component } from '@angular/core';
import { PageIntroComponent } from '../../components/page-intro/page-intro.component';
import { CapabilityGridComponent } from '../../components/shared/capability-grid.component';
import { CtaPanelComponent } from '../../components/shared/cta-panel.component';
import {
  TRAINING_AREA,
  TRAINING_AREA_HEADING,
  TRAINING_AUDIENCES,
  TRAINING_CTA,
  TRAINING_HERO,
  TRAINING_MODES,
  TRAINING_PHILOSOPHY,
  TRAINING_PHILOSOPHY_HEADING,
  TRAINING_TOPICS,
} from '../../content/training';

/** Training: who it is for, how people can learn, and what it covers. */
@Component({
  selector: 'hai-training-page',
  standalone: true,
  imports: [PageIntroComponent, CapabilityGridComponent, CtaPanelComponent],
  template: `
    <hai-page-intro
      [eyebrow]="hero.eyebrow"
      [title]="hero.title"
      [summary]="hero.summary"
      [action]="hero.action"
    ></hai-page-intro>
    <hai-capability-grid
      sectionId="who-its-for"
      eyebrow="Who it's for"
      heading="Wherever you are starting from."
      [capabilities]="audiences"
      [columns]="3"
    ></hai-capability-grid>
    <hai-capability-grid
      sectionId="ways-to-learn"
      eyebrow="How to learn"
      heading="Choose how you learn."
      [capabilities]="modes"
      [columns]="3"
    ></hai-capability-grid>
    <hai-capability-grid
      sectionId="topics"
      eyebrow="What we cover"
      heading="Three places to begin."
      [capabilities]="topics"
      [columns]="3"
    ></hai-capability-grid>
    <hai-capability-grid
      sectionId="approach"
      eyebrow="Our approach"
      [heading]="philosophyHeading"
      [capabilities]="philosophy"
      [columns]="2"
    ></hai-capability-grid>
    <hai-capability-grid
      sectionId="service-area"
      eyebrow="Service area"
      [heading]="areaHeading"
      [capabilities]="area"
      [columns]="1"
    ></hai-capability-grid>
    <hai-cta-panel
      [title]="cta.title"
      [text]="cta.text"
      [action]="cta.action"
    ></hai-cta-panel>
  `,
})
export class TrainingPageComponent {
  readonly hero = TRAINING_HERO;
  readonly audiences = TRAINING_AUDIENCES;
  readonly modes = TRAINING_MODES;
  readonly topics = TRAINING_TOPICS;
  readonly philosophyHeading = TRAINING_PHILOSOPHY_HEADING;
  readonly philosophy = TRAINING_PHILOSOPHY;
  readonly areaHeading = TRAINING_AREA_HEADING;
  readonly area = TRAINING_AREA;
  readonly cta = TRAINING_CTA;
}
