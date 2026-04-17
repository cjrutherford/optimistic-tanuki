import {
  Component,
  Input,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  signal,
  ViewChild,
  ViewContainerRef,
  ComponentRef,
  AfterViewInit,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import DOMPurify from 'dompurify';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Import common-ui components that can be injected
import {
  ButtonComponent,
  CardComponent,
  AccordionComponent,
  ModalComponent,
  HeroSectionComponent,
  ContentSectionComponent,
} from '@optimistic-tanuki/common-ui';
import { CalloutBoxComponent, CodeSnippetComponent, ImageGalleryComponent, InjectedComponentInstance, ComponentPersistenceService, HeroComponent, FeaturedPostsComponent, NewsletterSignupComponent } from '@optimistic-tanuki/blogging-ui';
import { BlogService } from '../../blog.service';
import { BlogComponentDto } from '@optimistic-tanuki/ui-models';

// Component map for reconstruction
const COMPONENT_MAP: Record<string, any> = {
  'callout-box': CalloutBoxComponent,
  'code-snippet': CodeSnippetComponent,
  // 'video-player': VideoPlayerComponent,
  'image-gallery': ImageGalleryComponent,
  // 'quote-block': QuoteBlockComponent,
  // 'timeline': TimelineComponent,
  // 'stats-display': StatsDisplayComponent,
  // 'pricing-table': PricingTableComponent,
  // 'testimonial': TestimonialComponent,
  // 'faq-item': FaqItemComponent,
  // 'social-share': SocialShareComponent,
  // Common UI component ids used by composer
  'common-button': ButtonComponent,
  'common-card': CardComponent,
  'common-accordion': AccordionComponent,
  'common-modal': ModalComponent,
  'common-hero-section': HeroSectionComponent,
  'common-content-section': ContentSectionComponent,
  // Blogging UI components
  'hero': HeroComponent,
  'featured-posts': FeaturedPostsComponent,
  'newsletter-signup': NewsletterSignupComponent,
};

@Component({
  selector: 'dh-blog-viewer',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    CardComponent,
    AccordionComponent,
    ModalComponent,
    HeroSectionComponent,
    ContentSectionComponent,
    CalloutBoxComponent,
    CodeSnippetComponent,
    ImageGalleryComponent,
    HeroComponent,
    FeaturedPostsComponent,
    NewsletterSignupComponent,
  ],
  template: `
    <article class="blog-viewer" *ngIf="!loading()">
      <header class="blog-header">
        <h1 class="blog-title">{{ title }}</h1>
        <div class="blog-meta">
          <span class="blog-author">By {{ authorId }}</span>
          <span class="blog-date" *ngIf="createdAt">{{
            createdAt | date : 'medium'
          }}</span>
        </div>
      </header>
      <div #contentContainer class="blog-content" [innerHTML]="sanitizedContent"></div>
    </article>
  `,
  styles: [
    `
      .blog-viewer {
        max-width: 100%;
        margin: 0 auto;
        padding: 2rem;
        box-sizing: border-box;
        overflow: hidden;
      }

      .draft-banner {
        background-color: #fff3cd;
        color: #856404;
        border: 1px solid #ffeeba;
        padding: 0.75rem 1.25rem;
        margin-bottom: 1rem;
        border-radius: 0.25rem;
        font-weight: bold;
        text-align: center;
      }

      .blog-header {
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid var(--local-border-color, #e0e0e0);
      }

      .blog-title {
        font-size: 2.5rem;
        margin: 0 0 1rem 0;
        color: var(--local-foreground, #333);
        overflow-wrap: break-word;
      }

      .blog-meta {
        display: flex;
        gap: 1rem;
        font-size: 0.9rem;
        color: var(--local-foreground, #666);
      }

      .blog-author {
        font-weight: 600;
      }

      .blog-content {
        font-size: 1.1rem;
        line-height: 1.8;
        color: var(--local-foreground, #333);
        max-width: 100%;
        overflow-wrap: break-word;
      }

      .blog-content :deep(h1) {
        font-size: 2rem;
        margin: 2rem 0 1rem 0;
      }

      .blog-content :deep(h2) {
        font-size: 1.75rem;
        margin: 1.75rem 0 0.75rem 0;
      }

      .blog-content :deep(h3) {
        font-size: 1.5rem;
        margin: 1.5rem 0 0.5rem 0;
      }

      .blog-content :deep(p) {
        margin: 1rem 0;
      }

      .blog-content :deep(img) {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        margin: 1.5rem 0;
      }

      .blog-content :deep(blockquote) {
        border-left: 4px solid var(--local-accent, #007bff);
        padding-left: 1rem;
        margin: 1.5rem 0;
        font-style: italic;
        color: var(--local-foreground, #555);
      }

      .blog-content :deep(code) {
        background: var(--local-background, #f5f5f5);
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
        font-family: monospace;
        font-size: 0.9em;
      }

      .blog-content :deep(pre) {
        background: var(--local-background, #f5f5f5);
        padding: 1rem;
        border-radius: 8px;
        overflow-x: auto;
        margin: 1.5rem 0;
        max-width: 100%;
      }

      .blog-content :deep(pre code) {
        background: none;
        padding: 0;
      }

      .blog-content :deep(ul),
      .blog-content :deep(ol) {
        margin: 1rem 0;
        padding-left: 2rem;
      }

      .blog-content :deep(li) {
        margin: 0.5rem 0;
      }

      .blog-content :deep(table) {
        width: 100%;
        max-width: 100%;
        border-collapse: collapse;
        margin: 1.5rem 0;
        display: block;
        overflow-x: auto;
      }

      .blog-content :deep(th),
      .blog-content :deep(td) {
        border: 1px solid var(--local-border-color, #ddd);
        padding: 0.75rem;
        text-align: left;
      }

      .blog-content :deep(th) {
        background: var(--local-background, #f5f5f5);
        font-weight: 600;
      }

      .blog-content :deep(.angular-component-node) {
        display: block;
        margin: 1.5rem 0;
      }

      .blog-content :deep(.component-placeholder) {
        padding: 1rem;
        border: 1px dashed var(--local-border-color, #ccc);
        border-radius: 4px;
        text-align: center;
        color: var(--local-foreground, #666);
        background: var(--local-background, #f9f9f9);
      }
    `,
  ],
})
export class BlogViewerComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() title = '';
  @Input() content = '';
  @Input() authorId = '';
  @Input() createdAt?: Date;
  @Input() postId?: string; // NEW: Post ID for component data loading

  @ViewChild('contentContainer', { read: ViewContainerRef })
  contentContainer?: ViewContainerRef;

  @ViewChild('contentContainer', { read: ElementRef })
  contentElement?: ElementRef<HTMLElement>;

  // Inject services
  private readonly blogService = inject(BlogService);
  private readonly componentPersistence = inject(ComponentPersistenceService);

  loading = signal(true);
  sanitizedContent = '';
  private componentRefs: ComponentRef<any>[] = [];
  private storedComponents: BlogComponentDto[] = [];

  ngOnInit() {
    this.loading.set(true);
    this.sanitizedContent = this.sanitizeContent(this.content);
    this.loadComponentData();
  }

  ngAfterViewInit() {
    // Reconstruct Angular components from HTML after view is initialized
    this.reconstructComponents();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['content']) {
      this.sanitizedContent = this.sanitizeContent(this.content);
      // If postId changed, reload component data
      if (changes['postId']) {
        this.loadComponentData();
      } else {
        // Just reconstruct with existing data
        setTimeout(() => this.reconstructComponents(), 0);
      }
    }
  }

  /**
   * Load component data from database
   */
  private async loadComponentData(): Promise<void> {
    if (!this.postId) {
      this.storedComponents = [];
      this.loading.set(false);
      return;
    }

    try {
      const components = await this.componentPersistence.getComponentsForPost(this.postId).toPromise();
      this.storedComponents = components || [];
      console.log('Loaded stored components:', this.storedComponents);
      this.loading.set(false);
      
      // Reconstruct components after data is loaded
      setTimeout(() => this.reconstructComponents(), 0);
    } catch (error) {
      console.error('Failed to load stored components:', error);
      this.storedComponents = [];
      this.loading.set(false);
      // Continue with reconstruction using fallback data
      setTimeout(() => this.reconstructComponents(), 0);
    }
  }

  ngOnDestroy() {
    // Clean up component references
    this.componentRefs.forEach(ref => ref.destroy());
    this.componentRefs = [];
  }

  /**
   * Reconstruct Angular components using stored database data
   */
  private sanitizeContent(html: string): string {
    return DOMPurify.sanitize(html, {
      ADD_ATTR: [
        'data-angular-component',
        'data-component-id',
        'data-instance-id',
        'data-component-data',
        'data-component-def'
      ],
    });
  }

  private reconstructComponents(): void {
    if (!this.contentElement || !this.contentContainer) {
      return;
    }

    // Clean up existing component refs
    this.componentRefs.forEach(ref => ref.destroy());
    this.componentRefs = [];

    // Find all component nodes in the content
    const componentNodes = this.contentElement.nativeElement.querySelectorAll('[data-angular-component]');
    console.log('[BlogViewer] reconstructComponents: nodes=', componentNodes.length, 'stored=', this.storedComponents.length);

    // Fallback: if no nodes in HTML but we have stored components, render them at the end
    if (componentNodes.length === 0 && this.storedComponents.length > 0) {
      this.storedComponents.forEach((comp) => {
        const placeholder = document.createElement('div');
        placeholder.setAttribute('data-angular-component', '');
        placeholder.classList.add('angular-component-node');
        this.contentElement!.nativeElement.appendChild(placeholder);
        try {
          this.createComponentFromStoredData(placeholder, comp);
        } catch (e) {
          console.error('[BlogViewer] Fallback render failed', e, comp);
        }
      });
      return;
    }

    componentNodes.forEach((node: Element) => {
      try {
        const instanceId = node.getAttribute('data-instance-id');
        if (!instanceId) {
          console.warn('Component node missing data-instance-id:', node);
          return;
        }

        // Find stored data for this component
        const storedComponent = this.storedComponents.find(c => c.instanceId === instanceId);
        if (storedComponent) {
          // Use stored component data
          this.createComponentFromStoredData(node as HTMLElement, storedComponent);
        } else {
          // Fallback to HTML attributes if no stored data found
          this.createComponentFromAttributes(node as HTMLElement);
        }

      } catch (error) {
        console.error('Error reconstructing component:', error, node);
      }
    });
  }

  /**
   * Create component using stored database data
   */
  private createComponentFromStoredData(node: HTMLElement, storedComponent: BlogComponentDto): void {
    const ComponentClass = COMPONENT_MAP[storedComponent.componentType];
    if (!ComponentClass) {
      console.warn(`Component not found in map: ${storedComponent.componentType}`);
      this.showComponentPlaceholder(node, storedComponent.componentType);
      return;
    }

    // Create component with stored data
    const componentRef = this.contentContainer!.createComponent(ComponentClass);
    
    // Apply stored component data
    const instance = componentRef.instance as any;
    Object.keys(storedComponent.componentData).forEach(key => {
      if (instance[key] !== undefined) {
        instance[key] = storedComponent.componentData[key];
      }
    });
    
    componentRef.changeDetectorRef.detectChanges();
    this.componentRefs.push(componentRef);
    
    // Replace entire placeholder node with the component host element for correct positioning
    node.replaceWith(componentRef.location.nativeElement);
  }

  /**
   * Fallback: Create component using HTML attributes (legacy support)
   */
  private createComponentFromAttributes(node: HTMLElement): void {
    const componentId = node.getAttribute('data-component-id');
    const dataStr = node.getAttribute('data-component-data');
    const componentDefStr = node.getAttribute('data-component-def');

    if (!componentId) {
      console.warn('Component node missing data-component-id:', node);
      return;
    }

    // Parse component data from attributes
    const componentData = dataStr ? JSON.parse(dataStr) : {};
    const componentDef = componentDefStr ? JSON.parse(componentDefStr) : null;

    // Get component class from map
    const ComponentClass = COMPONENT_MAP[componentId];
    if (!ComponentClass) {
      console.warn(`Component not found in map: ${componentId}`, node);
      this.showComponentPlaceholder(node, componentDef?.name || componentId);
      return;
    }

    // Create component instance
    const componentRef = this.contentContainer!.createComponent(ComponentClass);

    // Set component inputs from data
    const instance = componentRef.instance as any;
    Object.keys(componentData).forEach(key => {
      if (instance[key] !== undefined) {
        instance[key] = componentData[key];
      }
    });

    // Trigger change detection
    componentRef.changeDetectorRef.detectChanges();

    // Store reference for cleanup
    this.componentRefs.push(componentRef);

    // Replace entire placeholder node with the component host element
    node.replaceWith(componentRef.location.nativeElement);
  }

  /**
   * Show placeholder for unavailable components
   */
  private showComponentPlaceholder(node: HTMLElement, componentName: string): void {
    node.innerHTML = `<div class="component-placeholder" style="padding: 1rem; border: 1px dashed #ccc; border-radius: 4px; text-align: center; color: #666;">
      <strong>${componentName}</strong>
      <p style="margin: 0.5rem 0 0; font-size: 0.9rem;">Component not available in viewer</p>
    </div>`;
  }
}
