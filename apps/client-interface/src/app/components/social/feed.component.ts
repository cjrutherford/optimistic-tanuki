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
} from '@optimistic-tanuki/social-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { PostService } from '../../post.service';
import { AttachmentService } from '../../attachment.service';
import { filter, firstValueFrom, Subject, takeUntil } from 'rxjs';
import { CommentService } from '../../comment.service';
import { ProfileService } from '../../profile.service';
import { Router } from '@angular/router';
import { PostProfileStub, ComposeCompleteEvent } from '@optimistic-tanuki/social-ui';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    ComposeComponent,
    PostComponent
],
  providers: [ThemeService, PostService, AttachmentService, CommentService],
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

  constructor(
    private readonly themeService: ThemeService,
    private readonly postService: PostService,
    private readonly attachmentService: AttachmentService,
    private readonly commentService: CommentService,
    private readonly profileService: ProfileService,
    private readonly router: Router,
  ) {
  }
  
  ngOnInit() {
    this.themeService.themeColors$
    .pipe(
      filter(d => !!d),
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
    if(currentProfile){
      this.postService.searchPosts(
        { profileId: currentProfile.id }, {orderBy: 'createdAt', orderDirection: 'desc'}
      ).pipe(
        takeUntil(this.destroy$)
      ).subscribe((posts) => {
        this.posts = posts;
        this.loadProfiles(posts);
      });
    } else {
      this.router.navigate(['/profile'])
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
    }
    );
  }

  createdPost(postData: ComposeCompleteEvent) {
    console.log('create called.')
    const { post, attachments, links } = postData;
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) {
      console.error('No current profile found');
      return;
    }
    const finalPost: CreatePostDto = post as CreatePostDto;
    finalPost.profileId = currentProfile.id;
    this.postService
      .createPost(finalPost)
      .subscribe(async (newPost) => {
        if (attachments.length > 0) {
          for (const atta of attachments) {
            const newAttachment = await firstValueFrom(
              this.attachmentService.createAttachment(atta),
            );
            if (!newPost.attachments) {
              newPost.attachments = [];
            }
            newPost.attachments.push(newAttachment);
          }
        }
        this.posts.unshift(newPost);
      });
  }

  ngOnDestroy() {
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
}
