import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BlogComposeComponent } from '@optimistic-tanuki/blogging-ui';
import { BlogViewerComponent } from '../blog-viewer/blog-viewer.component';
import { BlogService, BlogPost } from '../../blog.service';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'dh-blog-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BlogComposeComponent,
    BlogViewerComponent,
    ButtonComponent,
  ],
  templateUrl: './blog-page.component.html',
  styleUrl: './blog-page.component.scss',
})
export class BlogPageComponent implements OnInit {
  route: ActivatedRoute = inject(ActivatedRoute);
  router: Router = inject(Router);
  blogService: BlogService = inject(BlogService);

  mode: 'create' | 'edit' | 'view' = 'create';
  postId: string | null = null;
  post: BlogPost | null = null;
  loading = false;
  error: string | null = null;

  // Form data for the editor
  editorData: any = {
    title: '',
    content: '',
    links: [],
    attachments: [],
  };

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.postId = params['id'] || null;

      if (this.postId) {
        // View mode - load the post
        this.mode = 'view';
        this.loadPost(this.postId);
      } else {
        // Create mode
        this.mode = 'create';
      }
    });
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
    console.log('Post submitted:', postData);
    this.loading = true;
    this.error = null;

    const postPayload = {
      title: postData.title,
      content: postData.content,
      authorId: 'current-user', // TODO: Get from authentication service
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
