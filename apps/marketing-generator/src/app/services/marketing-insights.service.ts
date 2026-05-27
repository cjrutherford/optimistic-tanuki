import {
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ConceptFeedbackEntry,
  MarketingEvent,
  MarketingEventType,
} from '../types';

type EventPayload = Omit<MarketingEvent, 'id' | 'createdAt'>;
type FeedbackPayload = Omit<ConceptFeedbackEntry, 'id' | 'createdAt'>;

@Injectable({
  providedIn: 'root',
})
export class MarketingInsightsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly eventsKey = 'signal-foundry-insights-events';
  private readonly feedbackKey = 'signal-foundry-insights-feedback';

  readonly events = signal<MarketingEvent[]>(this.readEvents());
  readonly feedback = signal<ConceptFeedbackEntry[]>(this.readFeedback());
  readonly summary = computed(() => {
    const events = this.events();
    const feedback = this.feedback();
    const positiveFeedback = feedback.filter(
      (item) => item.sentiment === 'positive'
    ).length;
    const negativeFeedback = feedback.filter(
      (item) => item.sentiment === 'negative'
    ).length;
    const totalFeedback = positiveFeedback + negativeFeedback;

    return {
      generationRuns: this.countEvents(events, [
        'generation_requested',
        'generation_regenerated',
      ]),
      conceptSelections: this.countEvents(events, ['concept_selected']),
      compareWinners: this.countEvents(events, ['compare_winner_selected']),
      exports: this.countEvents(events, [
        'bundle_exported',
        'output_downloaded',
        'material_downloaded',
      ]),
      copies: this.countEvents(events, ['output_copied', 'material_copied']),
      blockEdits: this.countEvents(events, ['block_updated']),
      blockRegenerations: this.countEvents(events, ['block_regenerated']),
      versionsSaved: this.countEvents(events, ['workspace_version_saved']),
      versionsRestored: this.countEvents(events, [
        'workspace_version_restored',
      ]),
      positiveFeedback,
      negativeFeedback,
      usefulnessRate: totalFeedback ? positiveFeedback / totalFeedback : 0,
    };
  });

  logEvent(event: EventPayload): void {
    const next: MarketingEvent = {
      ...event,
      id: this.newId('event'),
      createdAt: new Date().toISOString(),
    };

    this.events.set([...this.events(), next]);
    this.persist(this.eventsKey, this.events());
  }

  recordConceptFeedback(feedback: FeedbackPayload): void {
    const next: ConceptFeedbackEntry = {
      ...feedback,
      id: this.newId('feedback'),
      createdAt: new Date().toISOString(),
    };

    this.feedback.set([...this.feedback(), next]);
    this.persist(this.feedbackKey, this.feedback());
  }

  feedbackSummaryForConcept(conceptId: string): {
    positive: number;
    negative: number;
    topReason: string;
  } {
    const entries = this.feedback().filter(
      (item) => item.conceptId === conceptId
    );
    const positive = entries.filter(
      (item) => item.sentiment === 'positive'
    ).length;
    const negative = entries.filter(
      (item) => item.sentiment === 'negative'
    ).length;
    const reasonCounts = entries.reduce<Record<string, number>>(
      (accumulator, item) => {
        accumulator[item.reason] = (accumulator[item.reason] || 0) + 1;
        return accumulator;
      },
      {}
    );
    const topReason =
      Object.entries(reasonCounts).sort(
        (left, right) => right[1] - left[1]
      )[0]?.[0] || '';

    return {
      positive,
      negative,
      topReason,
    };
  }

  private readEvents(): MarketingEvent[] {
    if (!this.isBrowser()) {
      return [];
    }

    const value = localStorage.getItem(this.eventsKey);
    return value ? (JSON.parse(value) as MarketingEvent[]) : [];
  }

  private readFeedback(): ConceptFeedbackEntry[] {
    if (!this.isBrowser()) {
      return [];
    }

    const value = localStorage.getItem(this.feedbackKey);
    return value ? (JSON.parse(value) as ConceptFeedbackEntry[]) : [];
  }

  private countEvents(
    events: MarketingEvent[],
    types: MarketingEventType[]
  ): number {
    return events.filter((event) => types.includes(event.type)).length;
  }

  private persist(key: string, value: unknown): void {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.setItem(key, JSON.stringify(value));
  }

  private newId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
