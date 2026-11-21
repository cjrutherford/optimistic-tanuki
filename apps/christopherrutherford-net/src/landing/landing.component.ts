import { AfterViewInit, Component, inject } from '@angular/core';
import { SectionScrollService } from './section-scroll.service';

import { HeroComponent } from './hero/hero.component';
import { TitleBarComponent } from './title-bar/title-bar.component';
import { AboutComponent } from './about/about.component';
import { ApproachComponent } from './approach/approach.component';
import { ExperienceComponent } from './experience/experience.component';
import { WorkshopComponent } from './workshop/workshop.component';
import { ServicesGridComponent } from './services-grid/services-grid.component';
import { ContactComponent } from './contact/contact.component';
import { CaseStudiesComponent } from './case-studies/case-studies.component';

@Component({
  selector: 'app-landing',
  imports: [
    HeroComponent,
    TitleBarComponent,
    AboutComponent,
    ApproachComponent,
    ExperienceComponent,
    WorkshopComponent,
    ServicesGridComponent,
    ContactComponent,
    CaseStudiesComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements AfterViewInit {
  private readonly sectionScroll = inject(SectionScrollService);

  /** A direct load of `/#experience` scrolls to the section once it exists. */
  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) this.sectionScroll.scrollTo(id);
  }
}
