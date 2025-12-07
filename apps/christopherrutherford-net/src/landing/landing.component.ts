import { Component } from '@angular/core';

import { HeroComponent } from './hero/hero.component';
import { TitleBarComponent } from './title-bar/title-bar.component';
import { AboutComponent } from './about/about.component';
import { ProjectGridComponent } from './project-grid/project-grid.component';
import { ServicesGridComponent } from './services-grid/services-grid.component';
import { ContactComponent } from './contact/contact.component';

@Component({
  selector: 'app-landing',
  imports: [HeroComponent, TitleBarComponent, AboutComponent, ProjectGridComponent, ServicesGridComponent, ContactComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {}
