import {
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  BrandProfile,
  CampaignConcept,
  GenerationRequest,
  MarketingWorkspace,
  MarketingWorkspaceStatus,
  MarketingWorkspaceVersion,
} from '../types';

const DEFAULT_BRAND: BrandProfile = {
  businessName: '',
  tagline: '',
  primaryColor: '#f59e0b',
  secondaryColor: '#111827',
  accentColor: '#34d399',
  visualStyle: '',
  logoUrl: '',
};

const DEFAULT_REQUEST: GenerationRequest = {
  offeringKind: 'preset-app',
  selectedOfferingId: 'video-client',
  customApp: {
    name: '',
    category: '',
    summary: '',
    features: '',
    differentiators: '',
    primaryGoal: '',
  },
  audienceId: 'creators',
  campaignIntent: 'awareness',
  channel: 'web',
  secondaryChannels: [],
  tone: 'editorial',
  includeAiPolish: true,
  deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
  brand: DEFAULT_BRAND,
  visualDirection: '',
  generateImages: true,
};

@Injectable({
  providedIn: 'root',
})
export class MarketingStateService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly requestKey = 'signal-foundry-request';
  private readonly conceptsKey = 'signal-foundry-concepts';
  private readonly workspacesKey = 'signal-foundry-workspaces';
  private readonly currentWorkspaceKey = 'signal-foundry-current-workspace';
  private readonly lastSavedAtKey = 'signal-foundry-last-saved-at';

  readonly request = signal<GenerationRequest>(this.readRequest());
  readonly concepts = signal<CampaignConcept[]>(this.readConcepts());
  readonly workspaces = signal<MarketingWorkspace[]>(this.readWorkspaces());
  readonly currentWorkspaceId = signal<string>(this.readCurrentWorkspaceId());
  readonly lastSavedAt = signal<string>(this.readLastSavedAt());
  readonly workspaceStatus = computed<MarketingWorkspaceStatus>(() => {
    const current = this.currentWorkspace();

    return {
      storageLabel: this.isBrowser()
        ? 'Browser storage only'
        : 'Server render preview',
      currentWorkspaceName: current?.name || 'Current Workspace',
      workspaceCount: this.workspaces().length,
      currentVersionCount: current?.versions.length || 0,
      conceptCount: current?.concepts.length || this.concepts().length,
      lastSavedAt: this.lastSavedAt(),
    };
  });

  constructor() {
    if (this.workspaces().length === 0) {
      const workspace = this.buildWorkspace(
        'Current Workspace',
        this.request(),
        this.concepts(),
        this.concepts()[0]?.id ?? ''
      );

      this.workspaces.set([workspace]);
      this.currentWorkspaceId.set(workspace.id);
      this.persist(this.workspacesKey, this.workspaces());
      this.persist(this.currentWorkspaceKey, workspace.id);
      return;
    }

    if (!this.currentWorkspace()) {
      this.selectWorkspace(this.workspaces()[0]!.id);
    }
  }

  setRequest(request: GenerationRequest): void {
    this.request.set(request);
    this.persist(this.requestKey, request);
    this.syncCurrentWorkspace({ request });
  }

  patchRequest(patch: Partial<GenerationRequest>): void {
    this.setRequest({
      ...this.request(),
      ...patch,
      customApp: {
        ...this.request().customApp,
        ...(patch.customApp || {}),
      },
      brand: {
        ...this.request().brand,
        ...(patch.brand || {}),
      },
      deliverables: patch.deliverables || this.request().deliverables,
    });
  }

  setConcepts(concepts: CampaignConcept[]): void {
    this.concepts.set(concepts);
    this.persist(this.conceptsKey, concepts);
    this.syncCurrentWorkspace({
      concepts,
      selectedConceptId:
        this.currentWorkspace()?.selectedConceptId &&
        concepts.some(
          (concept) => concept.id === this.currentWorkspace()?.selectedConceptId
        )
          ? this.currentWorkspace()!.selectedConceptId
          : concepts[0]?.id ?? '',
    });
  }

  currentWorkspace(): MarketingWorkspace | null {
    return (
      this.workspaces().find(
        (workspace) => workspace.id === this.currentWorkspaceId()
      ) || null
    );
  }

  createWorkspace(name: string): void {
    const workspace = this.buildWorkspace(
      name,
      this.request(),
      this.concepts(),
      this.concepts()[0]?.id ?? ''
    );

    this.workspaces.set([...this.workspaces(), workspace]);
    this.currentWorkspaceId.set(workspace.id);
    this.persist(this.workspacesKey, this.workspaces());
    this.persist(this.currentWorkspaceKey, workspace.id);
  }

  renameCurrentWorkspace(name: string): void {
    const current = this.currentWorkspace();
    if (!current) {
      this.createWorkspace(name);
      return;
    }

    this.replaceWorkspace({
      ...current,
      name,
      updatedAt: new Date().toISOString(),
    });
  }

  duplicateCurrentWorkspace(): void {
    const current = this.currentWorkspace();
    if (!current) {
      this.createWorkspace('Workspace Copy');
      return;
    }

    const duplicate: MarketingWorkspace = {
      ...current,
      id: this.newWorkspaceId(),
      name: `${current.name} Copy`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: current.versions.map((version) => ({
        ...version,
        id: this.newVersionId(),
      })),
    };

    this.workspaces.set([...this.workspaces(), duplicate]);
    this.persist(this.workspacesKey, this.workspaces());
  }

  selectWorkspace(id: string): void {
    const workspace = this.workspaces().find((item) => item.id === id);
    if (!workspace) {
      return;
    }

    this.currentWorkspaceId.set(id);
    this.request.set(workspace.request);
    this.concepts.set(workspace.concepts);
    this.persist(this.currentWorkspaceKey, id);
    this.persist(this.requestKey, workspace.request);
    this.persist(this.conceptsKey, workspace.concepts);
  }

  setSelectedConceptId(conceptId: string): void {
    const current = this.currentWorkspace();
    if (!current) {
      return;
    }

    this.replaceWorkspace({
      ...current,
      selectedConceptId: conceptId,
      updatedAt: new Date().toISOString(),
    });
  }

  saveWorkspaceVersion(name?: string): void {
    const current = this.currentWorkspace();
    if (!current) {
      return;
    }

    const snapshot = this.buildVersion(
      name || `Version ${current.versions.length + 1}`,
      current.request,
      current.concepts,
      current.selectedConceptId,
      current.decisionSummary
    );

    this.replaceWorkspace({
      ...current,
      updatedAt: new Date().toISOString(),
      versions: [...current.versions, snapshot],
    });
  }

  restoreWorkspaceVersion(versionId: string): void {
    const current = this.currentWorkspace();
    const version = current?.versions.find((item) => item.id === versionId);
    if (!current || !version) {
      return;
    }

    const restored: MarketingWorkspace = {
      ...current,
      request: version.request,
      concepts: version.concepts,
      selectedConceptId: version.selectedConceptId,
      decisionSummary: version.decisionSummary,
      updatedAt: new Date().toISOString(),
    };

    this.request.set(version.request);
    this.concepts.set(version.concepts);
    this.persist(this.requestKey, version.request);
    this.persist(this.conceptsKey, version.concepts);
    this.replaceWorkspace(restored);
  }

  setDecisionSummary(summary: string): void {
    const current = this.currentWorkspace();
    if (!current) {
      return;
    }

    this.replaceWorkspace({
      ...current,
      decisionSummary: summary,
      updatedAt: new Date().toISOString(),
    });
  }

  private readRequest(): GenerationRequest {
    if (!this.isBrowser()) {
      return DEFAULT_REQUEST;
    }

    const value = localStorage.getItem(this.requestKey);
    if (!value) {
      return DEFAULT_REQUEST;
    }

    const parsed = JSON.parse(value) as Partial<GenerationRequest>;
    return {
      ...DEFAULT_REQUEST,
      ...parsed,
      customApp: {
        ...DEFAULT_REQUEST.customApp,
        ...(parsed.customApp || {}),
      },
      brand: {
        ...DEFAULT_BRAND,
        ...(parsed.brand || {}),
      },
      deliverables: parsed.deliverables?.length
        ? parsed.deliverables
        : DEFAULT_REQUEST.deliverables,
    };
  }

  private readConcepts(): CampaignConcept[] {
    if (!this.isBrowser()) {
      return [];
    }

    return this.readStoredValue<CampaignConcept[]>(this.conceptsKey, []);
  }

  private readWorkspaces(): MarketingWorkspace[] {
    if (!this.isBrowser()) {
      return [];
    }

    return this.readStoredValue<MarketingWorkspace[]>(
      this.workspacesKey,
      []
    ).map((workspace) => this.hydrateWorkspace(workspace));
  }

  private readCurrentWorkspaceId(): string {
    if (!this.isBrowser()) {
      return '';
    }

    const value = localStorage.getItem(this.currentWorkspaceKey);
    if (!value) {
      return '';
    }

    try {
      return JSON.parse(value) as string;
    } catch {
      return value;
    }
  }

  private syncCurrentWorkspace(
    patch: Partial<
      Pick<MarketingWorkspace, 'request' | 'concepts' | 'selectedConceptId'>
    >
  ): void {
    const current = this.currentWorkspace();
    if (!current) {
      return;
    }

    this.replaceWorkspace({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  }

  private replaceWorkspace(next: MarketingWorkspace): void {
    this.workspaces.set(
      this.workspaces().map((workspace) =>
        workspace.id === next.id ? next : workspace
      )
    );
    this.persist(this.workspacesKey, this.workspaces());
    this.persist(this.currentWorkspaceKey, next.id);
  }

  private newWorkspaceId(): string {
    return this.newId('workspace');
  }

  private newVersionId(): string {
    return this.newId('version');
  }

  private buildWorkspace(
    name: string,
    request: GenerationRequest,
    concepts: CampaignConcept[],
    selectedConceptId: string
  ): MarketingWorkspace {
    const createdAt = new Date().toISOString();
    return {
      id: this.newWorkspaceId(),
      name,
      createdAt,
      updatedAt: createdAt,
      request,
      concepts,
      selectedConceptId,
      versions: [
        this.buildVersion(
          'Initial version',
          request,
          concepts,
          selectedConceptId
        ),
      ],
    };
  }

  private buildVersion(
    name: string,
    request: GenerationRequest,
    concepts: CampaignConcept[],
    selectedConceptId: string,
    decisionSummary?: string
  ): MarketingWorkspaceVersion {
    return {
      id: this.newVersionId(),
      name,
      createdAt: new Date().toISOString(),
      request: JSON.parse(JSON.stringify(request)) as GenerationRequest,
      concepts: JSON.parse(JSON.stringify(concepts)) as CampaignConcept[],
      selectedConceptId,
      decisionSummary,
    };
  }

  private hydrateWorkspace(workspace: MarketingWorkspace): MarketingWorkspace {
    if (workspace.versions?.length) {
      return workspace;
    }

    return {
      ...workspace,
      versions: [
        this.buildVersion(
          'Imported version',
          workspace.request,
          workspace.concepts,
          workspace.selectedConceptId,
          workspace.decisionSummary
        ),
      ],
    };
  }

  private persist(key: string, value: unknown): void {
    if (!this.isBrowser()) {
      return;
    }

    const savedAt = new Date().toISOString();
    this.lastSavedAt.set(savedAt);
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem(this.lastSavedAtKey, JSON.stringify(savedAt));
  }

  private readStoredValue<T>(key: string, fallback: T): T {
    const value = localStorage.getItem(key);
    if (!value) {
      return fallback;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      localStorage.removeItem(key);
      return fallback;
    }
  }

  private newId(prefix: string): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid
      ? `${prefix}-${uuid}`
      : `${prefix}-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 10)}`;
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private readLastSavedAt(): string {
    if (!this.isBrowser()) {
      return '';
    }

    const value = localStorage.getItem(this.lastSavedAtKey);
    if (!value) {
      return '';
    }

    try {
      return JSON.parse(value) as string;
    } catch {
      return value;
    }
  }
}
