import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { LeadsService } from './leads.service';
import {
  LeadDiscoverySource,
  LeadTopicDiscoveryIntent,
  Topic,
  TopicDiscoveryResult,
} from './leads.types';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { LocationAutocompleteSuggestion } from '@optimistic-tanuki/models';

@Component({
  selector: 'app-topics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './topics.component.html',
  styleUrl: './topics.component.scss',
})
export class TopicsComponent implements OnInit, OnDestroy {
  private readonly leadsService = inject(LeadsService);
  private readonly themeService = inject(ThemeService);
  private sub!: Subscription;
  private googleMapsCityAutocompleteSub?: Subscription;
  private googleMapsLocationAutocompleteSub?: Subscription;
  readonly availableSources = Object.values(LeadDiscoverySource);
  readonly LeadTopicDiscoveryIntent = LeadTopicDiscoveryIntent;
  readonly defaultSources: LeadDiscoverySource[] = [...this.availableSources];
  private readonly discoveryPollTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  topics: Topic[] = [];
  showAddForm = false;
  editingTopicId: string | null = null;
  selectedTopicId: string | null = null;
  formSubmitting = false;
  activeTopicId: string | null = null;
  deletingTopicId: string | null = null;
  actionError = '';
  discoveryResultsByTopicId: Record<string, TopicDiscoveryResult> = {};
  googleMapsCitySuggestions: LocationAutocompleteSuggestion[] = [];
  googleMapsLocationSuggestions: LocationAutocompleteSuggestion[] = [];
  googleMapsCityInput = '';
  googleMapsLocationInput = '';

  topicForm = {
    name: '',
    description: '',
    keywords: '',
    excludedTerms: '',
    discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
    sources: [...this.defaultSources],
    googleMapsCities: '',
    googleMapsTypes: '',
    googleMapsLocation: '',
    googleMapsRadiusMiles: 25,
    enabled: true,
  };

  ngOnInit() {
    this.themeService.setPersonality('control-center');
    this.reloadTopics();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.googleMapsCityAutocompleteSub?.unsubscribe();
    this.googleMapsLocationAutocompleteSub?.unsubscribe();
    this.discoveryPollTimers.forEach((timerId) => clearTimeout(timerId));
    this.discoveryPollTimers.clear();
  }

  get activeCount(): number {
    return this.topics.filter((t) => t.enabled).length;
  }

  get isEditing(): boolean {
    return this.editingTopicId !== null;
  }

  get hasSelectedSources(): boolean {
    return this.topicForm.sources.length > 0;
  }

  get selectedTopic(): Topic | null {
    return this.topics.find((topic) => topic.id === this.selectedTopicId) || null;
  }

  get isGoogleMapsSelected(): boolean {
    return this.topicForm.sources.includes(LeadDiscoverySource.GOOGLE_MAPS);
  }

  get selectedGoogleMapsCities(): string[] {
    return this.parseGoogleMapsCities(this.topicForm.googleMapsCities);
  }

  toggleTopic(topic: Topic) {
    this.activeTopicId = topic.id;
    this.actionError = '';

    this.leadsService
      .toggleTopic(topic)
      .pipe(
        finalize(() => {
          this.activeTopicId = null;
        })
      )
      .subscribe({
        next: () => this.reloadTopics(),
        error: () => {
          this.actionError = 'Unable to update this topic right now.';
          this.reloadTopics();
        },
      });
  }

  openAddForm() {
    this.editingTopicId = null;
    this.topicForm = {
      name: '',
      description: '',
      keywords: '',
      excludedTerms: '',
      discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
      sources: [...this.defaultSources],
      googleMapsCities: '',
      googleMapsTypes: '',
      googleMapsLocation: '',
      googleMapsRadiusMiles: 25,
      enabled: true,
    };
    this.clearLocationSuggestions();
    this.googleMapsCityInput = '';
    this.googleMapsLocationInput = '';
    this.actionError = '';
    this.showAddForm = true;
  }

  editTopic(topic: Topic) {
    this.selectTopic(topic);
    this.editingTopicId = topic.id;
    this.topicForm = {
      name: topic.name,
      description: topic.description || '',
      keywords: topic.keywords.join(', '),
      excludedTerms: (topic.excludedTerms || []).join(', '),
      discoveryIntent:
        topic.discoveryIntent || LeadTopicDiscoveryIntent.JOB_OPENINGS,
      sources: [...this.getTopicSources(topic)],
      googleMapsCities: (topic.googleMapsCities || []).join('; '),
      googleMapsTypes: (topic.googleMapsTypes || []).join(', '),
      googleMapsLocation: topic.googleMapsLocation || '',
      googleMapsRadiusMiles: topic.googleMapsRadiusMiles || 25,
      enabled: topic.enabled,
    };
    this.clearLocationSuggestions();
    this.googleMapsCityInput = '';
    this.googleMapsLocationInput = '';
    this.actionError = '';
    this.showAddForm = true;
  }

  selectTopic(topic: Topic): void {
    this.selectedTopicId = topic.id;
    this.actionError = '';
  }

  submitTopic() {
    if (!this.topicForm.name.trim()) return;
    if (!this.topicForm.sources.length) {
      this.actionError = 'Select at least one source to search.';
      return;
    }

    if (this.isGoogleMapsSelected) {
      const googleMapsLocation = this.topicForm.googleMapsLocation?.trim() || '';
      if (!this.parseGoogleMapsCities(this.topicForm.googleMapsCities).length) {
        this.actionError = 'Enter at least one Google Maps city.';
        return;
      }

      if (!this.parseCommaSeparatedList(this.topicForm.googleMapsTypes).length) {
        this.actionError = 'Enter at least one Google Maps business type.';
        return;
      }

      if (!googleMapsLocation) {
        this.actionError = 'Enter a Google Maps search location.';
        return;
      }
    }

    this.formSubmitting = true;
    this.actionError = '';

    const keywords = this.topicForm.keywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    const excludedTerms = this.parseCommaSeparatedList(this.topicForm.excludedTerms);
    const googleMapsCities = this.parseGoogleMapsCities(this.topicForm.googleMapsCities);
    const googleMapsTypes = this.parseCommaSeparatedList(this.topicForm.googleMapsTypes);
    const googleMapsLocation = this.topicForm.googleMapsLocation?.trim() || '';
    const googleMapsRadiusMiles = Number(this.topicForm.googleMapsRadiusMiles) || 25;

    const topicPayload = {
      name: this.topicForm.name.trim(),
      description: this.topicForm.description.trim(),
      keywords,
      excludedTerms,
      discoveryIntent: this.topicForm.discoveryIntent,
      sources: [...this.topicForm.sources],
      googleMapsCities: this.isGoogleMapsSelected ? googleMapsCities : undefined,
      googleMapsTypes: this.isGoogleMapsSelected ? googleMapsTypes : undefined,
      googleMapsLocation: this.isGoogleMapsSelected ? googleMapsLocation : undefined,
      googleMapsRadiusMiles: this.isGoogleMapsSelected
        ? googleMapsRadiusMiles
        : undefined,
      enabled: this.topicForm.enabled,
    };

    const request$ = this.isEditing
      ? this.leadsService.updateTopic(this.editingTopicId!, topicPayload)
      : this.leadsService.createTopic(topicPayload);

    request$
      .pipe(
        finalize(() => {
          this.formSubmitting = false;
        })
      )
      .subscribe({
        next: (topic) => {
          this.cancelAdd();
          this.reloadTopics();
          if (topic?.id && topic.enabled) {
            this.beginPollingDiscovery(topic.id);
          }
        },
        error: () => {
          this.actionError = this.isEditing
            ? 'Unable to save changes to this topic.'
            : 'Unable to create this topic.';
        },
      });
  }

  runDiscovery(topic: Topic) {
    this.selectTopic(topic);
    this.activeTopicId = topic.id;
    this.actionError = '';

    this.leadsService
      .runTopicDiscovery(topic.id)
      .pipe(
        finalize(() => {
          this.activeTopicId = null;
        })
      )
      .subscribe({
        next: (result) => {
          this.discoveryResultsByTopicId[topic.id] = result;
          this.reloadTopics();
          this.beginPollingDiscovery(topic.id, result);
        },
        error: () => {
          this.actionError = 'Unable to run discovery for this topic.';
        },
      });
  }

  cancelAdd() {
    this.topicForm = {
      name: '',
      description: '',
      keywords: '',
      excludedTerms: '',
      discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
      sources: [...this.defaultSources],
      googleMapsCities: '',
      googleMapsTypes: '',
      googleMapsLocation: '',
      googleMapsRadiusMiles: 25,
      enabled: true,
    };
    this.clearLocationSuggestions();
    this.googleMapsCityInput = '';
    this.googleMapsLocationInput = '';
    this.editingTopicId = null;
    this.actionError = '';
    this.showAddForm = false;
  }

  onGoogleMapsCitiesInput(value: string): void {
    this.googleMapsCityInput = value;
    this.searchLocationSuggestions(value.trim(), 'cities');
  }

  onGoogleMapsLocationInput(value: string): void {
    this.googleMapsLocationInput = value;
    this.searchLocationSuggestions(value.trim(), 'location');
  }

  applyGoogleMapsCitySuggestion(
    suggestion: LocationAutocompleteSuggestion
  ): void {
    this.commitGoogleMapsCity(suggestion.description);
    this.googleMapsCitySuggestions = [];
  }

  applyGoogleMapsLocationSuggestion(
    suggestion: LocationAutocompleteSuggestion
  ): void {
    this.commitGoogleMapsLocation(suggestion.description);
    this.googleMapsLocationSuggestions = [];
  }

  commitGoogleMapsCity(value?: string): void {
    const normalized = (value || this.googleMapsCityInput).trim();
    if (!normalized) {
      return;
    }
    this.topicForm.googleMapsCities = this.stringifyUniqueValues([
      ...this.selectedGoogleMapsCities,
      normalized,
    ]);
    this.googleMapsCityInput = '';
    this.googleMapsCitySuggestions = [];
  }

  removeGoogleMapsCity(city: string): void {
    this.topicForm.googleMapsCities = this.stringifyUniqueValues(
      this.selectedGoogleMapsCities.filter((value) => value !== city)
    );
  }

  commitGoogleMapsLocation(value?: string): void {
    const normalized = (value || this.googleMapsLocationInput).trim();
    if (!normalized) {
      return;
    }
    this.topicForm.googleMapsLocation = normalized;
    this.googleMapsLocationInput = '';
    this.googleMapsLocationSuggestions = [];
  }

  clearGoogleMapsLocation(): void {
    this.topicForm.googleMapsLocation = '';
    this.googleMapsLocationInput = '';
    this.googleMapsLocationSuggestions = [];
  }

  onGoogleMapsCityInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.commitGoogleMapsCity();
    }
  }

  onGoogleMapsLocationInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitGoogleMapsLocation();
    }
  }

  closeGoogleMapsSuggestions(field: 'cities' | 'location'): void {
    window.setTimeout(() => {
      if (field === 'cities') {
        this.googleMapsCitySuggestions = [];
        return;
      }
      this.googleMapsLocationSuggestions = [];
    }, 120);
  }

  toggleSource(source: LeadDiscoverySource, checked: boolean) {
    if (checked) {
      if (!this.topicForm.sources.includes(source)) {
        this.topicForm.sources = [...this.topicForm.sources, source];
      }
    } else {
      this.topicForm.sources = this.topicForm.sources.filter((item) => item !== source);
    }

    if (!this.isGoogleMapsSelected) {
      this.topicForm.googleMapsCities = '';
      this.topicForm.googleMapsLocation = '';
      this.googleMapsCityInput = '';
      this.googleMapsLocationInput = '';
      this.clearLocationSuggestions();
    }
  }

  deleteTopic(topic: Topic): void {
    if (!confirm(`Delete topic "${topic.name}"?`)) {
      return;
    }

    this.deletingTopicId = topic.id;
    this.actionError = '';
    this.leadsService
      .deleteTopic(topic.id)
      .pipe(
        finalize(() => {
          this.deletingTopicId = null;
        })
      )
      .subscribe({
        next: () => {
          if (this.selectedTopicId === topic.id) {
            this.selectedTopicId = null;
          }
          if (this.editingTopicId === topic.id) {
            this.cancelAdd();
          }
          this.reloadTopics();
        },
        error: () => {
          this.actionError = 'Unable to delete this topic right now.';
        },
      });
  }

  getTopicGoogleMapsSummary(topic: Topic): string | null {
    if (!this.getTopicSources(topic).includes(LeadDiscoverySource.GOOGLE_MAPS)) {
      return null;
    }

    const cities = topic.googleMapsCities?.filter(Boolean) || [];
    const businessTypes = topic.googleMapsTypes?.filter(Boolean) || [];
    const cityLabel = cities.length ? cities.join(', ') : 'no cities set';
    const typeLabel = businessTypes.length
      ? businessTypes.join(', ')
      : 'no business types set';
    const locationLabel = topic.googleMapsLocation || 'no search center set';
    const radiusLabel = topic.googleMapsRadiusMiles
      ? `${topic.googleMapsRadiusMiles} mi`
      : 'no radius set';
    return `${cityLabel} · ${typeLabel} · ${locationLabel} · ${radiusLabel}`;
  }

  getTopicStrategySummary(topic: Topic): string {
    if (topic.discoveryIntent === LeadTopicDiscoveryIntent.SERVICE_BUYERS) {
      const googleMapsSummary = this.getTopicGoogleMapsSummary(topic);
      return googleMapsSummary
        ? `Searching local buyer signals across ${googleMapsSummary}.`
        : 'Searching for local companies likely to buy services.';
    }

    return `Searching role and project signals across ${
      this.getTopicSources(topic).length
    } discovery sources.`;
  }

  getDiscoveryIntentLabel(intent?: LeadTopicDiscoveryIntent): string {
    return intent === LeadTopicDiscoveryIntent.SERVICE_BUYERS
      ? 'Service Buyers'
      : 'Job Openings';
  }

  getTopicSources(topic: Topic): LeadDiscoverySource[] {
    return topic.sources?.length ? topic.sources : [...this.availableSources];
  }

  formatSourceLabel(source: LeadDiscoverySource): string {
    switch (source) {
      case LeadDiscoverySource.REMOTE_OK:
        return 'Remote OK';
      case LeadDiscoverySource.WE_WORK_REMOTELY:
        return 'We Work Remotely';
      case LeadDiscoverySource.JUST_REMOTE:
        return 'JustRemote';
      case LeadDiscoverySource.GOOGLE_MAPS:
        return 'Google Maps';
      default:
        return source
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
    }
  }

    private clearLocationSuggestions(): void {
      this.googleMapsCitySuggestions = [];
      this.googleMapsLocationSuggestions = [];
    }

    private searchLocationSuggestions(
      query: string,
      target: 'cities' | 'location'
    ): void {
      if (query.length < 2) {
        if (target === 'cities') {
          this.googleMapsCitySuggestions = [];
        } else {
          this.googleMapsLocationSuggestions = [];
        }
        return;
      }

      if (target === 'cities') {
        this.googleMapsCityAutocompleteSub?.unsubscribe();
        this.googleMapsCityAutocompleteSub = this.leadsService
          .searchLocations(query)
          .subscribe({
            next: (suggestions) => {
              this.googleMapsCitySuggestions = suggestions;
            },
            error: () => {
              this.googleMapsCitySuggestions = [];
            },
          });
        return;
      }

      this.googleMapsLocationAutocompleteSub?.unsubscribe();
      this.googleMapsLocationAutocompleteSub = this.leadsService.searchLocations(
        query
      ).subscribe({
        next: (suggestions) => {
          this.googleMapsLocationSuggestions = suggestions;
        },
        error: () => {
          this.googleMapsLocationSuggestions = [];
        },
      });
    }

    getDiscoveryResult(topicId: string): TopicDiscoveryResult | null {
        return this.discoveryResultsByTopicId[topicId] || null;
    }

    isDiscoveryPending(topicId: string): boolean {
        const result = this.getDiscoveryResult(topicId);
        return result?.status === 'queued' || result?.status === 'running';
    }

    getDiscoveryActionLabel(topicId: string): string {
        const result = this.getDiscoveryResult(topicId);

        if (result?.status === 'queued') {
            return 'Queued...';
        }

        if (result?.status === 'running') {
            return 'Running...';
        }

        return this.activeTopicId === topicId ? 'Running...' : 'Run Discovery';
    }

    getDiscoverySummaryTitle(result: TopicDiscoveryResult): string {
        return result.summaryTitle || 'Discovery update';
    }

    getDiscoverySummaryBody(result: TopicDiscoveryResult): string {
        return result.summaryBody || result.message || 'Discovery status updated.';
    }

    getDiscoverySeverity(result: TopicDiscoveryResult): string {
        return result.severity || (result.status === 'failed' ? 'error' : 'info');
    }

    getDiscoverySeverityLabel(result: TopicDiscoveryResult): string {
        switch (this.getDiscoverySeverity(result)) {
            case 'success':
                return 'Healthy';
            case 'warning':
                return 'Needs Attention';
            case 'error':
                return 'Issue';
            default:
                return 'Info';
        }
    }

    getProviderStatusLabel(status?: string): string {
        switch (status) {
            case 'ok':
                return 'Healthy';
            case 'warning':
                return 'Warning';
            case 'error':
                return 'Issue';
            case 'skipped':
                return 'Skipped';
            default:
                return 'Info';
        }
    }

    private beginPollingDiscovery(topicId: string, currentResult?: TopicDiscoveryResult) {
        const result = currentResult || this.discoveryResultsByTopicId[topicId];
        if (result && result.status !== 'queued' && result.status !== 'running') {
            this.clearDiscoveryPoll(topicId);
            return;
        }

        this.clearDiscoveryPoll(topicId);
        this.leadsService.getTopicDiscoveryStatus(topicId).subscribe({
            next: (status) => {
                this.discoveryResultsByTopicId[topicId] = status;
                this.reloadTopics();
                if (status.status === 'queued' || status.status === 'running') {
                    this.scheduleDiscoveryPoll(topicId);
                } else {
                    this.clearDiscoveryPoll(topicId);
                }
            },
            error: () => {
                this.clearDiscoveryPoll(topicId);
            },
        });
    }

    private scheduleDiscoveryPoll(topicId: string) {
        this.clearDiscoveryPoll(topicId);
        const timerId = setTimeout(() => {
            this.beginPollingDiscovery(topicId, this.discoveryResultsByTopicId[topicId]);
        }, 1500);

        this.discoveryPollTimers.set(topicId, timerId);
    }

    private clearDiscoveryPoll(topicId: string) {
        const existingTimer = this.discoveryPollTimers.get(topicId);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.discoveryPollTimers.delete(topicId);
        }
    }

    private parseCommaSeparatedList(value: string): string[] {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }

    private parseGoogleMapsCities(value: string): string[] {
        return value
            .split(/\n|;/)
            .map((item) => item.replace(/[;,]+$/g, '').trim())
            .filter((item) => item.length > 0);
    }

    private stringifyUniqueValues(values: string[]): string {
        return Array.from(
          new Set(values.map((value) => value.replace(/[;,]+$/g, '').trim()).filter(Boolean))
        ).join('; ');
    }

    private reloadTopics() {
        this.sub?.unsubscribe();
        this.sub = this.leadsService.getTopics().subscribe((topics) => {
            this.topics = topics;
            if (!topics.length) {
              this.selectedTopicId = null;
              return;
            }
            if (
              !this.selectedTopicId ||
              !topics.some((topic) => topic.id === this.selectedTopicId)
            ) {
              this.selectedTopicId = topics[0].id;
            }
        });
    }
}
