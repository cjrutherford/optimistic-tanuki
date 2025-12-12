import { Component, OnInit, OnDestroy, Input } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import {
  PostDto,
  ComposeComponent,
  PostComponent,
  CreatePostDto,
  CreateCommentDto,
  PostData,
  ImageUploadCallback,
} from '@optimistic-tanuki/social-ui';
import { CreateAttachmentDto } from '@optimistic-tanuki/ui-models';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { PostService } from '../../post.service';
import { AttachmentService } from '../../attachment.service';
import { filter, firstValueFrom, Subject, takeUntil } from 'rxjs';
import { CommentService } from '../../comment.service';
import { ProfileService } from '../../profile.service';
import { Router } from '@angular/router';
import { PostProfileStub } from '@optimistic-tanuki/social-ui';
import { SocialWebSocketService } from '../../social-websocket.service';
import { AssetService } from '../../asset.service';
import { CreateAssetDto } from '@optimistic-tanuki/models';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    ComposeComponent,
    PostComponent,
  ],
  providers: [ThemeService, PostService, AttachmentService, CommentService, SocialWebSocketService, AssetService],
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class FeedComponent implements OnInit, OnDestroy {
  @Input() posts: PostDto[] = [];
  themeStyles!: {
    backgroundColor: string;
    color: string;
    border: string;
  };
  destroy$ = new Subject<void>();
  
  // Image upload callback for the compose component
  imageUploadCallback: ImageUploadCallback = async (dataUrl: string, fileName: string): Promise<string> => {
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) {
      throw new Error('No current profile found');
    }

    // Extract file extension from data URL
    const fileExtension = this.getFileExtensionFromDataUrl(dataUrl);
    
    const assetDto: CreateAssetDto = {
      name: fileName,
      profileId: currentProfile.id,
      type: 'image',
      content: dataUrl,
      fileExtension: fileExtension,
    };

    try {
      const asset = await firstValueFrom(this.assetService.createAsset(assetDto));
      return this.assetService.getAssetUrl(asset.id);
    } catch (error) {
      console.error('Failed to upload image to asset service:', error);
      throw error;
    }
  };

  constructor(
    private readonly themeService: ThemeService,
    private readonly postService: PostService,
    private readonly attachmentService: AttachmentService,
    private readonly commentService: CommentService,
    private readonly profileService: ProfileService,
    private readonly router: Router,
    private readonly socialWebSocketService: SocialWebSocketService,
    private readonly assetService: AssetService
  ) {}

  ngOnInit() {
    this.themeService.themeColors$
      .pipe(
        filter((d) => !!d),
        takeUntil(this.destroy$)
      )
      .subscribe((colors) => {
        this.themeStyles = {
          backgroundColor: colors.background,
          color: colors.foreground,
          border: `1px solid ${colors.accent}`,
        };
      });
    
    const currentProfile = this.profileService.currentUserProfile();
    if (currentProfile) {
      // Connect to WebSocket
      this.socialWebSocketService.connect();
      
      // Subscribe to WebSocket connection status
      this.socialWebSocketService.getConnectionStatus()
        .pipe(takeUntil(this.destroy$))
        .subscribe((connected) => {
          if (connected) {
            console.log('WebSocket connected, loading feed...');
            // Get initial feed via WebSocket
            this.socialWebSocketService.getFeed(currentProfile.id, 50, 0);
            // Subscribe to all posts updates
            this.socialWebSocketService.subscribeToPosts(currentProfile.id);
          }
        });
      
      // Subscribe to posts from WebSocket
      this.socialWebSocketService.getPosts()
        .pipe(takeUntil(this.destroy$))
        .subscribe((posts) => {
          console.log('Received posts from WebSocket:', posts.length);
          this.posts = posts;
          this.loadProfiles(posts);
        });
      
      // Fallback to HTTP if WebSocket doesn't connect within 5 seconds
      setTimeout(() => {
        if (!this.socialWebSocketService.isConnected() && this.posts.length === 0) {
          console.log('WebSocket not connected, falling back to HTTP');
          this.postService
            .searchPosts(
              { profileId: currentProfile.id },
              { orderBy: 'createdAt', orderDirection: 'desc' }
            )
            .pipe(takeUntil(this.destroy$))
            .subscribe((posts) => {
              this.posts = posts;
              this.loadProfiles(posts);
            });
        }
      }, 5000);
    } else {
      this.router.navigate(['/profile']);
    }
  }
  profiles: { [key: string]: PostProfileStub } = {};

  private loadProfiles(posts: PostDto[]) {
    const profileIds: string[] = [
      ...new Set(
        posts
          .flatMap((post) => [
            post.profileId,
            ...(post.comments?.map((comment) => comment.profileId) || []),
          ])
          .filter((x): x is string => !!x)
      ),
    ];
    profileIds.forEach((profileId) => {
      this.profileService.getDisplayProfile(profileId).subscribe((profile) => {
        this.profiles[profileId] = {
          id: profile.id,
          name: profile.profileName,
          avatar: profile.profilePic,
        };
      });
    });
  }

  createdPost(postData: PostData) {
    console.log('create called.');
    const { title, content, attachments, links } = postData;
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) {
      console.error('No current profile found');
      return;
    }
    const finalPost: CreatePostDto = {
      title,
      content,
      profileId: currentProfile.id,
    };
    this.postService.createPost(finalPost).subscribe(async (newPost) => {
      if (attachments.length > 0) {
        for (const attachment of attachments) {
          const atta: CreateAttachmentDto = {
            ...attachment,
            postId: newPost.id,
          };
          await firstValueFrom(this.attachmentService.createAttachment(atta));
        }
      }
      this.posts.unshift(newPost);
    });
  }

  ngOnDestroy() {
    const currentProfile = this.profileService.currentUserProfile();
    if (currentProfile) {
      // Unsubscribe from WebSocket topics
      this.socialWebSocketService.unsubscribeFromPosts(currentProfile.id);
      // Disconnect WebSocket
      this.socialWebSocketService.disconnect();
    }
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  commented(newComment: CreateCommentDto, postIndex: number) {
    console.log('🚀 ~ FeedComponent ~ commented ~ newComment:', newComment);
    newComment.postId = this.posts[postIndex].id;
    newComment.profileId = this.profileService.currentUserProfile()!.id;
    this.commentService.createComment(newComment).subscribe({
      next: (comment) => {
        const post = this.posts.find((p) => p.id === newComment.postId);
        if (post) {
          if (!post.comments) {
            post.comments = [];
          }
          post.comments.push(comment);
        }
      },
      error: (error) => {
        console.error('Error creating comment:', error);
      },
    });
  }

  onScroll() {
    // const length = this.posts.length;
    // this.posts.push(...Array.from({ length: 20 }, (_, i) => `Post #${length + i + 1}`));
  }

  private getFileExtensionFromDataUrl(dataUrl: string): string {
    const mimeType = dataUrl.split(',')[0].match(/:(.*?);/)?.[1];
    const extensionMap: { [key: string]: string } = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };
    return extensionMap[mimeType || ''] || 'png';
  }
}
