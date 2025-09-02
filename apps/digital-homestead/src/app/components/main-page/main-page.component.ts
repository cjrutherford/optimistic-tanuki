import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AboutComponent } from '../about/about.component';
import { HeroComponent } from '../hero/hero.component';
import { BlogSectionComponent } from '../blog-section/blog-section.component';
import { CommunityComponent } from '../community/community.component';
import { ContactComponent } from '../contact/contact.component';
import { FooterComponent } from '../footer/footer.component';
import { BenefitsComponent } from '../benefits/benefits.component';
import { ResourcesComponent } from '../resources/resources.component';

@Component({
  selector: 'dh-main-page',
  imports: [
    CommonModule,
    HeroComponent,
    AboutComponent,
    BenefitsComponent,
    CommunityComponent,
    ResourcesComponent,
    BlogSectionComponent,
    ContactComponent,
    FooterComponent,
  ],
  templateUrl: './main-page.component.html',
  styleUrl: './main-page.component.scss',
})
export class MainPageComponent {}
