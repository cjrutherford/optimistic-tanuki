
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

import { CardComponent, ButtonComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import { ComposeForumPostComponent } from '../compose-forum-post/compose-forum-post.component';
import { ForumPostComponent } from '../post/post.component';

import { ForumService } from '../services/forum.service';
import { ProfileService } from '../services/profile.service';

import {
  TopicDto,
  ThreadDto,
  ForumPostDto,
  CreateTopicDto,
  CreateThreadDto,
  CreateForumPostDto
} from '../models';
import { ForumPostData } from '../compose-forum-post/compose-forum-post.component';
import { CreateTopicComponent } from '../create-topic/create-topic.component';
import { CreateThreadComponent } from '../create-thread/create-thread.component';

@Component({
  selector: 'lib-forum-shell',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    ButtonComponent,
    ComposeForumPostComponent,
    ForumPostComponent,
    ModalComponent,
    CreateTopicComponent,
    CreateThreadComponent,
  ],
  templateUrl: './forum-shell.component.html',
  styleUrls: ['./forum-shell.component.scss'],
})
export class ForumShellComponent implements OnInit {
  private readonly forumService = inject(ForumService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Route resolved data
  userValidPermissions: string[] = [];
  userLoggedIn = false;
  currentUserId = '';

  // Signals for reactive state
  topics = signal<TopicDto[]>([]);
  threads = signal<ThreadDto[]>([]);
  posts = signal<ForumPostDto[]>([]);

  currentTopic = signal<TopicDto | null>(null);
  currentThread = signal<ThreadDto | null>(null);

  userProfile = signal<any>(null);
  isLoggedIn = signal(false);

  showComposer = signal(false);
  showTopicModal = signal(false);
  showThreadModal = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  userHasPermission(permission: string): boolean {
    return this.userValidPermissions.includes(permission);
  }

  ngOnInit() {
    // Read resolved data from route
    this.route.data.subscribe(data => {
      this.userValidPermissions = data['userValidPermissions'] || [];
      this.userLoggedIn = data['userLoggedIn'] || false;
      this.currentUserId = data['currentUserId'] || '';
      
      this.checkAuthState();
    });

    this.loadUserProfile();
    this.loadTopics();

    // Watch route params for navigation
    this.route.params.subscribe(params => {
      if (params['topicId']) {
        this.loadTopic(params['topicId']);
      }
      if (params['threadId']) {
        this.loadThread(params['threadId']);
      }
    });
  }

  private checkAuthState() {
    this.isLoggedIn.set(this.userLoggedIn);
    console.log('User logged in:', this.isLoggedIn());
    console.log('User Permissions:', this.userValidPermissions);
  }

  private async loadUserProfile() {
    if (!this.isLoggedIn()) return;

    try {
      const profile = this.profileService.getCurrentUserProfile();
      this.userProfile.set(profile);
    } catch (error) {
      console.warn('Could not load user profile:', error);
    }
  }

  private async loadTopics() {
    this.loading.set(true);
    try {
      const topics = await this.forumService.getTopics();
      this.topics.set(topics);
    } catch (error) {
      this.error.set('Failed to load topics');
      console.error('Error loading topics:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadTopic(topicId: string) {
    try {
      const topic = await this.forumService.getTopic(topicId);
      this.currentTopic.set(topic);

      const threads = await this.forumService.getThreadsByTopic(topicId);
      this.threads.set(threads);
    } catch (error) {
      this.error.set('Failed to load topic');
      console.error('Error loading topic:', error);
    }
  }

  private async loadThread(threadId: string) {
    try {
      const thread = await this.forumService.getThread(threadId);
      this.currentThread.set(thread);

      const posts = await this.forumService.getPostsByThread(threadId);
      this.posts.set(posts);
    } catch (error) {
      this.error.set('Failed to load thread');
      console.error('Error loading thread:', error);
    }
  }

  async onPostSubmitted(postData: ForumPostData) {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      let topicId = postData.topicId;
      let threadId = postData.threadId;

      // Create new topic if needed
      if (postData.newTopicName && !topicId) {
        const newTopic: CreateTopicDto = {
          name: postData.newTopicName,
          description: `Topic: ${postData.newTopicName}`,
          userId: this.currentUserId,
          profileId: this.userProfile()?.id || '',
        };

        const createdTopic = await this.forumService.createTopic(newTopic);
        topicId = createdTopic.id;

        // Refresh topics list
        await this.loadTopics();
      }

      // Create new thread if needed
      if (postData.newThreadTitle && topicId && !threadId) {
        const newThread: CreateThreadDto = {
          title: postData.newThreadTitle,
          description: `Thread: ${postData.newThreadTitle}`,
          topicId: topicId,
          userId: this.currentUserId,
          profileId: this.userProfile()?.id || '',
        };

        const createdThread = await this.forumService.createThread(newThread);
        threadId = createdThread.id;

        // Refresh threads if we're viewing this topic
        if (this.currentTopic()?.id === topicId) {
          await this.loadTopic(topicId);
        }
      }

      // Create the forum post
      if (threadId) {
        const newPost: CreateForumPostDto = {
          content: postData.content,
          threadId: threadId,
          userId: this.currentUserId,
          profileId: this.userProfile()?.id || '',
        };

        await this.forumService.createPost(newPost);

        // Refresh posts if we're viewing this thread
        if (this.currentThread()?.id === threadId) {
          await this.loadThread(threadId);
        }

        this.showComposer.set(false);
      }

    } catch (error) {
      this.error.set('Failed to create post');
      console.error('Error creating post:', error);
    }
  }

  onTopicCreated(topicName: string) {
    console.log('Topic created:', topicName);
    // Topic creation is handled in onPostSubmitted
  }

  onThreadCreated(threadData: { title: string; topicId: string }) {
    console.log('Thread created:', threadData);
    // Thread creation is handled in onPostSubmitted
  }

  onTopicClick(topic: TopicDto) {
    this.router.navigate(['/forum/topic', topic.id]);
  }

  onThreadClick(thread: ThreadDto) {
    this.router.navigate(['/forum/thread', thread.id]);
  }

  toggleComposer() {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.showComposer.set(!this.showComposer());
  }

  navigateBack() {
    if (this.currentThread()) {
      // Go back to topic view
      this.router.navigate(['/forum/topic', this.currentThread()!.topicId]);
    } else if (this.currentTopic()) {
      // Go back to main forum view
      this.router.navigate(['/forum']);
    }
  }
}
