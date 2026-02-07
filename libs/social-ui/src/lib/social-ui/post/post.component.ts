import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ViewContainerRef,
  ElementRef,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ComponentRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ButtonComponent,
  CardComponent,
  GridComponent,
  TileComponent,
  // CalloutBoxComponent,
  // CodeSnippetComponent,
  // VideoPlayerComponent,
  // ImageGalleryComponent,
  // QuoteBlockComponent,
  // TimelineComponent,
  // StatsDisplayComponent,
  // PricingTableComponent,
  // TestimonialComponent,
  // FaqItemComponent,
  // SocialShareComponent,
  AccordionComponent,
  ModalComponent,
  HeroSectionComponent,
  ContentSectionComponent,
} from '@optimistic-tanuki/common-ui';
import { VoteComponent } from '../vote/vote.component';
import { CommentComponent } from '../comment/comment.component';
import { CommentListComponent } from '../comment/comment-list/comment-list.component';
import {
  CommentDto,
  AttachmentDto,
  PostDto,
  CreateCommentDto,
} from '../../models';
import { SocialComponentDto } from '@optimistic-tanuki/ui-models';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';
import { LinkType } from '../link/link.component';
import { ImageUploadCallback } from '..';
import { SocialComponentPersistenceService } from '../../services/social-component-persistence.service';

// Component map for dynamic reconstruction
const COMPONENT_MAP: Record<string, any> = {
  // 'callout-box': CalloutBoxComponent,
  // 'code-snippet': CodeSnippetComponent,
  // 'video-player': VideoPlayerComponent,
  // 'image-gallery': ImageGalleryComponent,
  // 'quote-block': QuoteBlockComponent,
  // 'timeline': TimelineComponent,
  // 'stats-display': StatsDisplayComponent,
  // 'pricing-table': PricingTableComponent,
  // 'testimonial': TestimonialComponent,
  // 'faq-item': FaqItemComponent,
  // 'social-share': SocialShareComponent,
  'button': ButtonComponent,
  'card': CardComponent,
  'accordion': AccordionComponent,
  'modal': ModalComponent,
  'hero-section': HeroSectionComponent,
  'content-section': ContentSectionComponent,
};

export declare type PostProfileStub = {
  id: string;
  name: string;
  avatar: string;
};

@Component({
  selector: 'lib-post',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    ButtonComponent,
    VoteComponent,
    CommentComponent,
    GridComponent,
    TileComponent,
    CommentListComponent,
    ProfilePhotoComponent,
  ],
  providers: [],
  templateUrl: './post.component.html',
  styleUrl: './post.component.scss',
})
export class PostComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() profile: PostProfileStub | null = {
    id: '',
    name: 'unknown',
    avatar: 'https://placehold.co/300x300',
  };
  @Input() availableProfiles: { [key: string]: PostProfileStub } = {};
  theme: 'light' | 'dark' = 'light';

  @Input() content!: PostDto;
  @Input() comments: CommentDto[] = [];
  @Input() attachments: AttachmentDto[] = [];
  @Input() links: LinkType[] = [];
  @Input() canDelete = false;
  @Input() canFollow = false;
  @Input() isFollowing = false;
  @Input() imageUploadCallback?: ImageUploadCallback;
  @Output() newCommentAdded: EventEmitter<CreateCommentDto> =
    new EventEmitter<CreateCommentDto>();
  @Output() postDeleted = new EventEmitter<void>();
  @Output() followToggle = new EventEmitter<void>();

  // ViewChild references for component reconstruction
  @ViewChild('contentContainer', { read: ViewContainerRef })
  contentContainer?: ViewContainerRef;

  @ViewChild('contentContainer', { read: ElementRef })
  contentElement?: ElementRef<HTMLElement>;

  // Services and state
  private readonly componentPersistence = inject(SocialComponentPersistenceService);
  private storedComponents: SocialComponentDto[] = [];
  private componentRefs: ComponentRef<any>[] = [];

  downloadAttachment(attachment: AttachmentDto) {
    // Logic to download the attachment
    console.log('Downloading attachment:', attachment);
  }
  openLink(link: { url: string }) {
    // Logic to open the link
    console.log('Opening link:', link);
  }

  onDelete() {
    this.postDeleted.emit();
  }

  onFollowToggle() {
    this.followToggle.emit();
  }

  get attachmentRows() {
    return Math.ceil(this.attachments.length / 6);
  }

  onCommentReply($event: { content: string; parentId: string }) {
    console.log('🚀 ~ PostComponent ~ onCommentReply ~ $event:', $event);
    const comment: CreateCommentDto = {
      content: $event.content,
      postId: this.content.id,
      profileId: '',
      parentId: $event.parentId,
    };
    this.newCommentAdded.emit(comment);
  }
  onCommentAdd($event: string) {
    console.log('🚀 ~ PostComponent ~ onCommentAdd ~ $event:', $event);
    const comment: CreateCommentDto = {
      content: $event,
      postId: this.content.id,
      profileId: '',
    };
    this.newCommentAdded.emit(comment);
  }

  // Lifecycle hooks for component reconstruction

  ngAfterViewInit() {
    // Reconstruct Angular components from HTML after view is initialized
    this.loadComponentData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['content'] && !changes['content'].firstChange) {
      // Reload component data when content changes
      this.loadComponentData();
    }
  }

  ngOnDestroy() {
    // Clean up component references
    this.componentRefs.forEach(ref => ref.destroy());
    this.componentRefs = [];
  }

  /**
   * Load component data from database
   */
  private async loadComponentData(): Promise<void> {
    if (!this.content?.id) {
      this.storedComponents = [];
      return;
    }

    try {
      const components = await this.componentPersistence
        .getComponentsForPost(this.content.id)
        .toPromise();
      this.storedComponents = components || [];
      console.log('[PostComponent] Loaded components:', this.storedComponents);

      // Reconstruct components after data is loaded
      setTimeout(() => this.reconstructComponents(), 0);
    } catch (error) {
      console.error('[PostComponent] Failed to load components:', error);
      this.storedComponents = [];
      // Continue with reconstruction using fallback
      setTimeout(() => this.reconstructComponents(), 0);
    }
  }

  /**
   * Reconstruct Angular components using stored database data
   */
  private reconstructComponents(): void {
    if (!this.contentElement || !this.contentContainer) {
      return;
    }

    // Clean up existing component refs
    this.componentRefs.forEach(ref => ref.destroy());
    this.componentRefs = [];

    // Find all component nodes in the content
    const componentNodes = this.contentElement.nativeElement.querySelectorAll(
      '[data-angular-component]'
    );

    componentNodes.forEach((node: Element) => {
      try {
        const instanceId = node.getAttribute('data-instance-id');
        if (!instanceId) {
          console.warn('[PostComponent] Component node missing data-instance-id:', node);
          return;
        }

        // Find stored data for this component
        const storedComponent = this.storedComponents.find(c => c.instanceId === instanceId);
        if (storedComponent) {
          // Use stored component data
          this.createComponentFromStoredData(node as HTMLElement, storedComponent);
        } else {
          console.warn(`[PostComponent] No stored data for component: ${instanceId}`);
        }

      } catch (error) {
        console.error('[PostComponent] Error reconstructing component:', error, node);
      }
    });
  }

  /**
   * Create component using stored database data
   */
  private createComponentFromStoredData(node: HTMLElement, storedComponent: SocialComponentDto): void {
    const ComponentClass = COMPONENT_MAP[storedComponent.componentType];
    if (!ComponentClass) {
      console.warn(`[PostComponent] Component not found in map: ${storedComponent.componentType}`);
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

    // Replace placeholder with component
    node.innerHTML = '';
    node.appendChild(componentRef.location.nativeElement);

    console.log(`[PostComponent] Component created: ${storedComponent.componentType} (${storedComponent.instanceId})`);
  }

  /**
   * Show placeholder for unknown component types
   */
  private showComponentPlaceholder(node: HTMLElement, componentType: string): void {
    node.innerHTML = `
      <div class="component-placeholder" style="padding: 1rem; border: 1px dashed #ccc; border-radius: 4px; text-align: center; color: #666; background: #f9f9f9;">
        <strong>${componentType}</strong>
        <p>Component not available in viewer</p>
      </div>
    `;
  }
}
