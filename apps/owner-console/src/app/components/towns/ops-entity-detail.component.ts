import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  CommunityOpsCase,
  CommunityOpsEntity,
  CommunityOpsEscalation,
  CommunityOpsNote,
  ModerationHandoffContext,
} from './community-ops.model';
import { buildEntityActions } from './community-ops-data.service';
import { CommunityOpsJournalService } from './community-ops-journal.service';
import { TOWN_OPS_STYLES } from './community-ops.styles';

@Component({
  selector: 'app-ops-entity-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <section class="detail-panel" *ngIf="entity() as entity">
      <div class="panel-heading">
        <div>
          <p class="detail-kicker">{{ entity.entityType }} workspace</p>
          <h2>{{ entity.title }}</h2>
          <p>{{ entity.subtitle }}</p>
        </div>
        <span
          class="detail-status"
          [class.attention]="entity.health === 'attention'"
        >
          {{ entity.health === 'attention' ? 'Attention' : 'Healthy' }}
        </span>
      </div>

      <div class="detail-grid">
        <article class="detail-card">
          <h3>Current state</h3>
          <p>{{ entity.detail }}</p>
        </article>
        <article class="detail-card">
          <h3>Linked governance route</h3>
          <p>{{ entity.route }}</p>
        </article>
      </div>

      <div class="action-group">
        <h3>Direct actions</h3>
        <div class="action-row">
          @for (action of actions(); track action.label) {
          <a class="action-link" [routerLink]="action.route">
            {{ action.label }}
          </a>
          }
        </div>
      </div>

      <div class="related-panel" *ngIf="related().length">
        <h3>Related entities</h3>
        <p>
          Pivot directly into linked locality and membership records without
          leaving the town workspace.
        </p>
        <div class="related-entity-list">
          @for (item of related(); track item.id) {
          <button
            type="button"
            class="related-entity-card"
            (click)="relatedSelected.emit(item)"
          >
            <span class="entity-type">{{ item.entityType }}</span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.subtitle }}</small>
          </button>
          }
        </div>
      </div>

      <div class="related-panel">
        <h3>Moderation Streams</h3>
        <p>
          Open the dedicated social and forum moderation tools when locality
          governance needs content-level intervention.
        </p>
        <div class="action-row">
          <a
            class="action-link secondary"
            routerLink="/dashboard/social-governance"
            [queryParams]="moderationContext()"
          >
            Social Governance
          </a>
          <a
            class="action-link secondary"
            routerLink="/dashboard/forum-governance"
            [queryParams]="moderationContext()"
          >
            Forum Governance
          </a>
        </div>
      </div>

      <div class="journal-grid">
        <section class="journal-panel">
          <div class="panel-heading journal-heading">
            <div>
              <h3>Shared case</h3>
              <p>
                Assign ownership and resolution state for the current entity.
              </p>
            </div>
          </div>
          <div class="case-form" *ngIf="!activeCase; else existingCase">
            <input
              class="journal-input"
              type="text"
              [(ngModel)]="caseDraft.title"
              placeholder="Case title"
            />
            <textarea
              class="journal-textarea"
              rows="3"
              [(ngModel)]="caseDraft.summary"
              placeholder="Case summary"
            ></textarea>
            <input
              class="journal-input"
              type="text"
              [(ngModel)]="caseDraft.owner"
              placeholder="Case owner"
            />
            <div class="action-row">
              <button type="button" class="action-link" (click)="createCase()">
                Create Case
              </button>
            </div>
          </div>
          <ng-template #existingCase>
            <article class="journal-entry">
              <div class="entity-card__header">
                <strong>{{ activeCase?.title }}</strong>
                <span
                  class="entity-health"
                  [class.attention]="activeCase?.status === 'open'"
                >
                  {{ activeCase?.status }}
                </span>
              </div>
              <span
                >{{ activeCase?.owner }} ·
                {{ activeCase?.updatedAt | date : 'medium' }}</span
              >
              <p>{{ activeCase?.summary }}</p>
              <div class="action-row">
                <button
                  type="button"
                  class="action-link secondary"
                  *ngIf="activeCase?.status === 'open'"
                  (click)="updateCaseStatus('resolved')"
                >
                  Resolve Case
                </button>
                <button
                  type="button"
                  class="action-link"
                  *ngIf="activeCase?.status === 'resolved'"
                  (click)="updateCaseStatus('open')"
                >
                  Reopen Case
                </button>
              </div>
            </article>
          </ng-template>
        </section>

        <section class="journal-panel">
          <div class="panel-heading journal-heading">
            <div>
              <h3>Operator notes</h3>
              <p>
                Capture localized governance context without leaving the
                workspace.
              </p>
            </div>
          </div>
          <textarea
            class="journal-textarea"
            rows="4"
            [(ngModel)]="noteDraft"
            placeholder="Add operator context, follow-up guidance, or locality notes"
          ></textarea>
          <div class="action-row">
            <button type="button" class="action-link" (click)="saveNote()">
              Save Note
            </button>
          </div>
          <div class="journal-list" *ngIf="activeNotes.length; else emptyNotes">
            <article class="journal-entry" *ngFor="let note of activeNotes">
              <strong>{{ note.author }}</strong>
              <span>{{ note.createdAt | date : 'medium' }}</span>
              <p>{{ note.body }}</p>
            </article>
          </div>
          <ng-template #emptyNotes>
            <p class="journal-empty">
              No operator notes recorded for this entity yet.
            </p>
          </ng-template>
        </section>

        <section class="journal-panel">
          <div class="panel-heading journal-heading">
            <div>
              <h3>Escalation history</h3>
              <p>
                Track when locality or membership issues were opened and
                resolved.
              </p>
            </div>
          </div>
          <textarea
            class="journal-textarea"
            rows="4"
            [(ngModel)]="escalationDraft"
            placeholder="Describe the escalation trigger or resolution"
          ></textarea>
          <div class="action-row">
            <button
              type="button"
              class="action-link"
              (click)="addEscalation('open')"
            >
              Log Open Escalation
            </button>
            <button
              type="button"
              class="action-link secondary"
              (click)="addEscalation('resolved')"
            >
              Log Resolution
            </button>
          </div>
          <div
            class="journal-list"
            *ngIf="activeEscalations.length; else emptyEscalations"
          >
            <article
              class="journal-entry"
              *ngFor="let entry of activeEscalations"
            >
              <div class="entity-card__header">
                <strong>{{ entry.summary }}</strong>
                <span
                  class="entity-health"
                  [class.attention]="entry.status === 'open'"
                >
                  {{ entry.status }}
                </span>
              </div>
              <span
                >{{ entry.actor }} ·
                {{ entry.createdAt | date : 'medium' }}</span
              >
            </article>
          </div>
          <ng-template #emptyEscalations>
            <p class="journal-empty">
              No escalation history recorded for this entity yet.
            </p>
          </ng-template>
        </section>
      </div>
    </section>
  `,
  styles: [TOWN_OPS_STYLES],
})
export class OpsEntityDetailComponent {
  private readonly journal = inject(CommunityOpsJournalService);

  readonly entity = input.required<CommunityOpsEntity | null>();
  readonly related = input<CommunityOpsEntity[]>([]);
  readonly relatedSelected = output<CommunityOpsEntity>();
  /** Fires after a journal change so a list can refresh its pressure copy. */
  readonly journalChanged = output<void>();

  noteDraft = '';
  escalationDraft = '';
  caseDraft = { title: '', summary: '', owner: '' };
  activeNotes: CommunityOpsNote[] = [];
  activeEscalations: CommunityOpsEscalation[] = [];
  activeCase: CommunityOpsCase | null = null;

  readonly actions = computed(() => {
    const entity = this.entity();
    return entity ? buildEntityActions(entity) : [];
  });

  constructor() {
    effect(() => {
      this.entity();
      this.loadJournal();
    });
  }

  moderationContext(): ModerationHandoffContext | null {
    const entity = this.entity();
    if (!entity) {
      return null;
    }

    return {
      source: 'community-ops',
      entityType: entity.entityType,
      entityId: entity.id,
      communityId: entity.communityId ?? entity.id,
      communityName: entity.communityName ?? entity.title,
      entityTitle: entity.title,
    };
  }

  saveNote(): void {
    const entity = this.entity();
    if (!entity || !this.noteDraft.trim()) {
      return;
    }
    this.journal.addNote(entity.id, this.noteDraft.trim());
    this.noteDraft = '';
    this.changed();
  }

  addEscalation(status: 'open' | 'resolved'): void {
    const entity = this.entity();
    if (!entity || !this.escalationDraft.trim()) {
      return;
    }
    this.journal.addEscalation(entity.id, this.escalationDraft.trim(), status);
    this.escalationDraft = '';
    this.changed();
  }

  createCase(): void {
    const entity = this.entity();
    const { title, summary, owner } = this.caseDraft;
    if (!entity || !title.trim() || !summary.trim() || !owner.trim()) {
      return;
    }
    this.journal.createCase(entity.id, {
      title: title.trim(),
      summary: summary.trim(),
      owner: owner.trim(),
    });
    this.caseDraft = { title: '', summary: '', owner: '' };
    this.changed();
  }

  updateCaseStatus(status: 'open' | 'resolved'): void {
    const entity = this.entity();
    if (!entity || !this.activeCase) {
      return;
    }
    this.journal.updateCaseStatus(entity.id, status);
    this.changed();
  }

  private changed(): void {
    this.loadJournal();
    this.journalChanged.emit();
  }

  private loadJournal(): void {
    const entity = this.entity();
    if (!entity) {
      this.activeNotes = [];
      this.activeEscalations = [];
      this.activeCase = null;
      return;
    }
    const entry = this.journal.forEntity(entity.id);
    this.activeNotes = entry.notes;
    this.activeEscalations = entry.escalations;
    this.activeCase = entry.caseRecord;
  }
}
