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
  AccordionComponent,
  ModalComponent,
  HeroSectionComponent,
  ContentSectionComponent,
  DropdownComponent,
} from '@optimistic-tanuki/common-ui';
import {
  CalloutBoxComponent,
  CodeSnippetComponent,
  ImageGalleryComponent,
} from '@optimistic-tanuki/compose-lib';
import { VoteComponent } from '../vote/vote.component';
import { ReactionComponent } from '../vote/reaction.component';
import { CommentComponent } from '../comment/comment.component';
import { CommentListComponent } from '../comment/comment-list/comment-list.component';
import {
  CommentDto,
  AttachmentDto,
  PostDto,
  CreateCommentDto,
  UpdatePostDto,
} from '../../models';
import {
  AssetAudienceRestriction,
  SocialComponentDto,
} from '@optimistic-tanuki/ui-models';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';
import { LinkType } from '../link/link.component';
import { ImageUploadCallback } from '..';
import { SocialComponentPersistenceService } from '../../services/social-component-persistence.service';

// Component map for dynamic reconstruction
const COMPONENT_MAP: Record<string, any> = {
  // Social UI example components from compose-lib
  'callout-box': CalloutBoxComponent,
  'code-snippet': CodeSnippetComponent,
  'image-gallery': ImageGalleryComponent,
  // Common UI components
  button: ButtonComponent,
  card: CardComponent,
  accordion: AccordionComponent,
  modal: ModalComponent,
  'hero-section': HeroSectionComponent,
  'content-section': ContentSectionComponent,
};

export declare type PostProfileStub = {
  id: string;
  name: string;
  avatar: string;
};

export type PostSaveState = {
  status: 'idle' | 'pending' | 'error' | 'saved';
  requestId: number;
  error?: string;
};

@Component({
  selector: 'lib-post',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    ButtonComponent,
    VoteComponent,
    ReactionComponent,
    CommentComponent,
    GridComponent,
    TileComponent,
    CommentListComponent,
    ProfilePhotoComponent,
    DropdownComponent,
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
  @Input() currentUserId: string = '';
  @Input() profileId: string = '';
  @Input() userVote: number = 0;
  @Input() voteCount: number = 0;
  @Input() userReaction: number = 0;
  @Input() reactionCounts: { [value: number]: number } = {};
  @Input() isSaved: boolean = false;
  theme: 'light' | 'dark' = 'light';

  @Input() content!: PostDto;
  @Input() comments: CommentDto[] = [];
  @Input() attachments: AttachmentDto[] = [];
  @Input() links: LinkType[] = [];
  @Input() canDelete = false;
  /** Enables the guardian scoped edit affordance; the server remains authoritative. */
  @Input() guardianManagementMode = false;
  @Input() canFollow = false;
  @Input() isFollowing = false;
  @Input() isBlocked = false;
  @Input() isMuted = false;
  @Input() ownedCommunities: { id: string; name: string }[] = [];
  @Input() imageUploadCallback?: ImageUploadCallback;
  @Input() communityInfo?: {
    id: string;
    name: string;
    logoUrl?: string;
    isPrivate?: boolean;
  };
  @Input() shareUrl: string = '';
  /** When provided, the parent owns save acknowledgement and retry state. */
  @Input() saveState?: PostSaveState;

  get commentImageUploadCallback(): ImageUploadCallback | undefined {
    if (!this.imageUploadCallback) return undefined;
    if (
      this.content?.communityId &&
      typeof this.communityInfo?.isPrivate !== 'boolean'
    ) {
      // Community metadata is fetched asynchronously. Never create an
      // unrestricted pending image while its membership policy is unknown.
      return async () => {
        throw new Error('Community audience is still loading');
      };
    }
    const restrictions: AssetAudienceRestriction[] = [];
    const memberOnly =
      this.content?.visibility === 'community' ||
      (this.content?.visibility === 'public' &&
        this.content?.publicAudienceExplicit === false);
    if (this.content?.visibility === 'followers' && this.content.profileId) {
      restrictions.push({
        type: 'followers',
        profileId: this.content.profileId,
      });
    }
    if (
      (memberOnly || this.communityInfo?.isPrivate) &&
      this.content?.communityId &&
      this.profileId
    ) {
      restrictions.push({
        type: 'community',
        profileId: this.profileId,
        communityId: this.content.communityId,
      });
    }
    return (dataUrl, fileName, existingRestrictions) =>
      this.imageUploadCallback!(dataUrl, fileName, [
        ...(existingRestrictions ?? []),
        ...restrictions,
      ]);
  }
  @Output() newCommentAdded: EventEmitter<CreateCommentDto> =
    new EventEmitter<CreateCommentDto>();
  @Output() postDeleted = new EventEmitter<void>();
  @Output() followToggle = new EventEmitter<void>();
  @Output() blockToggle = new EventEmitter<void>();
  @Output() muteToggle = new EventEmitter<void>();
  @Output() reportPost = new EventEmitter<void>();
  @Output() startChat = new EventEmitter<string>();
  @Output() profileClick = new EventEmitter<string>();
  @Output() voteChange = new EventEmitter<{ postId: string; value: number }>();
  @Output() reactionChange = new EventEmitter<{
    postId: string;
    value: number;
  }>();
  @Output() inviteToCommunity = new EventEmitter<string>();
  @Output() saveToggle = new EventEmitter<void>();
  @Output() postUpdated = new EventEmitter<UpdatePostDto>();

  // ViewChild references for component reconstruction
  @ViewChild('contentContainer', { read: ViewContainerRef })
  contentContainer?: ViewContainerRef;

  @ViewChild('contentContainer', { read: ElementRef })
  contentElement?: ElementRef<HTMLElement>;

  @ViewChild('postMenu') private postMenu?: DropdownComponent;
  @ViewChild('postMenu', { read: ElementRef })
  private postMenuElement?: ElementRef<HTMLElement>;

  // Services and state
  private readonly componentPersistence = inject(
    SocialComponentPersistenceService
  );
  private storedComponents: SocialComponentDto[] = [];
  private componentRefs: ComponentRef<any>[] = [];
  isEditing = false;
  editTitle = '';
  editContent = '';
  private acknowledgedSaveRequestId = 0;

  downloadAttachment(attachment: AttachmentDto) {
    console.log('Downloading attachment:', attachment);
  }

  openReport(): void {
    this.postMenu?.closeDropdown();
    this.postMenuElement?.nativeElement
      .querySelector<HTMLButtonElement>('.dropdown-trigger')
      ?.focus();
    this.reportPost.emit();
  }
  openLink(link: { url: string }) {
    console.log('Opening link:', link);
  }

  onDelete() {
    this.postDeleted.emit();
  }

  onFollowToggle() {
    this.followToggle.emit();
  }

  onBlockToggle() {
    this.blockToggle.emit();
  }

  onMuteToggle() {
    this.muteToggle.emit();
  }

  onInviteToCommunity(communityId: string) {
    this.inviteToCommunity.emit(communityId);
  }

  onSaveToggle() {
    this.saveToggle.emit();
  }

  onProfileClick() {
    if (this.profile?.id) {
      this.profileClick.emit(this.profile.id);
    }
  }

  canEdit(): boolean {
    return (
      this.guardianManagementMode ||
      (!!this.currentUserId && this.currentUserId === this.content?.profileId)
    );
  }

  get wasEdited(): boolean {
    if (!this.content?.updatedAt || !this.content?.createdAt) {
      return false;
    }

    return (
      new Date(this.content.updatedAt).getTime() !==
      new Date(this.content.createdAt).getTime()
    );
  }

  startEdit() {
    this.editTitle = this.content?.title || '';
    this.editContent = this.content?.content || '';
    this.isEditing = true;
  }

  cancelEdit() {
    this.isEditing = false;
    this.editTitle = '';
    this.editContent = '';
  }

  saveEdit() {
    if (this.saveState?.status === 'pending') return;
    this.postUpdated.emit({
      title: this.editTitle,
      content: this.editContent,
    });
    // Legacy consumers still close immediately. Controlled consumers keep the
    // draft visible until the parent supplies an authoritative saved post.
    if (!this.saveState) this.cancelEdit();
  }

  onEditTitleInput(event: Event) {
    this.editTitle = (event.target as HTMLInputElement).value;
  }

  onEditContentInput(event: Event) {
    this.editContent = (event.target as HTMLTextAreaElement).value;
  }

  get attachmentRows() {
    return Math.ceil(this.attachments.length / 6);
  }

  onCommentReply($event: { content: string; parentId: string }) {
    console.log('🚀 ~ PostComponent ~ onCommentReply ~ $event:', $event);
    const comment: CreateCommentDto = {
      content: $event.content,
      postId: this.content.id,
      profileId: this.profileId,
      parentId: $event.parentId,
    };
    this.newCommentAdded.emit(comment);
  }
  onCommentAdd($event: string) {
    console.log('🚀 ~ PostComponent ~ onCommentAdd ~ $event:', $event);
    const comment: CreateCommentDto = {
      content: $event,
      postId: this.content.id,
      profileId: this.profileId,
    };
    this.newCommentAdded.emit(comment);
  }

  onVoteChanged(event: { postId: string; value: number }) {
    this.voteChange.emit(event);
  }

  onReactionChanged(event: { postId: string; value: number }) {
    this.reactionChange.emit(event);
  }

  async onShare() {
    const shareUrl =
      this.shareUrl ||
      `${window.location.origin}/social/post/${this.content.id}/shared`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      console.log('Share URL copied to clipboard:', shareUrl);
    } catch (err) {
      console.error('Failed to copy share URL:', err);
    }
  }

  // Lifecycle hooks for component reconstruction

  ngAfterViewInit() {
    // Reconstruct Angular components from HTML after view is initialized
    this.loadComponentData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes['currentUserId'] &&
      !changes['currentUserId'].firstChange &&
      changes['currentUserId'].previousValue !==
        changes['currentUserId'].currentValue
    ) {
      this.cancelEdit();
    }
    if (
      changes['content'] &&
      !changes['content'].firstChange &&
      changes['content'].previousValue?.profileId !==
        changes['content'].currentValue?.profileId
    ) {
      this.cancelEdit();
    }
    if (changes['saveState']) {
      const state = this.saveState;
      if (state?.status === 'saved') {
        const isNewAcknowledgement =
          state.requestId > this.acknowledgedSaveRequestId;
        this.acknowledgedSaveRequestId = Math.max(
          this.acknowledgedSaveRequestId,
          state.requestId
        );
        if (
          isNewAcknowledgement &&
          changes['content'] &&
          !changes['content'].firstChange
        ) {
          this.cancelEdit();
        }
      }
    }
    if (
      changes['content'] &&
      !changes['content'].firstChange &&
      !this.saveState
    ) {
      // Preserve the historical behavior for consumers that have not opted
      // into parent-acknowledged save state.
      this.cancelEdit();
    }
    if (changes['content'] && !changes['content'].firstChange) {
      // Reload component data when content changes
      this.loadComponentData();
    }
  }

  ngOnDestroy() {
    // Clean up component references
    this.componentRefs.forEach((ref) => ref.destroy());
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
    this.componentRefs.forEach((ref) => ref.destroy());
    this.componentRefs = [];

    // Find all component nodes in the content
    const componentNodes = this.contentElement.nativeElement.querySelectorAll(
      '[data-angular-component]'
    );

    componentNodes.forEach((node: Element) => {
      try {
        const instanceId = node.getAttribute('data-instance-id');
        if (!instanceId) {
          console.warn(
            '[PostComponent] Component node missing data-instance-id:',
            node
          );
          return;
        }

        // Find stored data for this component
        const storedComponent = this.storedComponents.find(
          (c) => c.instanceId === instanceId
        );
        if (storedComponent) {
          // Use stored component data
          this.createComponentFromStoredData(
            node as HTMLElement,
            storedComponent
          );
        } else {
          console.warn(
            `[PostComponent] No stored data for component: ${instanceId}`
          );
        }
      } catch (error) {
        console.error(
          '[PostComponent] Error reconstructing component:',
          error,
          node
        );
      }
    });
  }

  /**
   * Create component using stored database data
   */
  private createComponentFromStoredData(
    node: HTMLElement,
    storedComponent: SocialComponentDto
  ): void {
    const ComponentClass = COMPONENT_MAP[storedComponent.componentType];
    if (!ComponentClass) {
      console.warn(
        `[PostComponent] Component not found in map: ${storedComponent.componentType}`
      );
      this.showComponentPlaceholder(node, storedComponent.componentType);
      return;
    }

    // Create component with stored data
    const componentRef = this.contentContainer!.createComponent(ComponentClass);

    // Apply stored component data
    const instance = componentRef.instance as any;
    Object.keys(storedComponent.componentData).forEach((key) => {
      if (instance[key] !== undefined) {
        instance[key] = storedComponent.componentData[key];
      }
    });

    componentRef.changeDetectorRef.detectChanges();
    this.componentRefs.push(componentRef);

    // Replace placeholder with component
    node.innerHTML = '';
    node.appendChild(componentRef.location.nativeElement);

    console.log(
      `[PostComponent] Component created: ${storedComponent.componentType} (${storedComponent.instanceId})`
    );
  }

  /**
   * Show placeholder for unknown component types
   */
  private showComponentPlaceholder(
    node: HTMLElement,
    componentType: string
  ): void {
    node.innerHTML = `
      <div class="component-placeholder" style="padding: 1rem; border: 1px dashed #ccc; border-radius: 4px; text-align: center; color: #666; background: #f9f9f9;">
        <strong>${componentType}</strong>
        <p>Component not available in viewer</p>
      </div>
    `;
  }
}
