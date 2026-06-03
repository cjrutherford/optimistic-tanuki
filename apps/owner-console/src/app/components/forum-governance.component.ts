import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ForumPostDto,
  ThreadDto,
  TopicDto,
} from '@optimistic-tanuki/ui-models';
import { ForumModerationReport, ForumService } from '../services/forum.service';

@Component({
  selector: 'app-forum-governance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="governance-page">
      <header class="hero">
        <p class="hero-kicker">Community Ops</p>
        <h1>Forum Governance</h1>
        <p>
          Moderate current forum topics, threads, posts, and incoming forum
          reports directly from owner-console.
        </p>
      </header>

      <section class="summary-grid">
        <article class="summary-card">
          <span class="eyebrow">Topics</span>
          <strong>{{ topics.length }}</strong>
          <p>{{ lockedTopicCount }} locked, {{ privateTopicCount }} private</p>
        </article>
        <article class="summary-card">
          <span class="eyebrow">Threads</span>
          <strong>{{ threads.length }}</strong>
          <p>
            {{ lockedThreadCount }} locked, {{ privateThreadCount }} private
          </p>
        </article>
        <article class="summary-card">
          <span class="eyebrow">Reports</span>
          <strong>{{ reports.length }}</strong>
          <p>{{ pendingReportCount }} pending review</p>
        </article>
      </section>

      <div class="error" *ngIf="error">{{ error }}</div>

      <section class="panel">
        <div class="panel-heading">
          <h2>Topic moderation</h2>
          <p>Adjust visibility, pinning, and lock state for forum topics.</p>
        </div>
        <div class="moderation-list" *ngIf="topics.length; else noTopics">
          <article class="moderation-card" *ngFor="let topic of topics">
            <div class="card-copy">
              <h3>{{ topic.title }}</h3>
              <p>{{ topic.description }}</p>
              <div class="status-row">
                <span class="status-pill">{{ topic.visibility }}</span>
                <span class="status-pill" *ngIf="topic.isPinned">pinned</span>
                <span class="status-pill warning" *ngIf="topic.isLocked">
                  locked
                </span>
              </div>
            </div>
            <div class="card-actions">
              <select
                [ngModel]="topic.visibility"
                (ngModelChange)="setTopicVisibility(topic, $event)"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              <button class="btn" (click)="toggleTopicPinned(topic)">
                {{ topic.isPinned ? 'Unpin' : 'Pin' }}
              </button>
              <button class="btn warning" (click)="toggleTopicLock(topic)">
                {{ topic.isLocked ? 'Unlock' : 'Lock' }}
              </button>
            </div>
          </article>
        </div>
        <ng-template #noTopics>
          <p class="empty-state">No topics are currently available.</p>
        </ng-template>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Thread moderation</h2>
          <p>Moderate thread visibility, pinning, lock state, and takedown.</p>
        </div>
        <div class="moderation-list" *ngIf="threads.length; else noThreads">
          <article class="moderation-card" *ngFor="let thread of threads">
            <div class="card-copy">
              <h3>{{ thread.title }}</h3>
              <p>{{ thread.description }}</p>
              <div class="status-row">
                <span class="status-pill">{{ thread.visibility }}</span>
                <span class="status-pill soft">
                  {{ getModerationStatus(thread) }}
                </span>
                <span class="status-pill" *ngIf="thread.isPinned">pinned</span>
                <span class="status-pill warning" *ngIf="thread.isLocked">
                  locked
                </span>
              </div>
            </div>
            <div class="card-actions">
              <select
                [ngModel]="thread.visibility"
                (ngModelChange)="setThreadVisibility(thread, $event)"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              <button class="btn" (click)="toggleThreadPinned(thread)">
                {{ thread.isPinned ? 'Unpin' : 'Pin' }}
              </button>
              <button class="btn warning" (click)="toggleThreadLock(thread)">
                {{ thread.isLocked ? 'Unlock' : 'Lock' }}
              </button>
              <button
                class="btn warning"
                (click)="applyThreadModeration(thread, 'hidden')"
              >
                Hide
              </button>
              <button
                class="btn"
                (click)="applyThreadModeration(thread, 'visible')"
              >
                Restore
              </button>
            </div>
          </article>
        </div>
        <ng-template #noThreads>
          <p class="empty-state">No threads are currently available.</p>
        </ng-template>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Forum posts</h2>
          <p>Review reported replies and apply reversible moderation.</p>
        </div>
        <div class="moderation-list" *ngIf="posts.length; else noPosts">
          <article class="moderation-card" *ngFor="let post of posts">
            <div class="card-copy">
              <h3>Reply · {{ post.id }}</h3>
              <p>{{ post.content }}</p>
              <div class="status-row">
                <span class="status-pill soft">
                  {{ getModerationStatus(post) }}
                </span>
                <span class="status-pill soft">thread {{ post.threadId }}</span>
              </div>
            </div>
            <div class="card-actions">
              <button
                class="btn warning"
                (click)="applyPostModeration(post, 'hidden')"
              >
                Hide
              </button>
              <button
                class="btn"
                (click)="applyPostModeration(post, 'visible')"
              >
                Restore
              </button>
            </div>
          </article>
        </div>
        <ng-template #noPosts>
          <p class="empty-state">No forum posts are currently available.</p>
        </ng-template>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Report triage queue</h2>
          <p>
            Update report status and apply soft moderation to the reported
            content.
          </p>
        </div>
        <div class="moderation-list" *ngIf="reports.length; else noReports">
          <article class="moderation-card" *ngFor="let report of reports">
            <div class="card-copy">
              <h3>{{ report.contentType }} · {{ report.contentId }}</h3>
              <p>
                {{ report.description || 'No moderator context supplied.' }}
              </p>
              <div class="status-row">
                <span class="status-pill">{{ report.status }}</span>
                <span class="status-pill soft">{{ report.reason }}</span>
              </div>
            </div>
            <div class="card-actions">
              <select
                [ngModel]="getReportDraft(report).status"
                (ngModelChange)="updateReportDraft(report.id, 'status', $event)"
              >
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="actioned">Actioned</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <textarea
                rows="3"
                [ngModel]="getReportDraft(report).adminNotes"
                (ngModelChange)="
                  updateReportDraft(report.id, 'adminNotes', $event)
                "
                placeholder="Operator notes"
              ></textarea>
              <div class="action-row">
                <button class="btn" (click)="saveReport(report)">Save</button>
                <button
                  class="btn warning"
                  *ngIf="report.contentType === 'thread'"
                  (click)="applyReportContentModeration(report, 'hidden')"
                >
                  Hide thread
                </button>
                <button
                  class="btn warning"
                  *ngIf="report.contentType === 'post'"
                  (click)="applyReportContentModeration(report, 'hidden')"
                >
                  Hide post
                </button>
              </div>
            </div>
          </article>
        </div>
        <ng-template #noReports>
          <p class="empty-state">
            No forum moderation reports are currently queued.
          </p>
        </ng-template>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
      }

      .governance-page {
        display: grid;
        gap: 24px;
      }

      .hero,
      .panel,
      .summary-card {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 24px;
        background: radial-gradient(
            circle at top left,
            rgba(96, 165, 250, 0.08),
            transparent 28%
          ),
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.96),
            rgba(246, 248, 248, 0.92)
          );
        padding: 24px;
      }

      .hero-kicker,
      .eyebrow {
        color: #1d4ed8;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }

      .summary-card strong {
        display: block;
        font-size: 2rem;
        margin: 0.5rem 0;
      }

      .panel-heading {
        margin-bottom: 16px;
      }

      .moderation-list {
        display: grid;
        gap: 16px;
      }

      .moderation-card {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 18px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.92);
      }

      .card-copy,
      .card-actions {
        display: grid;
        gap: 8px;
      }

      .card-actions {
        align-content: start;
        min-width: 220px;
      }

      .status-row,
      .action-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .status-pill {
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(29, 78, 216, 0.12);
        color: #1d4ed8;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .status-pill.soft {
        background: rgba(29, 78, 216, 0.08);
      }

      .status-pill.warning {
        background: rgba(196, 112, 0, 0.14);
        color: #8d4b00;
      }

      .btn,
      select,
      textarea {
        padding: 0.55rem 0.85rem;
        border-radius: 8px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: white;
      }

      textarea {
        resize: vertical;
      }

      .btn {
        cursor: pointer;
      }

      .btn.warning {
        border-color: rgba(196, 112, 0, 0.4);
      }

      .empty-state,
      .error {
        margin: 0;
      }

      .error {
        color: #9b2121;
        font-weight: 600;
      }
    `,
  ],
})
export class ForumGovernanceComponent implements OnInit {
  private readonly forumService = inject(ForumService);

  topics: TopicDto[] = [];
  threads: ThreadDto[] = [];
  posts: ForumPostDto[] = [];
  reports: ForumModerationReport[] = [];
  error: string | null = null;
  reportDrafts: Record<
    string,
    { status: ForumModerationReport['status']; adminNotes: string }
  > = {};

  get lockedTopicCount(): number {
    return this.topics.filter((topic) => topic.isLocked).length;
  }

  get privateTopicCount(): number {
    return this.topics.filter((topic) => topic.visibility === 'private').length;
  }

  get lockedThreadCount(): number {
    return this.threads.filter((thread) => thread.isLocked).length;
  }

  get privateThreadCount(): number {
    return this.threads.filter((thread) => thread.visibility === 'private')
      .length;
  }

  get pendingReportCount(): number {
    return this.reports.filter((report) => report.status === 'pending').length;
  }

  ngOnInit(): void {
    this.loadTopics();
    this.loadThreads();
    this.loadPosts();
    this.loadReports();
  }

  loadTopics(): void {
    this.forumService.getTopics().subscribe({
      next: (topics) => {
        this.topics = topics;
      },
      error: (err) => {
        this.error = 'Failed to load forum topics';
        console.error(err);
      },
    });
  }

  loadThreads(): void {
    this.forumService.getThreads().subscribe({
      next: (threads) => {
        this.threads = threads;
      },
      error: (err) => {
        this.error = 'Failed to load forum threads';
        console.error(err);
      },
    });
  }

  loadPosts(): void {
    this.forumService.getPosts().subscribe({
      next: (posts) => {
        this.posts = posts;
      },
      error: (err) => {
        this.error = 'Failed to load forum posts';
        console.error(err);
      },
    });
  }

  loadReports(): void {
    this.forumService.getReports().subscribe({
      next: (reports) => {
        this.reports = reports;
        this.reportDrafts = {};
        for (const report of reports) {
          this.reportDrafts[report.id] = {
            status: report.status,
            adminNotes: report.adminNotes ?? '',
          };
        }
      },
      error: (err) => {
        this.error = 'Failed to load forum reports';
        console.error(err);
      },
    });
  }

  toggleTopicLock(topic: TopicDto): void {
    this.forumService
      .updateTopic(topic.id, { isLocked: !topic.isLocked })
      .subscribe(() => {
        topic.isLocked = !topic.isLocked;
      });
  }

  toggleTopicPinned(topic: TopicDto): void {
    this.forumService
      .updateTopic(topic.id, { isPinned: !topic.isPinned })
      .subscribe(() => {
        topic.isPinned = !topic.isPinned;
      });
  }

  setTopicVisibility(topic: TopicDto, visibility: 'public' | 'private'): void {
    if (topic.visibility === visibility) {
      return;
    }
    this.forumService.updateTopic(topic.id, { visibility }).subscribe(() => {
      topic.visibility = visibility;
    });
  }

  toggleThreadLock(thread: ThreadDto): void {
    this.forumService
      .updateThread(thread.id, { isLocked: !thread.isLocked })
      .subscribe(() => {
        thread.isLocked = !thread.isLocked;
      });
  }

  toggleThreadPinned(thread: ThreadDto): void {
    this.forumService
      .updateThread(thread.id, { isPinned: !thread.isPinned })
      .subscribe(() => {
        thread.isPinned = !thread.isPinned;
      });
  }

  setThreadVisibility(
    thread: ThreadDto,
    visibility: 'public' | 'private'
  ): void {
    if (thread.visibility === visibility) {
      return;
    }
    this.forumService.updateThread(thread.id, { visibility }).subscribe(() => {
      thread.visibility = visibility;
    });
  }

  getReportDraft(report: ForumModerationReport): {
    status: ForumModerationReport['status'];
    adminNotes: string;
  } {
    return (
      this.reportDrafts[report.id] ?? {
        status: report.status,
        adminNotes: report.adminNotes ?? '',
      }
    );
  }

  updateReportDraft(
    reportId: string,
    key: 'status' | 'adminNotes',
    value: string
  ): void {
    const current = this.reportDrafts[reportId] ?? {
      status: 'pending' as const,
      adminNotes: '',
    };
    this.reportDrafts[reportId] = {
      ...current,
      [key]: value,
    };
  }

  saveReport(report: ForumModerationReport): void {
    const draft = this.getReportDraft(report);
    this.forumService
      .updateReport(report.id, {
        status: draft.status,
        adminNotes: draft.adminNotes,
      })
      .subscribe({
        next: (updated) => {
          this.reports = this.reports.map((existing) =>
            existing.id === updated.id ? updated : existing
          );
          this.reportDrafts[updated.id] = {
            status: updated.status,
            adminNotes: updated.adminNotes ?? '',
          };
        },
        error: (err) => {
          this.error = 'Failed to update forum report';
          console.error(err);
        },
      });
  }

  findThread(id: string): ThreadDto | undefined {
    return this.threads.find((thread) => thread.id === id);
  }

  findPost(id: string): ForumPostDto | undefined {
    return this.posts.find((post) => post.id === id);
  }

  getModerationStatus(
    target: Partial<{ moderationStatus: 'visible' | 'hidden' }>
  ): 'visible' | 'hidden' {
    return target.moderationStatus ?? 'visible';
  }

  applyThreadModeration(
    thread: ThreadDto | undefined,
    moderationStatus: 'visible' | 'hidden',
    report?: ForumModerationReport
  ): void {
    if (!thread) {
      return;
    }

    const draft = report ? this.getReportDraft(report) : undefined;
    this.forumService
      .moderateThread(thread.id, {
        moderationStatus,
        adminNotes: draft?.adminNotes,
      })
      .subscribe({
        next: () => {
          (thread as any).moderationStatus = moderationStatus;
          if (report) {
            this.finalizeReportModeration(report, draft?.adminNotes ?? '');
          }
        },
        error: (err) => {
          this.error = 'Failed to moderate forum thread';
          console.error(err);
        },
      });
  }

  applyPostModeration(
    post: ForumPostDto | undefined,
    moderationStatus: 'visible' | 'hidden',
    report?: ForumModerationReport
  ): void {
    if (!post) {
      return;
    }

    const draft = report ? this.getReportDraft(report) : undefined;
    this.forumService
      .moderatePost(post.id, {
        moderationStatus,
        adminNotes: draft?.adminNotes,
      })
      .subscribe({
        next: () => {
          (post as any).moderationStatus = moderationStatus;
          if (report) {
            this.finalizeReportModeration(report, draft?.adminNotes ?? '');
          }
        },
        error: (err) => {
          this.error = 'Failed to moderate forum post';
          console.error(err);
        },
      });
  }

  applyReportContentModeration(
    report: ForumModerationReport,
    moderationStatus: 'visible' | 'hidden'
  ): void {
    if (report.contentType === 'thread') {
      this.forumService
        .moderateThread(report.contentId, {
          moderationStatus,
          adminNotes: this.getReportDraft(report).adminNotes,
        })
        .subscribe({
          next: () => {
            const thread = this.findThread(report.contentId);
            if (thread) {
              (thread as any).moderationStatus = moderationStatus;
            }
            this.finalizeReportModeration(
              report,
              this.getReportDraft(report).adminNotes
            );
          },
          error: (err) => {
            this.error = 'Failed to moderate forum thread';
            console.error(err);
          },
        });
      return;
    }

    this.forumService
      .moderatePost(report.contentId, {
        moderationStatus,
        adminNotes: this.getReportDraft(report).adminNotes,
      })
      .subscribe({
        next: () => {
          const post = this.findPost(report.contentId);
          if (post) {
            (post as any).moderationStatus = moderationStatus;
          }
          this.finalizeReportModeration(
            report,
            this.getReportDraft(report).adminNotes
          );
        },
        error: (err) => {
          this.error = 'Failed to moderate forum post';
          console.error(err);
        },
      });
  }

  private finalizeReportModeration(
    report: ForumModerationReport,
    adminNotes: string
  ): void {
    this.forumService
      .updateReport(report.id, {
        status: 'actioned',
        adminNotes,
      })
      .subscribe({
        next: (updated) => {
          this.reports = this.reports.map((existing) =>
            existing.id === updated.id ? updated : existing
          );
          this.reportDrafts[updated.id] = {
            status: updated.status,
            adminNotes: updated.adminNotes ?? '',
          };
        },
        error: (err) => {
          this.error = 'Failed to update forum report';
          console.error(err);
        },
      });
  }
}
