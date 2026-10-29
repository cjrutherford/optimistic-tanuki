import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfileEditorComponent } from '@optimistic-tanuki/profile-ui';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import type {
  ProfileDto,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';
import {
  PostComponent,
  type PostDto,
  type UpdatePostDto,
} from '@optimistic-tanuki/social-ui';
import { GuardianNoticeComponent } from './guardian-notice.component';

interface Dependent {
  dependentUserId: string;
  profileId: string;
  profileName: string;
  profilePic: string;
  coverPic: string;
  status: 'approved';
}
interface GuardianProfile {
  id: string;
  profileName: string;
  profilePic: string;
  coverPic: string;
  bio: string;
  description: string;
  location: string;
  occupation: string;
  interests: string;
  skills: string;
}
interface GuardianPost {
  id: string;
  title: string;
  content: string;
  visibility?: string;
  createdAt?: string;
}
interface GuardianAsset {
  id: string;
  name: string;
  type: AssetType;
  url: string;
}

type AssetType = 'image' | 'video' | 'audio' | 'document';

const ASSET_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
} as const;

@Component({
  selector: 'lib-guardian-console',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProfileEditorComponent,
    GuardianNoticeComponent,
    PostComponent,
    ModalComponent,
  ],
  templateUrl: './guardian-console.component.html',
  styleUrl: './guardian-console.component.scss',
})
export class GuardianConsoleComponent implements OnInit {
  private readonly http = inject(HttpClient);
  dependents: Dependent[] = [];
  selected: Dependent | null = null;
  profile: GuardianProfile | null = null;
  posts: GuardianPost[] = [];
  assets: GuardianAsset[] = [];
  commentsByPost: Record<string, any[]> = {};
  selectedAssetIds = new Set<string>();
  activeSection: 'overview' | 'profile' | 'content' | 'media' = 'overview';
  loading = true;
  busy = false;
  profileSaveState: 'idle' | 'saving' | 'saved' | 'failed' | null = 'idle';
  editorOpen = false;
  withdrawConfirm = false;
  withdrawAcknowledged = false;
  message = '';
  error = '';
  postTitle = '';
  postText = '';
  postVisibility: 'public' | 'followers' | '' = '';
  commentDrafts: Record<string, string> = {};
  editingCommentId: string | null = null;
  private selectionEpoch = 0;

  ngOnInit(): void {
    void this.loadDependents();
  }

  async loadDependents(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.dependents =
        (await this.http
          .get<Dependent[]>('/api/profile/dependents')
          .toPromise()) || [];
      if (!this.dependents.length) {
        this.resetSelection();
        this.message =
          'No currently linked teen accounts are available in this app.';
      }
    } catch (error) {
      this.error = this.errorFor(
        error,
        'Linked accounts could not be loaded. Try again.'
      );
      this.resetSelection();
    } finally {
      this.loading = false;
    }
  }

  async selectDependent(dependent: Dependent): Promise<void> {
    if (!this.dependents.some((item) => item.profileId === dependent.profileId))
      return;
    const epoch = ++this.selectionEpoch;
    this.selected = dependent;
    this.profile = null;
    this.posts = [];
    this.assets = [];
    this.commentsByPost = {};
    this.commentDrafts = {};
    this.editingCommentId = null;
    this.selectedAssetIds.clear();
    this.activeSection = 'overview';
    this.error = '';
    this.message = '';
    try {
      const [profile, posts, assets] = await Promise.all([
        this.http
          .get<GuardianProfile>(
            `/api/profile/dependents/${encodeURIComponent(dependent.profileId)}`
          )
          .toPromise(),
        this.http
          .get<GuardianPost[]>(
            `/api/social/guardian/content/profiles/${encodeURIComponent(
              dependent.profileId
            )}/posts`
          )
          .toPromise(),
        this.http
          .get<GuardianAsset[]>(
            `/api/social/guardian/content/profiles/${encodeURIComponent(
              dependent.profileId
            )}/assets`
          )
          .toPromise(),
      ]);
      if (
        epoch !== this.selectionEpoch ||
        this.selected?.profileId !== dependent.profileId
      )
        return;
      this.profile = profile || null;
      this.posts = posts || [];
      this.assets = assets || [];
    } catch (error) {
      if (
        epoch === this.selectionEpoch &&
        this.selected?.profileId === dependent.profileId
      ) {
        this.error = this.errorFor(
          error,
          'This account is no longer available. Refresh linked accounts and try again.'
        );
      }
    }
  }

  openEditor(): void {
    if (this.selected && this.profile) {
      this.profileSaveState = 'idle';
      this.editorOpen = true;
    }
  }

  get editorProfile(): ProfileDto | null {
    return this.profile as unknown as ProfileDto;
  }

  socialPost(post: GuardianPost): PostDto {
    return post as unknown as PostDto;
  }

  get postProfile() {
    return this.selected
      ? {
          id: this.selected.profileId,
          name: this.selected.profileName,
          avatar: this.selected.profilePic || '',
        }
      : null;
  }

  async saveProfile(updates: UpdateProfileDto): Promise<void> {
    const selected = this.selected;
    if (!selected || this.busy) return;
    this.busy = true;
    this.profileSaveState = 'saving';
    this.error = '';
    try {
      const allowedFields = [
        'name',
        'profilePic',
        'coverPic',
        'bio',
        'location',
        'occupation',
        'interests',
        'skills',
      ];
      const safeUpdates = Object.fromEntries(
        allowedFields
          .filter((field) =>
            Object.prototype.hasOwnProperty.call(updates, field)
          )
          .map((field) => [field, (updates as Record<string, unknown>)[field]])
      );
      const profile = await this.http
        .put<GuardianProfile>(
          `/api/profile/dependents/${encodeURIComponent(selected.profileId)}`,
          safeUpdates
        )
        .toPromise();
      if (this.selected?.profileId === selected.profileId) {
        this.profile = profile || null;
        this.editorOpen = false;
        this.message = `Changes saved for ${selected.profileName}. Actions are attributed to you as the guardian.`;
        this.profileSaveState = 'saved';
      }
    } catch (error) {
      this.error = this.errorFor(error, 'Profile changes could not be saved.');
      this.profileSaveState = 'failed';
    } finally {
      this.busy = false;
    }
  }

  async uploadAsset(event: Event): Promise<void> {
    const selected = this.selected;
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!selected || !file || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const content = await this.readFile(file);
      await this.http
        .post(
          `/api/social/guardian/content/profiles/${encodeURIComponent(
            selected.profileId
          )}/assets`,
          {
            name: file.name,
            type: this.assetType(file.type),
            content,
            fileExtension: file.name.includes('.')
              ? file.name.slice(file.name.lastIndexOf('.') + 1)
              : undefined,
          }
        )
        .toPromise();
      if (this.selected?.profileId === selected.profileId) {
        this.assets =
          (await this.http
            .get<GuardianAsset[]>(
              `/api/social/guardian/content/profiles/${encodeURIComponent(
                selected.profileId
              )}/assets`
            )
            .toPromise()) || [];
        this.message =
          'Media uploaded to the dependent’s private staged library. It will not be published until you select it in a post.';
      }
    } catch (error) {
      this.error = this.errorFor(error, 'Media could not be uploaded.');
    } finally {
      this.busy = false;
      (event.target as HTMLInputElement).value = '';
    }
  }

  toggleAsset(id: string, checked: boolean): void {
    if (checked) this.selectedAssetIds.add(id);
    else this.selectedAssetIds.delete(id);
  }

  async publishPost(): Promise<void> {
    const selected = this.selected;
    const title = this.postTitle.trim();
    const body = this.postText.trim();
    if (
      !selected ||
      !title ||
      !this.postVisibility ||
      (!body && !this.selectedAssetIds.size) ||
      this.busy
    )
      return;
    this.busy = true;
    this.error = '';
    const ids = [...this.selectedAssetIds];
    const embeds = ids
      .map((id) => `<p><img src="/api/asset/${id}" alt="Selected media" /></p>`)
      .join('');
    try {
      await this.http
        .post(
          `/api/social/guardian/content/profiles/${encodeURIComponent(
            selected.profileId
          )}/posts`,
          {
            title,
            content: `${
              body ? `<p>${this.escapeHtml(body)}</p>` : ''
            }${embeds}`,
            visibility: this.postVisibility,
            publishAssetIds: ids,
          }
        )
        .toPromise();
      if (this.selected?.profileId === selected.profileId) {
        this.postTitle = '';
        this.postText = '';
        this.postVisibility = '';
        this.selectedAssetIds.clear();
        this.posts =
          (await this.http
            .get<GuardianPost[]>(
              `/api/social/guardian/content/profiles/${encodeURIComponent(
                selected.profileId
              )}/posts`
            )
            .toPromise()) || [];
        this.message =
          'The post was published. Selected media is now attached to this post. Actions are attributed to you as the guardian.';
        this.activeSection = 'content';
      }
    } catch (error) {
      this.error = this.errorFor(error, 'The post could not be published.');
    } finally {
      this.busy = false;
    }
  }

  async loadComments(post: GuardianPost): Promise<void> {
    const selected = this.selected;
    if (!selected) return;
    try {
      const comments = await this.http
        .get<any[]>(
          `/api/social/guardian/content/profiles/${encodeURIComponent(
            selected.profileId
          )}/posts/${encodeURIComponent(post.id)}/comments`
        )
        .toPromise();
      if (this.selected?.profileId === selected.profileId)
        this.commentsByPost[post.id] = comments || [];
    } catch (error) {
      this.error = this.errorFor(error, 'Comments could not be loaded.');
    }
  }

  async createComment(postId: string): Promise<void> {
    const selected = this.selected;
    const content = (this.commentDrafts[postId] || '').trim();
    if (!selected || !content || this.busy) return;
    this.busy = true;
    try {
      await this.http
        .post(
          `/api/social/guardian/content/profiles/${encodeURIComponent(
            selected.profileId
          )}/posts/${encodeURIComponent(postId)}/comments`,
          { content }
        )
        .toPromise();
      if (this.selected?.profileId === selected.profileId) {
        this.commentDrafts[postId] = '';
        const post = this.posts.find((item) => item.id === postId);
        if (post) await this.loadComments(post);
        this.message =
          'Comment added. Actions are attributed to you as the guardian.';
      }
    } catch (error) {
      this.error = this.errorFor(error, 'The comment could not be added.');
    } finally {
      this.busy = false;
    }
  }

  async updatePost(post: GuardianPost, update: UpdatePostDto): Promise<void> {
    const selected = this.selected;
    if (!selected || this.busy) return;
    this.busy = true;
    try {
      await this.http
        .put(
          `/api/social/guardian/content/profiles/${encodeURIComponent(
            selected.profileId
          )}/posts/${encodeURIComponent(post.id)}`,
          {
            title: update.title,
            content: update.content,
          }
        )
        .toPromise();
      if (this.selected?.profileId === selected.profileId) {
        this.posts =
          (await this.http
            .get<GuardianPost[]>(
              `/api/social/guardian/content/profiles/${encodeURIComponent(
                selected.profileId
              )}/posts`
            )
            .toPromise()) || [];
        this.message =
          'Post updated. Actions are attributed to you as the guardian.';
      }
    } catch (error) {
      this.error = this.errorFor(error, 'The post could not be updated.');
    } finally {
      this.busy = false;
    }
  }

  async updateComment(postId: string, commentId: string): Promise<void> {
    const selected = this.selected;
    const content = (this.commentDrafts[commentId] || '').trim();
    if (!selected || !content || this.busy) return;
    this.busy = true;
    try {
      await this.http
        .put(
          `/api/social/guardian/content/profiles/${encodeURIComponent(
            selected.profileId
          )}/comments/${encodeURIComponent(commentId)}`,
          { content }
        )
        .toPromise();
      if (this.selected?.profileId === selected.profileId) {
        this.editingCommentId = null;
        const post = this.posts.find((item) => item.id === postId);
        if (post) await this.loadComments(post);
        this.message =
          'Comment updated. Actions are attributed to you as the guardian.';
      }
    } catch (error) {
      this.error = this.errorFor(error, 'The comment could not be updated.');
    } finally {
      this.busy = false;
    }
  }

  editComment(comment: any): void {
    this.editingCommentId = comment.id;
    this.commentDrafts[comment.id] = comment.content || '';
  }

  async deletePost(post: GuardianPost): Promise<void> {
    const selected = this.selected;
    if (
      !selected ||
      this.busy ||
      !globalThis.confirm(
        `Delete “${post.title}”? This removes the dependent’s eligible personal post.`
      )
    )
      return;
    this.busy = true;
    try {
      await this.http
        .delete(
          `/api/social/guardian/content/profiles/${encodeURIComponent(
            selected.profileId
          )}/posts/${encodeURIComponent(post.id)}`
        )
        .toPromise();
      if (this.selected?.profileId === selected.profileId)
        this.posts = this.posts.filter((item) => item.id !== post.id);
      this.message =
        'Post deleted. Actions are attributed to you as the guardian.';
    } catch (error) {
      this.error = this.errorFor(error, 'The post could not be deleted.');
    } finally {
      this.busy = false;
    }
  }

  async deleteComment(postId: string, commentId: string): Promise<void> {
    const selected = this.selected;
    if (
      !selected ||
      this.busy ||
      !globalThis.confirm('Delete this eligible dependent-owned comment?')
    )
      return;
    this.busy = true;
    try {
      await this.http
        .delete(
          `/api/social/guardian/content/profiles/${encodeURIComponent(
            selected.profileId
          )}/comments/${encodeURIComponent(commentId)}`
        )
        .toPromise();
      if (this.selected?.profileId === selected.profileId)
        this.commentsByPost[postId] = (
          this.commentsByPost[postId] || []
        ).filter((item) => item.id !== commentId);
      this.message =
        'Comment deleted. Actions are attributed to you as the guardian.';
    } catch (error) {
      this.error = this.errorFor(error, 'The comment could not be deleted.');
    } finally {
      this.busy = false;
    }
  }

  async deleteAsset(asset: GuardianAsset): Promise<void> {
    const selected = this.selected;
    if (
      !selected ||
      this.busy ||
      !this.assets.some((item) => item.id === asset.id) ||
      !globalThis.confirm(
        `Remove “${asset.name}” from the private staged library?`
      )
    )
      return;
    this.busy = true;
    try {
      await this.http
        .delete(
          `/api/social/guardian/content/profiles/${encodeURIComponent(
            selected.profileId
          )}/assets/${encodeURIComponent(asset.id)}`
        )
        .toPromise();
      if (this.selected?.profileId === selected.profileId) {
        this.assets = this.assets.filter((item) => item.id !== asset.id);
        this.selectedAssetIds.delete(asset.id);
        this.message =
          'Staged media removed. Any existing publication remains governed by the post attachment rules.';
      }
    } catch (error) {
      this.error = this.errorFor(error, 'Staged media could not be removed.');
    } finally {
      this.busy = false;
    }
  }

  async withdraw(): Promise<void> {
    const selected = this.selected;
    if (
      !selected ||
      !this.withdrawConfirm ||
      !this.withdrawAcknowledged ||
      this.busy
    )
      return;
    this.busy = true;
    this.error = '';
    try {
      await this.http
        .post('/api/authentication/guardian-consent/withdraw-linked', {
          dependentUserId: selected.dependentUserId,
        })
        .toPromise();
      this.resetSelection();
      this.dependents = this.dependents.filter(
        (item) => item.dependentUserId !== selected.dependentUserId
      );
      this.withdrawConfirm = false;
      this.withdrawAcknowledged = false;
      this.message =
        'Permission was withdrawn. The teen account is disabled in both apps, and your guardian access has ended.';
    } catch (error) {
      this.error = this.errorFor(
        error,
        'Permission could not be withdrawn. Refresh linked accounts and try again.'
      );
    } finally {
      this.busy = false;
    }
  }

  closeWithdrawal(): void {
    if (this.busy) return;
    this.withdrawConfirm = false;
    this.withdrawAcknowledged = false;
  }

  private resetSelection(): void {
    this.selectionEpoch++;
    this.selected = null;
    this.profile = null;
    this.posts = [];
    this.assets = [];
    this.commentsByPost = {};
    this.commentDrafts = {};
    this.selectedAssetIds.clear();
    this.withdrawConfirm = false;
    this.withdrawAcknowledged = false;
  }
  private assetType(mime: string): AssetType {
    if (mime.startsWith('video/')) return ASSET_TYPE.VIDEO;
    if (mime.startsWith('audio/')) return ASSET_TYPE.AUDIO;
    if (mime.startsWith('image/')) return ASSET_TYPE.IMAGE;
    return ASSET_TYPE.DOCUMENT;
  }
  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('File could not be read'));
      reader.readAsDataURL(file);
    });
  }
  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        }[char] || char)
    );
  }
  private errorFor(error: unknown, fallback: string): string {
    const status = (error as { status?: number } | null)?.status;
    if (status === 401)
      return 'Your session has ended. Sign in again to continue.';
    if (status === 403 || status === 404)
      return 'Guardian access to this account has ended or is unavailable.';
    return fallback;
  }
}
