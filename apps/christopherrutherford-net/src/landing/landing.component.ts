import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroComponent } from './hero/hero.component';
import { TitleBarComponent } from './title-bar/title-bar.component';
import { AboutComponent } from './about/about.component';
import { ProjectGridComponent } from './project-grid/project-grid.component';
import { ServicesGridComponent } from './services-grid/services-grid.component';

@Component({
  selector: 'app-landing',
  imports: [CommonModule, HeroComponent, TitleBarComponent, AboutComponent, ProjectGridComponent, ServicesGridComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {}
