import { Component, OnInit, PLATFORM_ID, signal, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

import {
  CardComponent,
  ButtonComponent,
  ModalComponent,
} from '@optimistic-tanuki/common-ui';
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
  CreateForumPostDto,
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
  private readonly platformId = inject(PLATFORM_ID);

  // Route resolved data
  userValidPermissions: string[] = [];
  permissionsUnavailable = signal(false);
  permissionsDenied = signal(false);
  userLoggedIn = false;
  currentUserId = '';

  // Signals for reactive state
  topics = signal<TopicDto[]>([]);
  showEmptyTopics = signal(false);
  threads = signal<ThreadDto[]>([]);
  showEmptyThreads = signal(false);
  posts = signal<ForumPostDto[]>([]);
  showEmptyPosts = signal(false);

  currentTopic = signal<TopicDto | null>(null);
  currentThread = signal<ThreadDto | null>(null);

  userProfile = signal<any>(null);
  isLoggedIn = signal(false);

  showComposer = signal(false);
  showTopicModal = signal(false);
  showThreadModal = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  topicsLoadError = signal<string | null>(null);
  topicLoadError = signal<string | null>(null);
  threadLoadError = signal<string | null>(null);
  threadsLoadError = signal<string | null>(null);
  postsLoadError = signal<string | null>(null);
  detailLoading = signal(false);
  failedTopicId = signal<string | null>(null);
  failedThreadId = signal<string | null>(null);

  userHasPermission(permission: string): boolean {
    return this.userValidPermissions.includes(permission);
  }

  retryPermissions(): void {
    if (this.isBrowser()) {
      window.location.reload();
    }
  }

  getUploadProfileId(): string {
    return this.userProfile()?.id || this.currentUserId || '';
  }

  ngOnInit() {
    // Read resolved data from route
    this.route.data.subscribe((data) => {
      const resolvedPermissions = data['userValidPermissions'];
      if (Array.isArray(resolvedPermissions)) {
        this.userValidPermissions = resolvedPermissions;
        this.permissionsUnavailable.set(false);
        this.permissionsDenied.set(false);
      } else {
        this.userValidPermissions = resolvedPermissions?.permissions ?? [];
        this.permissionsUnavailable.set(
          resolvedPermissions?.unavailable === true
        );
        this.permissionsDenied.set(resolvedPermissions?.denied === true);
      }
      this.userLoggedIn = data['userLoggedIn'] || false;
      this.currentUserId = data['currentUserId'] || '';

      this.checkAuthState();
    });

    if (this.isBrowser()) {
      this.loadUserProfile();
      this.loadTopics();
    }

    // Watch route params for navigation
    this.route.params.subscribe((params) => {
      if (!this.isBrowser()) {
        return;
      }

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

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
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
    this.error.set(null);
    this.topicsLoadError.set(null);
    this.showEmptyTopics.set(false);
    this.loading.set(true);
    try {
      const topics = await this.forumService.getTopics();
      this.topics.set(topics);
      this.showEmptyTopics.set(topics.length === 0);
    } catch (error) {
      this.showEmptyTopics.set(false);
      const status = (error as { status?: number } | null)?.status;
      const reason =
        status === 401
          ? 'Your session has expired. Please log in again.'
          : status === 403
          ? 'You do not have permission to load forum topics.'
          : status === 404
          ? 'Forum topics were not found.'
          : status === 0 ||
            status === 408 ||
            (typeof status === 'number' && status >= 500)
          ? 'Forum topics are temporarily unavailable.'
          : 'Forum topics could not be loaded.';
      this.topicsLoadError.set(reason);
      console.error('Error loading topics:', error);
    } finally {
      this.loading.set(false);
    }
  }

  retryTopics(): void {
    if (this.isBrowser()) {
      void this.loadTopics();
    }
  }

  private async loadTopic(topicId: string) {
    this.currentTopic.set(null);
    this.currentThread.set(null);
    this.failedTopicId.set(null);
    this.failedThreadId.set(null);
    this.topicLoadError.set(null);
    this.threadLoadError.set(null);
    this.threadsLoadError.set(null);
    this.showEmptyThreads.set(false);
    this.threads.set([]);
    this.posts.set([]);
    this.detailLoading.set(true);
    try {
      const topic = await this.forumService.getTopic(topicId);
      this.currentTopic.set(topic);
    } catch (error) {
      this.currentTopic.set(null);
      this.currentThread.set(null);
      this.threads.set([]);
      this.failedTopicId.set(topicId);
      const status = (error as { status?: number } | null)?.status;
      const resource = status === 404 ? 'not found' : 'unavailable';
      this.topicLoadError.set(
        `This forum topic could not be loaded (${resource}).`
      );
      console.error('Error loading topic:', error);
      this.detailLoading.set(false);
      return false;
    }
    try {
      const threads = await this.forumService.getThreadsByTopic(topicId);
      this.threads.set(threads);
      this.showEmptyThreads.set(threads.length === 0);
      this.threadsLoadError.set(null);
    } catch (error) {
      this.showEmptyThreads.set(false);
      const status = (error as { status?: number } | null)?.status;
      const resource = status === 404 ? 'not found' : 'unavailable';
      this.threadsLoadError.set(
        `Threads for this topic could not be loaded (${resource}).`
      );
      console.error('Error loading topic threads:', error);
    } finally {
      this.detailLoading.set(false);
    }
    return true;
  }

  retryTopic(topicId: string): void {
    if (this.isBrowser()) void this.loadTopic(topicId);
  }

  retryFailedTopic(): void {
    const topicId = this.failedTopicId();
    if (topicId) this.retryTopic(topicId);
  }

  retryThreads(topicId: string): void {
    if (this.isBrowser()) void this.loadTopic(topicId);
  }

  retryFailedThread(): void {
    const threadId = this.failedThreadId();
    if (threadId) void this.loadThread(threadId);
  }

  private async loadThread(threadId: string) {
    this.currentTopic.set(null);
    this.currentThread.set(null);
    this.failedTopicId.set(null);
    this.failedThreadId.set(null);
    this.postsLoadError.set(null);
    this.threadsLoadError.set(null);
    this.topicLoadError.set(null);
    this.threadLoadError.set(null);
    this.threads.set([]);
    this.showEmptyPosts.set(false);
    this.posts.set([]);
    this.detailLoading.set(true);
    try {
      const thread = await this.forumService.getThread(threadId);
      const topicLoaded = await this.loadTopic(thread.topicId);
      if (!topicLoaded) return;
      this.currentThread.set(thread);
      await this.loadThreadPosts(threadId);
    } catch (error) {
      this.currentThread.set(null);
      this.currentTopic.set(null);
      this.threads.set([]);
      const status = (error as { status?: number } | null)?.status;
      const resource = status === 404 ? 'not found' : 'unavailable';
      this.failedThreadId.set(threadId);
      this.threadLoadError.set(
        `This forum thread could not be loaded (${resource}).`
      );
      console.error('Error loading thread:', error);
    } finally {
      this.detailLoading.set(false);
    }
  }

  retryPosts(threadId: string): void {
    if (this.isBrowser()) void this.loadThreadPosts(threadId);
  }

  private async loadThreadPosts(threadId: string): Promise<void> {
    this.postsLoadError.set(null);
    this.showEmptyPosts.set(false);
    this.posts.set([]);
    this.detailLoading.set(true);
    try {
      const posts = await this.forumService.getPostsByThread(threadId);
      this.posts.set(posts);
      this.showEmptyPosts.set(posts.length === 0);
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      const resource = status === 404 ? 'not found' : 'temporarily unavailable';
      this.postsLoadError.set(`Posts for this thread were ${resource}.`);
      console.error('Error loading posts:', error);
    } finally {
      this.detailLoading.set(false);
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
          title: postData.newTopicName,
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
          content: `${
            postData.content
          } - created at ${new Date().toLocaleDateString()}`,
          topicId: topicId,
          userId: this.currentUserId,
          profileId: this.currentUserId,
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

  async onCreateTopic(topicDto: CreateTopicDto) {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      this.loading.set(true);

      // Add user info to the DTO
      const newTopic: CreateTopicDto = {
        ...topicDto,
        userId: this.currentUserId,
        profileId: this.currentUserId,
      };

      const createdTopic = await this.forumService.createTopic(newTopic);

      // Close modal and refresh topics
      this.showTopicModal.set(false);
      await this.loadTopics();

      // Navigate to the new topic
      this.router.navigate(['/forum/topic', createdTopic.id]);
    } catch (error) {
      this.error.set('Failed to create topic');
      console.error('Error creating topic:', error);
    } finally {
      this.loading.set(false);
    }
  }

  onCancelTopic() {
    this.showTopicModal.set(false);
  }

  async onCreateThread(threadDto: CreateThreadDto) {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      this.loading.set(true);

      // Add user info to the DTO
      const newThread: CreateThreadDto = {
        ...threadDto,
        content: threadDto.content || '',
        userId: this.currentUserId,
        profileId: this.currentUserId,
      };

      const createdThread = await this.forumService.createThread(newThread);

      // Close modal and refresh threads if we're viewing the topic
      this.showThreadModal.set(false);

      if (this.currentTopic()?.id === createdThread.topicId) {
        await this.loadTopic(createdThread.topicId);
      }

      // Navigate to the new thread
      this.router.navigate(['/forum/thread', createdThread.id]);
    } catch (error) {
      this.error.set('Failed to create thread');
      console.error('Error creating thread:', error);
    } finally {
      this.loading.set(false);
    }
  }

  onCancelThread() {
    this.showThreadModal.set(false);
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
