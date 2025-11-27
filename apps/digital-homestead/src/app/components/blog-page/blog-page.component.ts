import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { BlogComposeComponent } from '@optimistic-tanuki/blogging-ui';
import { BlogViewerComponent } from '../blog-viewer/blog-viewer.component';
import { BlogService, BlogPost } from '../../blog.service';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { AuthStateService } from '../../auth-state.service';
import { PermissionService } from '../../permission.service';

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
  ],
  templateUrl: './blog-page.component.html',
  styleUrl: './blog-page.component.scss',
})
export class BlogPageComponent implements OnInit, OnDestroy {
  route: ActivatedRoute = inject(ActivatedRoute);
  router: Router = inject(Router);
  blogService: BlogService = inject(BlogService);
  authState: AuthStateService = inject(AuthStateService);
  permissionService: PermissionService = inject(PermissionService);

  mode: 'create' | 'edit' | 'view' = 'view'; // Default to view mode for safety
  postId: string | null = null;
  post: BlogPost | null = null;
  loading = false;
  error: string | null = null;

  // Permission state
  isAuthenticated = false;
  hasFullAccess = false;
  permissionsLoaded = false;

  private subscriptions: Subscription[] = [];

  // Form data for the editor
  editorData: any = {
    title: '',
    content: '',
    links: [],
    attachments: [],
  };

  ngOnInit(): void {
    // Subscribe to authentication state
    this.subscriptions.push(
      this.authState.isAuthenticated$().subscribe((isAuth) => {
        this.isAuthenticated = isAuth;
        this.updateModeBasedOnPermissions();
      })
    );

    // Subscribe to permission state
    this.subscriptions.push(
      this.permissionService.hasFullAccess$().subscribe((hasAccess) => {
        this.hasFullAccess = hasAccess;
        this.updateModeBasedOnPermissions();
      })
    );

    this.subscriptions.push(
      this.permissionService.permissionsLoaded$().subscribe((loaded) => {
        this.permissionsLoaded = loaded;
        this.updateModeBasedOnPermissions();
      })
    );

    // Subscribe to route params
    this.subscriptions.push(
      this.route.params.subscribe((params) => {
        this.postId = params['id'] || null;

        if (this.postId) {
          // View mode - load the post
          this.mode = 'view';
          this.loadPost(this.postId);
        } else {
          // Check permissions for create mode
          this.updateModeBasedOnPermissions();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /**
   * Update the mode based on user permissions
   * - Users with owner/full access can create/edit
   * - Users without access can only view
   */
  private updateModeBasedOnPermissions(): void {
    // If we're looking at a specific post, keep view mode
    if (this.postId) {
      this.mode = 'view';
      return;
    }

    // For the blog list/create page
    if (this.hasFullAccess) {
      // User has permission to create
      if (this.mode !== 'edit') {
        this.mode = 'create';
      }
    } else {
      // User doesn't have permission - show read-only view
      this.mode = 'view';
    }
  }

  /**
   * Check if the user can edit/create blog posts
   */
  get canEdit(): boolean {
    return this.isAuthenticated && this.hasFullAccess;
  }

  loadPost(id: string): void {
    this.loading = true;
    this.error = null;

    this.blogService.getPost(id).subscribe({
      next: (post) => {
        this.post = post;
        this.editorData = {
          title: post.title,
          content: post.content,
          links: [],
          attachments: [],
        };
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load post: ' + err.message;
        this.loading = false;
        console.error('Error loading post:', err);
      },
    });
  }

  onPostSubmitted(postData: any): void {
    // Double-check permission before submitting
    if (!this.canEdit) {
      this.error = 'You do not have permission to create or edit blog posts.';
      return;
    }

    const authorId = this.authState.getProfileId();
    if (!authorId) {
      this.error = 'You must be logged in to create or edit blog posts.';
      return;
    }

    console.log('Post submitted:', postData);
    this.loading = true;
    this.error = null;

    const postPayload = {
      title: postData.title,
      content: postData.content,
      authorId: authorId,
    };

    if (this.mode === 'edit' && this.postId) {
      // Update existing post
      this.blogService.updatePost(this.postId, postPayload).subscribe({
        next: (updatedPost) => {
          this.post = updatedPost;
          this.mode = 'view';
          this.loading = false;
          console.log('Post updated successfully');
        },
        error: (err) => {
          this.error = 'Failed to update post: ' + err.message;
          this.loading = false;
          console.error('Error updating post:', err);
        },
      });
    } else {
      // Create new post
      this.blogService.createPost(postPayload).subscribe({
        next: (newPost) => {
          this.post = newPost;
          this.postId = newPost.id || null;
          this.mode = 'view';
          this.loading = false;
          console.log('Post created successfully');
          // Navigate to the new post's URL
          if (newPost.id) {
            this.router.navigate(['/blog', newPost.id]);
          }
        },
        error: (err) => {
          this.error = 'Failed to create post: ' + err.message;
          this.loading = false;
          console.error('Error creating post:', err);
        },
      });
    }
  }

  onEditClick(): void {
    // Check permission before allowing edit
    if (!this.canEdit) {
      this.error = 'You do not have permission to edit blog posts.';
      return;
    }

    this.mode = 'edit';
    if (this.post) {
      this.editorData = {
        title: this.post.title,
        content: this.post.content,
        links: [],
        attachments: [],
      };
    }
  }

  onCancelEdit(): void {
    if (this.postId) {
      this.mode = 'view';
    } else {
      this.router.navigate(['/blog']);
    }
  }
}
