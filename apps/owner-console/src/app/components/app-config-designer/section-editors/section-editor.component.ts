import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent, TextAreaComponent } from '@optimistic-tanuki/form-ui';
import {
  Section,
  HeroSection,
  FeaturesSection,
  ContentSection,
  GridSection,
  CTASection,
  FooterSection,
} from '@optimistic-tanuki/app-config-models';

@Component({
  selector: 'app-section-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ButtonComponent,
    CardComponent,
    TextInputComponent,
    TextAreaComponent,
  ],
  templateUrl: './section-editor.component.html',
  styleUrls: ['./section-editor.component.scss'],
})
export class SectionEditorComponent implements OnInit {
  @Input() section!: Section;
  @Output() sectionSaved = new EventEmitter<Section>();
  @Output() closed = new EventEmitter<void>();

  editedSection!: Section;

  ngOnInit(): void {
    this.editedSection = JSON.parse(JSON.stringify(this.section));
  }

  onSave(): void {
    this.sectionSaved.emit(this.editedSection);
  }

  onClose(): void {
    this.closed.emit();
  }

  // Hero Section Methods
  asHero(): HeroSection {
    return this.editedSection as HeroSection;
  }

  // Features Section Methods
  asFeatures(): FeaturesSection {
    return this.editedSection as FeaturesSection;
  }

  addFeature(): void {
    const features = this.asFeatures();
    if (!features.features) {
      features.features = [];
    }
    features.features.push({
      icon: '',
      title: 'New Feature',
      description: '',
    });
  }

  removeFeature(index: number): void {
    const features = this.asFeatures();
    features.features.splice(index, 1);
  }

  // Content Section Methods
  asContent(): ContentSection {
    return this.editedSection as ContentSection;
  }

  // Grid Section Methods
  asGrid(): GridSection {
    return this.editedSection as GridSection;
  }

  addGridItem(): void {
    const grid = this.asGrid();
    if (!grid.items) {
      grid.items = [];
    }
    grid.items.push({
      title: 'New Item',
      description: '',
      imageUrl: '',
      link: '',
    });
  }

  removeGridItem(index: number): void {
    const grid = this.asGrid();
    grid.items.splice(index, 1);
  }

  // CTA Section Methods
  asCTA(): CTASection {
    return this.editedSection as CTASection;
  }

  // Footer Section Methods
  asFooter(): FooterSection {
    return this.editedSection as FooterSection;
  }

  addFooterLink(): void {
    const footer = this.asFooter();
    if (!footer.links) {
      footer.links = [];
    }
    footer.links.push({
      text: 'Link',
      url: '#',
    });
  }

  removeFooterLink(index: number): void {
    const footer = this.asFooter();
    if (footer.links) {
      footer.links.splice(index, 1);
    }
  }
}
