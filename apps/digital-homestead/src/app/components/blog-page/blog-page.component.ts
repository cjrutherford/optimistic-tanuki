import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, Subscription, forkJoin } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { map } from 'rxjs/operators';

import { BlogComposeComponent, ComponentPersistenceService } from '@optimistic-tanuki/blogging-ui';
import { BlogViewerComponent } from '../blog-viewer/blog-viewer.component';
import { BlogService } from '../../blog.service';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { AuthStateService } from '../../auth-state.service';
import { PermissionService } from '../../permission.service';
import {
  BlogPostDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
  CreateBlogComponentDto,
  BlogComponentCommands,
} from '@optimistic-tanuki/ui-models';
import { ThemeDesignerComponent } from '@optimistic-tanuki/theme-ui';
import { PostThemeConfig, InjectedComponentData } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Editor data matching the PostData interface from BlogComposeComponent
 */
interface PostData {
  title: string;
  content: string;
  links: { url: string }[];
  attachments: File[];
  themeConfig?: PostThemeConfig;
  injectedComponents?: any[]; // Old format
  injectedComponentsNew?: InjectedComponentData[]; // New format
}

/**
 * Type for save action - determines if saving as draft or publishing
 */
type SaveAction = 'draft' | 'publish';

@Component({
  selector: 'dh-blog-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    BlogComposeComponent,
    BlogViewerComponent,
    ButtonComponent,
    CardComponent,
    ThemeDesignerComponent,
  ],
  templateUrl: './blog-page.component.html',
  styleUrl: './blog-page.component.scss',
})
export class BlogPageComponent implements OnDestroy {
  @ViewChild('blogCompose') blogCompose?: BlogComposeComponent;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly blogService = inject(BlogService);
  private readonly authState = inject(AuthStateService);
  private readonly permissionService = inject(PermissionService);
  private readonly componentPersistence = inject(ComponentPersistenceService);
  private readonly http = inject(HttpClient);

  // Gateway URL for RPC calls
  private readonly gatewayUrl = 'http://localhost:3000'; // TODO: Use environment config

  // Auto-save subject
  private readonly editorChange$ = new Subject<PostData>();
  private readonly autoSaveSub: Subscription;

  // Route params as signal
  private readonly routeParams = toSignal(this.route.params, {
    initialValue: {} as Record<string, string>,
  });

  // Signals for state management
  private readonly allPosts = signal<BlogPostDto[]>([]);
  readonly selectedPost = signal<BlogPostDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<'view' | 'create' | 'edit'>('view');
  readonly pendingSaveAction = signal<SaveAction>('draft');
  readonly showThemeDesigner = signal(false);

  // Editor form data
  readonly editorData = signal<PostData>({
    title: '',
    content: '',
    links: [],
    attachments: [],
  });

  // Auth state as signals
  readonly isAuthenticated = toSignal(this.authState.isAuthenticated$(), {
    initialValue: false,
  });
  readonly hasFullAccess = toSignal(this.permissionService.hasFullAccess$(), {
    initialValue: false,
  });
  readonly permissionsLoaded = toSignal(
    this.permissionService.permissionsLoaded$(),
    { initialValue: false }
  );

  readonly profileId = computed(() => {
    const profile = this.authState.getProfileId();
    return profile || undefined;
  })

  // Computed: can user edit
  readonly canEdit = computed(
    () => this.isAuthenticated() && this.hasFullAccess()
  );

  // Computed: filtered and sorted posts
  readonly posts = computed(() => {
    const all = this.allPosts();
    const canViewDrafts = this.canEdit();

    // Filter: Show all if canEdit, otherwise only non-drafts
    const filtered = canViewDrafts ? all : all.filter((post) => !post.isDraft);

    // Sort: Newest first
    return [...filtered].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  // Computed: get current post ID from route
  readonly currentPostId = computed(() => {
    const params = this.routeParams();
    return params['id'] || null;
  });

  // Computed: check if selected post is a draft
  readonly isSelectedPostDraft = computed(() => {
    const post = this.selectedPost();
    return post?.isDraft ?? false;
  });

  // Computed: check if current user owns the selected post
  readonly isPostOwner = computed(() => {
    const post = this.selectedPost();
    const profileId = this.authState.getProfileId();
    return post && profileId && post.authorId === profileId;
  });

  // Effect to load posts when authentication state changes
  private readonly authEffect = effect(
    () => {
      // Establish dependency on auth state
      this.isAuthenticated();
      this.loadAllPosts();
    },
    { allowSignalWrites: true }
  );

  // Effect to handle route changes
  private readonly routeEffect = effect(
    () => {
      const postId = this.currentPostId();

      if (postId) {
        // Load specific post
        this.loadPost(postId);
        this.mode.set('view');
      } else {
        // No post selected, show list view
        this.selectedPost.set(null);
        this.mode.set('view');
      }
    },
    { allowSignalWrites: true }
  );

  constructor() {
    this.autoSaveSub = this.editorChange$
      .pipe(debounceTime(1000))
      .subscribe((data) => this.handleAutoSave(data));
  }

  ngOnDestroy(): void {
    this.autoSaveSub.unsubscribe();
  }

  /**
   * Handle changes from the editor
   */
  onEditorChange(data: PostData): void {
    // Only process changes in create/edit mode
    if (this.mode() !== 'view') {
      this.editorData.set(data);
      this.editorChange$.next(data);
    }
  }

  /**
   * Auto-save components when content changes
   */
  private handleAutoSave(data: PostData): void {
    const postId = this.currentPostId();
    // Verify we have a post ID and components to save
    if (postId && this.hasInjectedComponents(data.content)) {
      const components = this.componentPersistence.extractComponentsFromContent(data.content);
      
      if (components.length > 0) {
        console.log('Auto-saving components...', components.length);
        // We use the same service method which handles updates/creations
        // Ideally we should differentiate between inserting vs updating specific components
        // For now, we reuse the batch save approach which is robust but maybe not optimal for single changes
        
        // Strategy: First delete old components then save new ones to ensure sync
        // In a more optimized version we would track diffs
        this.componentPersistence.deleteComponentsByPost(postId).subscribe({
          next: () => {
            this.componentPersistence.saveComponents(postId, components).subscribe({
              next: () => console.log('Auto-save complete'),
              error: (err) => console.error('Auto-save failed', err)
            });
          },
          error: (err) => console.error('Auto-save cleanup failed', err)
        });
      }
    }
  }

  /**
   * Load all blog posts for the sidebar
   */
  loadAllPosts(): void {
    this.loading.set(true);
    this.error.set(null);

    this.blogService.getAllPosts().subscribe({
      next: (posts) => {
        this.allPosts.set(posts);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load posts: ' + err.message);
        this.loading.set(false);
        console.error('Error loading posts:', err);
      },
    });
  }

  /**
   * Load a specific blog post
   */
  loadPost(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    // Load post and its components
    forkJoin({
      post: this.blogService.getPost(id),
      components: this.componentPersistence.getComponentsForPost(id)
    }).subscribe({
      next: ({ post, components }) => {
        this.selectedPost.set(post);
        
        // Map stored components to InjectedComponentInstance format expected by editor
        const injectedComponents = components.map(comp => ({
          instanceId: comp.instanceId,
          // We map componentData to data for the editor
          data: comp.componentData,
          componentDef: { id: comp.componentType } as any // Minimal def needed if any
        }));

        this.editorData.set({
          title: post.title,
          content: post.content,
          links: [],
          attachments: [],
          themeConfig: post.themeConfig,
          injectedComponents: injectedComponents as any[]
        });
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load post: ' + err.message);
        this.loading.set(false);
        console.error('Error loading post:', err);
      },
    });
  }

  /**
   * Navigate to a specific post
   */
  selectPost(post: BlogPostDto): void {
    if (post.isDraft && !this.isAuthenticated()) {
      this.error.set('You must be signed in to view draft posts.');
      return;
    }

    this.router.navigate(['/blog', post.id]);
  }

  /**
   * Start creating a new post - immediately creates a draft
   */
  startCreatePost(): void {
    if (!this.canEdit()) {
      this.error.set('You do not have permission to create blog posts.');
      return;
    }

    const authorId = this.authState.getProfileId();
    if (!authorId) {
      this.error.set('You must be logged in to create blog posts.');
      return;
    }

    this.loading.set(true);
    
    // Create a draft post immediately
    const createData: CreateBlogPostDto = {
      title: 'Untitled Draft',
      content: '',
      authorId,
      isDraft: true
    };

    this.blogService.createPost(createData).subscribe({
      next: (post) => {
        this.loading.set(false);
        this.selectedPost.set(post);
        this.addPostToList(post);
        
        // Setup editor with the new draft
        this.editorData.set({
          title: post.title,
          content: post.content,
          links: [],
          attachments: [],
          themeConfig: post.themeConfig
        });
        
        // Set mode to edit since we now have a real post ID
        this.mode.set('edit');
        
        // Navigate to the new post URL
        this.router.navigate(['/blog', post.id]);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set('Failed to create draft post: ' + err.message);
        console.error('Error creating draft:', err);
      }
    });
  }

  /**
   * Edit the selected post
   */
  editPost(post: BlogPostDto): void {
    this.mode.set('edit');
    this.editorData.set({
      title: post.title,
      content: post.content,
      links: post.links || [],
      attachments: [],
      themeConfig: post.themeConfig,
    });
  }

  /**
   * Save the post (draft or publish)
   */
  savePost(action: SaveAction): void {
    const authorId = this.authState.getProfileId();
    if (!authorId) {
      this.error.set('Unable to save post: User not authenticated.');
      return;
    }

    const selectedPost = this.selectedPost();
    if (selectedPost && action === 'publish') {
      const postId = selectedPost.id;
      this.blogService.publishDraft(postId).subscribe({
        next: (post) => {
          console.log('Published post:', post);
          this.loadAllPosts();
          this.mode.set('view');
        },
        error: (err) => {
          this.error.set(`Failed to publish post: ${err.message}`);
          console.error('Error publishing post:', err);
        },
      });
    } else if (selectedPost) {
      const updateData: UpdateBlogPostDto = {
        id: selectedPost.id,
        title: this.editorData().title,
        content: this.editorData().content,
        authorId,
        isDraft: action === 'draft',
        themeConfig: this.editorData().themeConfig,
      };
      this.blogService.updatePost(selectedPost.id, updateData).subscribe({
        next: (post) => {
          console.log('Updated post:', post);
          this.loadAllPosts();
          this.mode.set('view');
        },
        error: (err) => {
          this.error.set(`Failed to update post: ${err.message}`);
          console.error('Error updating post:', err);
        },
      });
    } else {
      const createData: CreateBlogPostDto = {
        title: this.editorData().title,
        content: this.editorData().content,
        authorId,
        isDraft: action === 'draft',
        themeConfig: this.editorData().themeConfig,
      };
      this.blogService.createPost(createData).subscribe({
        next: (post) => {
          console.log('Saved post:', post);
          this.loadAllPosts();
          this.mode.set('view');
        },
        error: (err) => {
          this.error.set(`Failed to save post: ${err.message}`);
          console.error('Error saving post:', err);
        },
      });
    }
  }

  /**
   * Cancel editing and return to view mode
   */
  cancelEdit(): void {
    this.mode.set('view');
    const postId = this.currentPostId();
    if (postId) {
      this.loadPost(postId);
    } else {
      this.router.navigate(['/blog']);
    }
  }

  /**
   * Save as draft - sets pending action and triggers form submission
   */
  saveAsDraft(): void {
    this.pendingSaveAction.set('draft');
    if (this.blogCompose) {
      this.blogCompose.onPostSubmit();
    }
  }

  /**
   * Publish - sets pending action and triggers form submission
   */
  publishPost(): void {
    this.pendingSaveAction.set('publish');
    if (this.blogCompose) {
      this.blogCompose.onPostSubmit();
    }
  }

  /**
   * Publish an existing draft post
   */
  publishDraft(): void {
    const post = this.selectedPost();
    if (!post || !post.id) {
      this.error.set('No post selected to publish.');
      return;
    }

    if (!this.isPostOwner()) {
      this.error.set('You can only publish your own posts.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.blogService.publishPost(post.id).subscribe({
      next: (publishedPost) => {
        this.selectedPost.set(publishedPost);
        this.updatePostInList(publishedPost);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to publish post: ' + err.message);
        this.loading.set(false);
        console.error('Error publishing post:', err);
      },
    });
  }

  /**
   * Handle post submission (create or update)
   */
  onPostSubmitted(postData: PostData): void {
    if (!this.canEdit()) {
      this.error.set(
        'You do not have permission to create or edit blog posts.'
      );
      return;
    }

    const authorId = this.authState.getProfileId();
    if (!authorId) {
      this.error.set('You must be logged in to create or edit blog posts.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const saveAction = this.pendingSaveAction();
    const postId = this.currentPostId();
    const currentMode = this.mode();

    // Check if post has components that need persistence (new format preferred)
    const hasComponents = postData.injectedComponentsNew && postData.injectedComponentsNew.length > 0;
    console.log('[BlogPage] Post has components:', hasComponents, postData.injectedComponentsNew);

    if (currentMode === 'edit' && postId) {
      this.updatePostWithComponentsNew(postData, postId, authorId, saveAction);
    } else {
      // For new posts with components, always create as draft first
      if (hasComponents) {
        this.createDraftWithComponentsNew(postData, authorId, saveAction);
      } else {
        this.createPostDirectly(postData, authorId, saveAction);
      }
    }
  }

  /**
   * Check if content has injectable components
   */
  private hasInjectedComponents(content: string): boolean {
    return content.includes('data-angular-component');
  }

  /**
   * Create post as draft first to get ID for component persistence
   */
  private createDraftWithComponents(postData: PostData, authorId: string, finalAction: SaveAction): void {
    // Extract components before cleaning content
    const components = this.componentPersistence.extractComponentsFromContent(postData.content);
    const cleanedContent = this.componentPersistence.cleanContentForStorage(postData.content);

    const draftPayload = {
      title: postData.title,
      content: cleanedContent,
      authorId: authorId,
      isDraft: true,
      themeConfig: postData.themeConfig,
    };

    this.blogService.createPost(draftPayload).subscribe({
      next: (createdPost) => {
        // Save components with the new post ID
        if (components.length > 0) {
          this.componentPersistence.saveComponents(createdPost.id, components).subscribe({
            next: (savedComponents) => {
              console.log('Components saved:', savedComponents);
              this.handlePostCreateSuccess(createdPost, finalAction);
            },
            error: (err) => {
              console.error('Failed to save components:', err);
              this.error.set('Failed to save post components: ' + err.message);
              this.loading.set(false);
            }
          });
        } else {
          this.handlePostCreateSuccess(createdPost, finalAction);
        }
      },
      error: (err) => {
        this.error.set('Failed to create post: ' + err.message);
        this.loading.set(false);
        console.error('Error creating post:', err);
      },
    });
  }

  /**
   * Create post directly without component persistence
   */
  private createPostDirectly(postData: PostData, authorId: string, saveAction: SaveAction): void {
    const isDraft = saveAction === 'draft';
    const cleanedContent = this.cleanInjectedContent(postData.content);

    const postPayload = {
      title: postData.title,
      content: cleanedContent,
      authorId: authorId,
      isDraft: isDraft,
      themeConfig: postData.themeConfig,
    };

    this.blogService.createPost(postPayload).subscribe({
      next: (newPost) => {
        this.loading.set(false);
        this.selectedPost.set(newPost);
        this.addPostToList(newPost);
        this.mode.set('view');

        if (newPost.id) {
          this.router.navigate(['/blog', newPost.id]);
        }
      },
      error: (err) => {
        this.error.set('Failed to create post: ' + err.message);
        this.loading.set(false);
        console.error('Error creating post:', err);
      },
    });
  }

  /**
   * Update existing post with component persistence
   */
  private updatePostWithComponents(postData: PostData, postId: string, authorId: string, saveAction: SaveAction): void {
    const isDraft = saveAction === 'draft';

    // Extract and save components if content has them
    const hasComponents = this.hasInjectedComponents(postData.content);
    if (hasComponents) {
      const components = this.componentPersistence.extractComponentsFromContent(postData.content);
      const cleanedContent = this.componentPersistence.cleanContentForStorage(postData.content);

      // First save components, then update post
      this.componentPersistence.deleteComponentsByPost(postId).subscribe({
        next: () => {
          if (components.length > 0) {
            this.componentPersistence.saveComponents(postId, components).subscribe({
              next: (savedComponents) => {
                console.log('Components updated:', savedComponents);
                this.updatePostContent(postId, postData, cleanedContent, authorId, isDraft);
              },
              error: (err) => {
                console.error('Failed to save updated components:', err);
                this.error.set('Failed to save post components: ' + err.message);
                this.loading.set(false);
              }
            });
          } else {
            this.updatePostContent(postId, postData, cleanedContent, authorId, isDraft);
          }
        },
        error: (err) => {
          console.error('Failed to delete old components:', err);
          this.error.set('Failed to update post components: ' + err.message);
          this.loading.set(false);
        }
      });
    } else {
      // No components, update directly
      const cleanedContent = this.cleanInjectedContent(postData.content);
      this.updatePostContent(postId, postData, cleanedContent, authorId, isDraft);
    }
  }

  /**
   * Update post content in database
   */
  private updatePostContent(postId: string, postData: PostData, content: string, authorId: string, isDraft: boolean): void {
    const postPayload = {
      id: postId,
      title: postData.title,
      content: content,
      authorId: authorId,
      isDraft: isDraft,
      themeConfig: postData.themeConfig,
    };

    this.blogService.updatePost(postId, postPayload).subscribe({
      next: (updatedPost) => {
        this.loading.set(false);
        this.selectedPost.set(updatedPost);
        this.updatePostInList(updatedPost);
        this.mode.set('view');

        if (updatedPost.id) {
          this.router.navigate(['/blog', updatedPost.id]);
        }
      },
      error: (err) => {
        this.error.set('Failed to update post: ' + err.message);
        this.loading.set(false);
        console.error('Error updating post:', err);
      },
    });
  }

  /**
   * Handle successful post creation and optionally publish
   */
  private handlePostCreateSuccess(createdPost: any, finalAction: SaveAction): void {
    if (finalAction === 'publish') {
      // Publish the draft
      this.blogService.publishPost(createdPost.id).subscribe({
        next: (publishedPost) => {
          this.loading.set(false);
          this.selectedPost.set(publishedPost);
          this.addPostToList(publishedPost);
          this.mode.set('view');

          if (publishedPost.id) {
            this.router.navigate(['/blog', publishedPost.id]);
          }
        },
        error: (err) => {
          this.error.set('Post created but failed to publish: ' + err.message);
          this.loading.set(false);
          console.error('Error publishing post:', err);
          // Still show the draft post
          this.selectedPost.set(createdPost);
          this.addPostToList(createdPost);
          this.mode.set('view');
          if (createdPost.id) {
            this.router.navigate(['/blog', createdPost.id]);
          }
        }
      });
    } else {
      // Keep as draft
      this.loading.set(false);
      this.selectedPost.set(createdPost);
      this.addPostToList(createdPost);
      this.mode.set('view');

      if (createdPost.id) {
        this.router.navigate(['/blog', createdPost.id]);
      }
    }
  }

  /**
   * Create post with components using new format
   */
  private async createDraftWithComponentsNew(postData: PostData, authorId: string, finalAction: SaveAction): Promise<void> {
    try {
      // Create post first
      const draftPayload: CreateBlogPostDto = {
        title: postData.title,
        content: postData.content,
        authorId: authorId,
        isDraft: true,
        themeConfig: postData.themeConfig,
      };

      const createdPost = await firstValueFrom(this.blogService.createPost(draftPayload));
      console.log('[BlogPage] Post created:', createdPost.id);

      // Save components if available
      if (postData.injectedComponentsNew && postData.injectedComponentsNew.length > 0) {
        await this.saveComponentsNew(createdPost.id, postData.injectedComponentsNew);
        console.log('[BlogPage] Components saved for post:', createdPost.id);
      }

      // Handle publish if needed
      this.handlePostCreateSuccess(createdPost, finalAction);
    } catch (err: any) {
      this.error.set('Failed to create post: ' + err.message);
      this.loading.set(false);
      console.error('Error creating post with components:', err);
    }
  }

  /**
   * Update post with components using new format
   */
  private async updatePostWithComponentsNew(postData: PostData, postId: string, authorId: string, saveAction: SaveAction): Promise<void> {
    try {
      // Update post content
      const updateData: UpdateBlogPostDto = {
        id: postId,
        title: postData.title,
        content: postData.content,
        authorId,
        isDraft: saveAction === 'draft',
        themeConfig: postData.themeConfig,
      };

      const updatedPost = await firstValueFrom(this.blogService.updatePost(postId, updateData));
      console.log('[BlogPage] Post updated:', postId);

      // Update components
      if (postData.injectedComponentsNew) {
        // Delete old components first
        await this.deleteComponentsByPostId(postId);
        
        // Save new components
        if (postData.injectedComponentsNew.length > 0) {
          await this.saveComponentsNew(postId, postData.injectedComponentsNew);
          console.log('[BlogPage] Components updated for post:', postId);
        }
      }

      this.loading.set(false);
      this.selectedPost.set(updatedPost);
      this.updatePostInList(updatedPost);
      this.mode.set('view');

      if (updatedPost.id) {
        this.router.navigate(['/blog', updatedPost.id]);
      }
    } catch (err: any) {
      this.error.set('Failed to update post: ' + err.message);
      this.loading.set(false);
      console.error('Error updating post with components:', err);
    }
  }

  /**
   * Save components to database using RPC
   */
  private async saveComponentsNew(blogPostId: string, components: InjectedComponentData[]): Promise<void> {
    console.log('[BlogPage] Saving components:', components);
    
    for (const component of components) {
      const dto: CreateBlogComponentDto = {
        blogPostId,
        instanceId: component.instanceId,
        componentType: component.componentType,
        componentData: component.componentData,
        position: component.position || 0,
      };

      try {
        await firstValueFrom(
          this.http.post(`${this.gatewayUrl}/blogging`, {
            cmd: BlogComponentCommands.CREATE,
            data: dto,
          })
        );
        console.log('[BlogPage] Component saved:', component.instanceId);
      } catch (error) {
        console.error('[BlogPage] Failed to save component:', component.instanceId, error);
        throw error;
      }
    }
  }

  /**
   * Delete all components for a post using RPC
   */
  private async deleteComponentsByPostId(blogPostId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.gatewayUrl}/blogging`, {
          cmd: BlogComponentCommands.DELETE_BY_POST,
          data: { blogPostId },
        })
      );
      console.log('[BlogPage] Components deleted for post:', blogPostId);
    } catch (error) {
      console.error('[BlogPage] Failed to delete components:', error);
      // Don't throw - continue with saving new components
    }
  }

  cleanInjectedContent(content: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const nodes = doc.querySelectorAll('div.angular-component-node');

    nodes.forEach((node) => {
      const data = node.getAttribute('data');
      if (data) {
        try {
          const parsedData = JSON.parse(data);
          node.setAttribute('data', JSON.stringify(parsedData));
        } catch (error) {
          console.error('Failed to parse data attribute:', error);
        }
      }
    });

    return doc.body.innerHTML;
  }

  /**
   * Format date for display
   */
  formatDate(date: Date | string | null): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Dismiss error message
   */
  dismissError(): void {
    this.error.set(null);
  }

  /**
   * Add a new post to the beginning of the posts list
   */
  private addPostToList(post: BlogPostDto): void {
    const currentPosts = this.allPosts();
    this.allPosts.set([post, ...currentPosts]);
  }

  /**
   * Update an existing post in the posts list
   */
  private updatePostInList(updatedPost: BlogPostDto): void {
    const currentPosts = this.allPosts();
    const updatedPosts = currentPosts.map((post) =>
      post.id === updatedPost.id ? updatedPost : post
    );
    this.allPosts.set(updatedPosts);
  }

  /**
   * Toggle theme designer visibility
   */
  toggleThemeDesigner(): void {
    this.showThemeDesigner.set(!this.showThemeDesigner());
  }
}
