import { Injectable } from '@angular/core';
import {
  CommunityOpsCase,
  CommunityOpsEntity,
  CommunityOpsEscalation,
  CommunityOpsJournalEntry,
  CommunityOpsNote,
} from './community-ops.model';

/** Operator notes, escalations and cases, kept per entity in localStorage. */
@Injectable({ providedIn: 'root' })
export class CommunityOpsJournalService {
  private static readonly STORAGE_KEY = 'owner-console.community-ops.journal';

  entityPressureSummary(entity: CommunityOpsEntity): string {
    const journal = this.readJournal()[entity.id];
    if (!journal) {
      return '';
    }

    const openEscalations = journal.escalations.filter(
      (entry) => entry.status === 'open'
    ).length;
    const notes = journal.notes.length;
    const parts: string[] = [];

    if (openEscalations > 0) {
      parts.push(
        `${openEscalations} open escalation${openEscalations === 1 ? '' : 's'}`
      );
    }

    if (notes > 0) {
      parts.push(`${notes} note${notes === 1 ? '' : 's'}`);
    }

    if (journal.caseRecord?.status === 'open') {
      parts.push('1 open case');
    }

    return parts.join(' · ');
  }

  readJournal(): Record<string, CommunityOpsJournalEntry> {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      const raw = localStorage.getItem(CommunityOpsJournalService.STORAGE_KEY);
      if (!raw) {
        return {};
      }
      return JSON.parse(raw) as Record<string, CommunityOpsJournalEntry>;
    } catch {
      return {};
    }
  }

  writeJournal(journal: Record<string, CommunityOpsJournalEntry>): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(
        CommunityOpsJournalService.STORAGE_KEY,
        JSON.stringify(journal)
      );
    } catch {
      // Storage full or blocked: the journal is a convenience, not a record.
    }
  }

  entityPressureScore(entity: CommunityOpsEntity): number {
    const journal = this.readJournal()[entity.id];
    if (!journal) {
      return 0;
    }

    const openEscalations = journal.escalations.filter(
      (entry) => entry.status === 'open'
    ).length;
    const casePressure = journal.caseRecord?.status === 'open' ? 20 : 0;
    return casePressure + openEscalations * 10 + journal.notes.length;
  }

  createEmptyJournal(): CommunityOpsJournalEntry {
    return {
      notes: [],
      escalations: [],
      caseRecord: null,
    };
  }

  /** Newest-first notes, escalations and the case for one entity. */
  forEntity(entityId: string): CommunityOpsJournalEntry {
    const entry = this.readJournal()[entityId] ?? this.createEmptyJournal();
    return {
      notes: [...entry.notes].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      ),
      escalations: [...entry.escalations].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      ),
      caseRecord: entry.caseRecord ?? null,
    };
  }

  addNote(entityId: string, body: string): void {
    this.update(entityId, (entry) => {
      const note: CommunityOpsNote = {
        id: this.newId(),
        body,
        createdAt: new Date().toISOString(),
        author: 'Operator',
      };
      entry.notes = [note, ...entry.notes];
    });
  }

  addEscalation(
    entityId: string,
    summary: string,
    status: 'open' | 'resolved'
  ): void {
    this.update(entityId, (entry) => {
      const escalation: CommunityOpsEscalation = {
        id: this.newId(),
        status,
        summary,
        createdAt: new Date().toISOString(),
        actor: 'Operator',
      };
      entry.escalations = [escalation, ...entry.escalations];
    });
  }

  createCase(
    entityId: string,
    draft: { title: string; summary: string; owner: string }
  ): void {
    this.update(entityId, (entry) => {
      const timestamp = new Date().toISOString();
      const record: CommunityOpsCase = {
        id: this.newId(),
        title: draft.title,
        summary: draft.summary,
        owner: draft.owner,
        status: 'open',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      entry.caseRecord = record;
    });
  }

  updateCaseStatus(entityId: string, status: 'open' | 'resolved'): void {
    this.update(entityId, (entry) => {
      if (entry.caseRecord) {
        entry.caseRecord = {
          ...entry.caseRecord,
          status,
          updatedAt: new Date().toISOString(),
        };
      }
    });
  }

  private update(
    entityId: string,
    change: (entry: CommunityOpsJournalEntry) => void
  ): void {
    const journal = this.readJournal();
    const entry = journal[entityId] ?? this.createEmptyJournal();
    change(entry);
    journal[entityId] = entry;
    this.writeJournal(journal);
  }

  private newId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
