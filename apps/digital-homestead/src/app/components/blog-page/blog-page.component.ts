import { Component, inject, signal, computed, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

import { BlogComposeComponent } from '@optimistic-tanuki/blogging-ui';
import { BlogViewerComponent } from '../blog-viewer/blog-viewer.component';
import { BlogService } from '../../blog.service';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { AuthStateService } from '../../auth-state.service';
import { PermissionService } from '../../permission.service';
import { BlogPostDto } from '@optimistic-tanuki/ui-models';

/**
 * Editor data matching the PostData interface from BlogComposeComponent
 */
interface PostData {
  title: string;
  content: string;
  links: { url: string }[];
  attachments: File[];
}

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
  ],
  templateUrl: './blog-page.component.html',
  styleUrl: './blog-page.component.scss',
})
export class BlogPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly blogService = inject(BlogService);
  private readonly authState = inject(AuthStateService);
  private readonly permissionService = inject(PermissionService);

  // Route params as signal
  private readonly routeParams = toSignal(this.route.params, {
    initialValue: {} as Record<string, string>,
  });

  // Signals for state management
  readonly posts = signal<BlogPostDto[]>([]);
  readonly selectedPost = signal<BlogPostDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<'view' | 'create' | 'edit'>('view');

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

  // Computed: can user edit
  readonly canEdit = computed(
    () => this.isAuthenticated() && this.hasFullAccess()
  );

  // Computed: get current post ID from route
  readonly currentPostId = computed(() => {
    const params = this.routeParams();
    return params['id'] || null;
  });

  // Flag to track if posts have been loaded
  private postsInitialized = false;

  // Effect to handle route changes
  private readonly routeEffect = effect(() => {
    const postId = this.currentPostId();

    // Load posts only once on initialization
    if (!this.postsInitialized) {
      this.postsInitialized = true;
      this.loadAllPosts();
    }

    if (postId) {
      // Load specific post
      this.loadPost(postId);
      this.mode.set('view');
    } else {
      // No post selected, show list view
      this.selectedPost.set(null);
      this.mode.set('view');
    }
  });

  /**
   * Load all blog posts for the sidebar
   */
  loadAllPosts(): void {
    this.loading.set(true);
    this.error.set(null);

    this.blogService.getAllPosts().subscribe({
      next: (posts) => {
        // Sort by date descending (newest first)
        const sortedPosts = [...posts].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.posts.set(sortedPosts);
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

    this.blogService.getPost(id).subscribe({
      next: (post) => {
        this.selectedPost.set(post);
        this.editorData.set({
          title: post.title,
          content: post.content,
          links: [],
          attachments: [],
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
    this.router.navigate(['/blog', post.id]);
  }

  /**
   * Start creating a new post (only if user has permission)
   */
  startCreatePost(): void {
    if (!this.canEdit()) {
      this.error.set('You do not have permission to create blog posts.');
      return;
    }
    this.mode.set('create');
    this.selectedPost.set(null);
    this.editorData.set({
      title: '',
      content: '',
      links: [],
      attachments: [],
    });
  }

  /**
   * Start editing the current post (only if user has permission)
   */
  startEditPost(): void {
    if (!this.canEdit()) {
      this.error.set('You do not have permission to edit blog posts.');
      return;
    }
    const post = this.selectedPost();
    if (post) {
      this.mode.set('edit');
      this.editorData.set({
        title: post.title,
        content: post.content,
        links: [],
        attachments: [],
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

    const postPayload = {
      title: postData.title,
      content: postData.content,
      authorId: authorId,
    };

    const currentMode = this.mode();
    const postId = this.currentPostId();

    if (currentMode === 'edit' && postId) {
      // Update existing post
      this.blogService.updatePost(postId, postPayload).subscribe({
        next: (updatedPost) => {
          this.selectedPost.set(updatedPost);
          this.mode.set('view');
          this.loading.set(false);
          // Update the post in the sidebar list
          this.updatePostInList(updatedPost);
        },
        error: (err) => {
          this.error.set('Failed to update post: ' + err.message);
          this.loading.set(false);
          console.error('Error updating post:', err);
        },
      });
    } else {
      // Create new post
      this.blogService.createPost(postPayload).subscribe({
        next: (newPost) => {
          this.selectedPost.set(newPost);
          this.mode.set('view');
          this.loading.set(false);
          // Add the new post to the sidebar list
          this.addPostToList(newPost);
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
  }

  /**
   * Format date for display
   */
  formatDate(date: Date | string): string {
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
    const currentPosts = this.posts();
    this.posts.set([post, ...currentPosts]);
  }

  /**
   * Update an existing post in the posts list
   */
  private updatePostInList(updatedPost: BlogPostDto): void {
    const currentPosts = this.posts();
    const updatedPosts = currentPosts.map((post) =>
      post.id === updatedPost.id ? updatedPost : post
    );
    this.posts.set(updatedPosts);
  }
}
