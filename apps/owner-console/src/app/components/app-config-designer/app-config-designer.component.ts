import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import {
  TextInputComponent,
  TextAreaComponent,
  CheckboxComponent,
} from '@optimistic-tanuki/form-ui';
import {
  AppConfiguration,
  Section,
  SectionType,
  HeroSection,
  FeaturesSection,
  ContentSection,
  GridSection,
  CTASection,
  FooterSection,
  FeaturesConfig,
  ThemeConfig,
} from '@optimistic-tanuki/app-config-models';
import { AppConfigService } from '../../services/app-config.service';
import { SectionSelectorComponent } from './section-editors/section-selector.component';
import { SectionEditorComponent } from './section-editors/section-editor.component';

/**
 * App Configuration Designer Component
 *
 * Visual designer interface for creating and editing application configurations.
 * Features drag-and-drop section management, theme customization, and feature toggles.
 */
@Component({
  selector: 'app-config-designer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatIconModule,
    DragDropModule,
    ButtonComponent,
    CardComponent,
    TextInputComponent,
    TextAreaComponent,
    CheckboxComponent,
    SectionSelectorComponent,
    SectionEditorComponent,
  ],
  templateUrl: './app-config-designer.component.html',
  styleUrls: ['./app-config-designer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default, // Using Default for FormsModule compatibility
})
export class AppConfigDesignerComponent implements OnInit {
  @Input() configId?: string;
  @Output() saved = new EventEmitter<AppConfiguration>();
  @Output() cancelled = new EventEmitter<void>();

  config: Omit<AppConfiguration, 'id'> = {
    name: '',
    description: '',
    domain: '',
    landingPage: {
      sections: [],
      layout: 'single-column',
    },
    routes: [],
    features: {
      social: { enabled: false },
      tasks: { enabled: false },
      blogging: {
        enabled: false,
        allowComments: false,
        moderateComments: false,
      },
      projectPlanning: {
        enabled: false,
        showGantt: false,
        showKanban: false,
        allowRisks: false,
      },
    },
    theme: {
      primaryColor: '#3f51b5',
      secondaryColor: '#ff4081',
      backgroundColor: '#ffffff',
      textColor: '#000000',
      fontFamily: 'Roboto, sans-serif',
      customCss: '',
    },
    active: true,
  };

  selectedTab = 0;
  isSectionSelectorVisible = false;
  isSectionEditorVisible = false;
  selectedSection: Section | null = null;
  selectedSectionIndex = -1;

  constructor(
    private appConfigService: AppConfigService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check for route parameter first
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.configId = id;
        this.loadConfiguration(id);
      } else if (this.configId) {
        // Fallback to input property
        this.loadConfiguration(this.configId);
      }
    });
  }

  get customCss(): string {
    return this.config.theme?.customCss || '';
  }

  get customFonts(): string {
    return this.config.theme?.fontFamily || '';
  }

  get customText(): string {
    return this.config.theme?.textColor || '';
  }

  loadConfiguration(id: string): void {
    console.log('[AppConfigDesigner] Loading configuration:', id);
    this.appConfigService.getConfiguration(id).subscribe({
      next: (config) => {
        console.log('[AppConfigDesigner] Loaded configuration:', config);
        this.config = config;
      },
      error: (err) => {
        console.error('[AppConfigDesigner] Failed to load configuration:', err);
        alert(`Failed to load configuration: ${err.message || err.statusText || 'Unknown error'}`);
      },
    });
  }

  // Section Management
  onSectionDrop(event: CdkDragDrop<Section[]>): void {
    if (this.config.landingPage?.sections) {
      moveItemInArray(
        this.config.landingPage.sections,
        event.previousIndex,
        event.currentIndex
      );
      this.updateSectionOrders();
    }
  }

  updateSectionOrders(): void {
    if (this.config.landingPage?.sections) {
      this.config.landingPage.sections.forEach((section, index) => {
        section.order = index;
      });
    }
  }

  showSectionSelector(): void {
    this.isSectionSelectorVisible = true;
  }

  hideSectionSelector(): void {
    this.isSectionSelectorVisible = false;
  }

  onSectionTypeSelected(sectionType: SectionType): void {
    const newSection = this.createDefaultSection(sectionType);
    if (this.config.landingPage?.sections) {
      this.config.landingPage.sections.push(newSection);
      this.updateSectionOrders();
    }
    this.hideSectionSelector();
  }

  createDefaultSection(type: SectionType): Section {
    const baseSection = {
      id: `${type}-${Date.now()}`,
      type,
      order: this.config.landingPage?.sections?.length || 0,
      visible: true,
    };

    switch (type) {
      case 'hero':
        return {
          ...baseSection,
          type: 'hero',
          title: 'Welcome',
          subtitle: '',
          backgroundImage: '',
          ctaText: '',
          ctaLink: '',
        } as HeroSection;
      case 'features':
        return {
          ...baseSection,
          type: 'features',
          title: 'Features',
          features: [],
        } as FeaturesSection;
      case 'content':
        return {
          ...baseSection,
          type: 'content',
          title: '',
          content: '',
          imageUrl: '',
          imagePosition: 'left',
        } as ContentSection;
      case 'grid':
        return {
          ...baseSection,
          type: 'grid',
          title: '',
          columns: 3,
          items: [],
        } as GridSection;
      case 'cta':
        return {
          ...baseSection,
          type: 'cta',
          title: 'Call to Action',
          description: '',
          buttonText: 'Get Started',
          buttonLink: '#',
        } as CTASection;
      case 'footer':
        return {
          ...baseSection,
          type: 'footer',
          content: '',
          links: [],
        } as FooterSection;
      default:
        throw new Error(`Unknown section type: ${type}`);
    }
  }

  editSection(section: Section, index: number): void {
    this.selectedSection = { ...section };
    this.selectedSectionIndex = index;
    this.isSectionEditorVisible = true;
  }

  deleteSection(index: number): void {
    if (
      this.config.landingPage?.sections &&
      confirm('Are you sure you want to delete this section?')
    ) {
      this.config.landingPage.sections.splice(index, 1);
      this.updateSectionOrders();
    }
  }

  toggleSectionVisibility(section: Section): void {
    section.visible = !section.visible;
  }

  onSectionEditorSave(updatedSection: Section): void {
    if (this.config.landingPage?.sections && this.selectedSectionIndex >= 0) {
      this.config.landingPage.sections[this.selectedSectionIndex] =
        updatedSection;
    }
    this.hideSectionEditor();
  }

  hideSectionEditor(): void {
    this.isSectionEditorVisible = false;
    this.selectedSection = null;
    this.selectedSectionIndex = -1;
  }

  getSectionIcon(type: SectionType): string {
    const icons: Record<SectionType, string> = {
      hero: 'landscape',
      features: 'stars',
      content: 'article',
      grid: 'grid_view',
      cta: 'campaign',
      footer: 'footer',
    };
    return icons[type] || 'extension';
  }

  getSectionTitle(section: Section): string {
    switch (section.type) {
      case 'hero':
        return (section as HeroSection).title || 'Hero Section';
      case 'features':
        return (section as FeaturesSection).title || 'Features Section';
      case 'content':
        return (section as ContentSection).title || 'Content Section';
      case 'grid':
        return (section as GridSection).title || 'Grid Section';
      case 'cta':
        return (section as CTASection).title || 'CTA Section';
      case 'footer':
        return 'Footer Section';
      default:
        return 'Section';
    }
  }

  // Save/Cancel Actions
  onSave(): void {
    if (!this.config.name) {
      alert('Please provide a name for the configuration');
      return;
    }

    console.log('[AppConfigDesigner] Saving configuration:', this.config);

    if (this.configId) {
      console.log('[AppConfigDesigner] Updating existing configuration:', this.configId);
      this.appConfigService
        .updateConfiguration(this.configId, this.config)
        .subscribe({
          next: (updated) => {
            console.log('[AppConfigDesigner] Configuration updated:', updated);
            alert('Configuration saved successfully!');
            this.saved.emit(updated);
            this.router.navigate(['/dashboard/app-config']);
          },
          error: (err) => {
            console.error('[AppConfigDesigner] Failed to update configuration:', err);
            alert(`Failed to save configuration: ${err.message || err.statusText || 'Unknown error'}`);
          },
        });
    } else {
      console.log('[AppConfigDesigner] Creating new configuration');
      this.appConfigService.createConfiguration(this.config as any).subscribe({
        next: (created) => {
          console.log('[AppConfigDesigner] Configuration created:', created);
          alert('Configuration created successfully!');
          this.saved.emit(created);
          this.router.navigate(['/dashboard/app-config']);
        },
        error: (err) => {
          console.error('[AppConfigDesigner] Failed to create configuration:', err);
          alert(`Failed to save configuration: ${err.message || err.statusText || 'Unknown error'}`);
        },
      });
    }
  }

  onCancel(): void {
    if (confirm('Are you sure you want to discard changes?')) {
      this.cancelled.emit();
      this.router.navigate(['/dashboard/app-config']);
    }
  }
}
