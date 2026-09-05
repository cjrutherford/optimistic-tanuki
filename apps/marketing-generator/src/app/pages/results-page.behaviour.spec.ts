import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { MarketingEnrichmentApiService } from '../services/marketing-enrichment-api.service';
import { MarketingGeneratorService } from '../services/marketing-generator.service';
import { MarketingInsightsService } from '../services/marketing-insights.service';
import { MarketingStateService } from '../services/marketing-state.service';
import {
  CampaignAsset,
  CampaignConcept,
  ChannelOutput,
  ConceptWorkflowStatus,
  DeliveryModel,
  GenerationProvenance,
  GenerationRequest,
  MarketingEvent,
  MarketingWorkspace,
  PricingModel,
} from '../types';
import { ResultsPageComponent } from './results-page.component';

// Named interfaces (rather than index-signature maps) because
// noPropertyAccessFromIndexSignature forbids dotted access on those.
interface InsightsSummaryStub {
  generationRuns: number;
  conceptSelections: number;
  compareWinners: number;
  exports: number;
  copies: number;
  blockEdits: number;
  blockRegenerations: number;
  versionsSaved: number;
  versionsRestored: number;
  positiveFeedback: number;
  negativeFeedback: number;
  usefulnessRate: number;
}

interface InsightsStub {
  summary: WritableSignal<InsightsSummaryStub>;
  events: WritableSignal<MarketingEvent[]>;
  feedbackSummaryForConcept: jest.Mock;
  logEvent: jest.Mock;
  recordConceptFeedback: jest.Mock;
}

interface GeneratorStub {
  generateConcepts: jest.Mock;
  regenerateChannelBlock: jest.Mock;
  regenerateMaterialTextBlock: jest.Mock;
}

interface EnrichmentStub {
  enrichConcepts: jest.Mock;
  generateConcepts: jest.Mock;
}

interface StateStub {
  request: WritableSignal<GenerationRequest>;
  concepts: WritableSignal<CampaignConcept[]>;
  workspaces: WritableSignal<MarketingWorkspace[]>;
  currentWorkspaceId: WritableSignal<string>;
  currentWorkspace: jest.Mock;
  setRequest: jest.Mock;
  setConcepts: jest.Mock;
  setSelectedConceptId: jest.Mock;
  setDecisionSummary: jest.Mock;
  createWorkspace: jest.Mock;
  renameCurrentWorkspace: jest.Mock;
  duplicateCurrentWorkspace: jest.Mock;
  selectWorkspace: jest.Mock;
  saveWorkspaceVersion?: jest.Mock;
  restoreWorkspaceVersion?: jest.Mock;
}

interface Harness {
  fixture: ComponentFixture<ResultsPageComponent>;
  component: ResultsPageComponent;
  state: StateStub;
  generator: GeneratorStub;
  enrichment: EnrichmentStub;
  insights: InsightsStub;
  navigate: jest.SpyInstance;
}

function buildRequest(overrides: Partial<GenerationRequest> = {}) {
  const request: GenerationRequest = {
    offeringKind: 'preset-app',
    selectedOfferingId: 'forgeofwill',
    customApp: {
      name: '',
      category: '',
      summary: '',
      features: '',
      differentiators: '',
      primaryGoal: '',
    },
    audienceId: 'technical-buyers',
    campaignIntent: 'awareness',
    channel: 'web',
    // 'web' duplicates the primary channel so normalizedRequest() has something to strip.
    secondaryChannels: ['web', 'email'],
    tone: 'technical',
    includeAiPolish: false,
    deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
    brand: {
      businessName: 'Forge of Will',
      tagline: '',
      primaryColor: '#f59e0b',
      secondaryColor: '#111827',
      accentColor: '#34d399',
      visualStyle: '',
      logoUrl: '',
    },
    visualDirection: '',
    generateImages: false,
    ...overrides,
  };

  return request;
}

function buildChannelOutputs(): ChannelOutput[] {
  return [
    {
      id: 'web-output',
      type: 'landing-page',
      label: 'Landing page draft',
      summary: 'A web-first story arc.',
      isPrimary: true,
      blocks: [
        {
          id: 'web-hero',
          role: 'hero',
          label: 'Hero headline',
          value: 'Keep execution and context in one operating surface.',
        },
        {
          id: 'web-support',
          role: 'supporting',
          label: 'Hero support',
          value: '<p>Built for operators who need direction.</p>',
        },
        {
          id: 'web-cta',
          role: 'cta',
          label: 'Primary CTA',
          value: 'Explore the offer',
        },
      ],
    },
    {
      id: 'email-output',
      type: 'email-sequence',
      label: 'Email sequence draft',
      summary: 'A supporting nurture sequence.',
      isPrimary: false,
      blocks: [
        {
          id: 'email-subject',
          role: 'subject',
          label: 'Email subject',
          value: 'Execution and context, in one surface.',
        },
      ],
    },
    {
      id: 'social-output',
      type: 'social-campaign',
      label: 'Social campaign draft',
      summary: 'A social-first campaign set.',
      isPrimary: false,
      blocks: [
        {
          id: 'social-hook',
          role: 'hook',
          label: 'Social hook',
          value: 'One operating surface.',
        },
      ],
    },
  ];
}

function buildFlyerAsset(): CampaignAsset {
  return {
    id: 'asset-flyer',
    type: 'flyer',
    formatId: 'flyer-letter',
    label: 'Letter Flyer',
    canvas: { width: 1275, height: 1650, unit: 'px', dpi: 150 },
    layoutVariant: 'hero-focus',
    surfaces: [
      {
        id: 'surface-front',
        label: 'Front',
        type: 'front',
        textBlocks: [
          {
            id: 'front-headline',
            role: 'headline',
            label: 'Headline',
            value: '<p>Execution stays visible.</p>',
          },
          {
            id: 'front-cta',
            role: 'cta',
            label: 'Flyer CTA',
            value: 'Explore the offer',
          },
        ],
        imageSlots: [
          {
            id: 'front-image',
            prompt: 'Operator console at dusk',
            alt: 'Operator console',
            imageUrl: 'https://cdn.example.com/hero.png',
            status: 'complete',
            imageBase64: null,
            errorMessage: null,
          },
        ],
      },
      {
        // The back surface is never the default selection, so it is a safe place
        // to park image slots whose URLs must be rejected by the export path.
        id: 'surface-back',
        label: 'Back',
        type: 'back',
        textBlocks: [
          {
            id: 'back-body',
            role: 'body',
            label: 'Body',
            value: 'Plans, notes, and risk stay connected.',
          },
        ],
        imageSlots: [
          {
            id: 'back-relative-image',
            prompt: 'Wireframe grid',
            alt: 'Wireframe grid',
            imageUrl: '/local/only.png',
            status: 'prompt-ready',
            imageBase64: null,
            errorMessage: null,
          },
          {
            id: 'back-broken-image',
            prompt: 'Broken payload',
            alt: 'Broken payload',
            imageUrl: null,
            status: 'prompt-ready',
            imageBase64: 'not-base64<script>',
            errorMessage: null,
          },
        ],
      },
    ],
    downloadFileName: 'forgeofwill-flyer',
    isPrimary: true,
  };
}

function buildCardAsset(): CampaignAsset {
  return {
    id: 'asset-card',
    type: 'business-card',
    formatId: 'card-standard',
    label: 'Business Card',
    canvas: { width: 1050, height: 600, unit: 'px', dpi: 300 },
    layoutVariant: 'minimal',
    surfaces: [
      {
        id: 'surface-card',
        label: 'Card face',
        type: 'single',
        textBlocks: [
          {
            id: 'card-contact',
            role: 'contact',
            label: 'Contact',
            value: 'hello@forgeofwill.dev',
          },
        ],
        imageSlots: [
          {
            id: 'card-image',
            prompt: 'Logo mark',
            alt: 'Logo mark',
            imageUrl: null,
            status: 'complete',
            imageBase64: 'aGVsbG8=',
            errorMessage: null,
          },
        ],
      },
    ],
    downloadFileName: 'forgeofwill-card',
    isPrimary: false,
  };
}

function buildConcepts(): CampaignConcept[] {
  return [
    {
      id: 'concept-1',
      angle: 'Operator command center',
      generationMode: 'template',
      generationProvenance: 'template-only',
      workflowStatus: 'candidate',
      rubric: {
        clarity: 8,
        differentiation: 7,
        specificity: 8,
        actionability: 7,
      },
      headline: 'Keep execution and context in one operating surface.',
      subheadline: 'Built for operators who need direction and momentum.',
      cta: 'Explore the offer',
      channelLabel: 'Web landing concept',
      audienceLabel: 'Technical Buyers',
      sectionType: 'Narrative landing',
      sections: [
        { title: 'Positioning', body: 'Operator-first execution workflow.' },
      ],
      channelOutputs: buildChannelOutputs(),
      materialOutputs: [buildFlyerAsset(), buildCardAsset()],
    },
    {
      id: 'concept-2',
      angle: 'Trust by proof',
      generationMode: 'template',
      generationProvenance: 'template-only',
      workflowStatus: 'candidate',
      rubric: {
        clarity: 7,
        differentiation: 8,
        specificity: 7,
        actionability: 8,
      },
      headline: 'Show the system in plain language.',
      subheadline: 'Proof-led framing for technical buyers.',
      cta: 'Explore the offer',
      channelLabel: 'Web landing concept',
      audienceLabel: 'Technical Buyers',
      sectionType: 'Proof grid',
      sections: [{ title: 'Proof points', body: 'Concrete proof copy.' }],
      channelOutputs: [
        {
          id: 'proof-output',
          type: 'landing-page',
          label: 'Proof landing draft',
          summary: 'A proof-led story arc.',
          isPrimary: true,
          blocks: [
            {
              id: 'proof-hero',
              role: 'hero',
              label: 'Hero headline',
              value: 'Show the system in plain language.',
            },
          ],
        },
      ],
      materialOutputs: [],
    },
  ];
}

function buildWorkspace(
  overrides: Partial<MarketingWorkspace> = {}
): MarketingWorkspace {
  const request = buildRequest();
  const concepts = buildConcepts();

  return {
    id: 'workspace-1',
    name: 'Current Workspace',
    createdAt: '2026-05-26T12:00:00.000Z',
    updatedAt: '2026-05-26T12:00:00.000Z',
    request,
    concepts,
    selectedConceptId: 'concept-1',
    versions: [
      {
        id: 'version-1',
        name: 'Initial version',
        createdAt: '2026-05-26T12:00:00.000Z',
        request,
        concepts,
        selectedConceptId: 'concept-1',
      },
    ],
    ...overrides,
  };
}

function buildInsightsStub(events: MarketingEvent[] = []): InsightsStub {
  return {
    summary: signal<InsightsSummaryStub>({
      generationRuns: 3,
      conceptSelections: 2,
      compareWinners: 0,
      exports: 1,
      copies: 0,
      blockEdits: 0,
      blockRegenerations: 4,
      versionsSaved: 0,
      versionsRestored: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      usefulnessRate: 0,
    }),
    events: signal<MarketingEvent[]>(events),
    feedbackSummaryForConcept: jest.fn(() => ({
      positive: 2,
      negative: 1,
      topReason: 'useful',
    })),
    logEvent: jest.fn(),
    recordConceptFeedback: jest.fn(),
  };
}

interface SetupOptions {
  request?: GenerationRequest;
  concepts?: CampaignConcept[];
  workspace?: MarketingWorkspace | null;
  workspaces?: MarketingWorkspace[];
  currentWorkspaceId?: string;
  events?: MarketingEvent[];
  routeParams?: Record<string, string>;
  omitVersionApis?: boolean;
  onSelectWorkspace?: (
    id: string,
    state: StateStub
  ) => MarketingWorkspace | null;
}

async function setup(options: SetupOptions = {}): Promise<Harness> {
  const requestSignal = signal(options.request ?? buildRequest());
  const conceptsSignal = signal(options.concepts ?? buildConcepts());
  const workspace =
    'workspace' in options ? options.workspace : buildWorkspace();
  let activeWorkspace: MarketingWorkspace | null = workspace ?? null;

  const state: StateStub = {
    request: requestSignal,
    concepts: conceptsSignal,
    workspaces: signal(options.workspaces ?? (workspace ? [workspace] : [])),
    currentWorkspaceId: signal(options.currentWorkspaceId ?? 'workspace-1'),
    currentWorkspace: jest.fn(() => activeWorkspace),
    setRequest: jest.fn((next: GenerationRequest) => requestSignal.set(next)),
    // The real service persists concepts, so the stub mirrors that write back
    // into the signal the component reads from.
    setConcepts: jest.fn((next: CampaignConcept[]) => conceptsSignal.set(next)),
    setSelectedConceptId: jest.fn(),
    setDecisionSummary: jest.fn(),
    createWorkspace: jest.fn(),
    renameCurrentWorkspace: jest.fn(),
    duplicateCurrentWorkspace: jest.fn(),
    selectWorkspace: jest.fn(),
  };

  state.selectWorkspace.mockImplementation((id: string) => {
    if (options.onSelectWorkspace) {
      activeWorkspace = options.onSelectWorkspace(id, state);
    }
  });

  if (!options.omitVersionApis) {
    state.saveWorkspaceVersion = jest.fn();
    state.restoreWorkspaceVersion = jest.fn();
  }

  const generator: GeneratorStub = {
    generateConcepts: jest.fn().mockResolvedValue([]),
    regenerateChannelBlock: jest.fn().mockResolvedValue('Regenerated block.'),
    regenerateMaterialTextBlock: jest
      .fn()
      .mockResolvedValue('Regenerated material block.'),
  };
  const enrichment: EnrichmentStub = {
    enrichConcepts: jest.fn(),
    generateConcepts: jest.fn(),
  };
  const insights = buildInsightsStub(options.events);

  await TestBed.resetTestingModule()
    .configureTestingModule({
      imports: [ResultsPageComponent],
      providers: [
        provideRouter([]),
        { provide: MarketingStateService, useValue: state },
        { provide: MarketingGeneratorService, useValue: generator },
        { provide: MarketingEnrichmentApiService, useValue: enrichment },
        { provide: MarketingInsightsService, useValue: insights },
        ...(options.routeParams
          ? [
              {
                provide: ActivatedRoute,
                useValue: {
                  paramMap: of(convertToParamMap(options.routeParams)),
                },
              },
            ]
          : []),
      ],
    })
    .compileComponents();

  const navigate = jest
    .spyOn(TestBed.inject(Router), 'navigate')
    .mockResolvedValue(true);
  const fixture = TestBed.createComponent(ResultsPageComponent);

  return {
    fixture,
    component: fixture.componentInstance,
    state,
    generator,
    enrichment,
    insights,
    navigate,
  };
}

// The jsdom build behind this jest environment ships a Blob without text(),
// so downloaded payloads are read back through FileReader instead.
function readBlob(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function feedbackText(fixture: ComponentFixture<ResultsPageComponent>): string {
  return Array.from(fixture.nativeElement.querySelectorAll('.copy-feedback'))
    .map((element) => (element as HTMLElement).textContent?.trim() ?? '')
    .join(' | ');
}

describe('ResultsPageComponent behaviour', () => {
  let downloads: Array<{ filename: string; blob: Blob }>;
  let lastBlob: Blob | null;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let revokeObjectURL: jest.Mock;

  beforeEach(() => {
    downloads = [];
    lastBlob = null;
    revokeObjectURL = jest.fn();

    // jsdom implements neither object URLs nor anchor-driven downloads, so the
    // download path is observed through these seams instead.
    URL.createObjectURL = jest.fn((blob: Blob) => {
      lastBlob = blob;
      return 'blob:results-page-mock';
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL =
      revokeObjectURL as unknown as typeof URL.revokeObjectURL;

    jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push({
          filename: this.download,
          blob: lastBlob as Blob,
        });
      });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    delete (navigator as { clipboard?: unknown }).clipboard;
    jest.restoreAllMocks();
  });

  function stubClipboard(): jest.Mock {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    return writeText;
  }

  describe('label helpers', () => {
    it.each<[DeliveryModel, string]>([
      ['hosted', 'Hosted'],
      ['self-hosted', 'Self-hosted'],
      ['hybrid', 'Hybrid hosted and self-hosted'],
      ['npm-package', 'npm package'],
    ])('describes the %s delivery model', async (model, expected) => {
      const { component } = await setup();
      expect(component.describeDeliveryModel(model)).toBe(expected);
    });

    it.each<[PricingModel, string]>([
      ['metered', 'Metered usage'],
      ['block-usage', 'Block usage'],
      ['subscription-unlimited', 'Subscription unlimited'],
      ['free', 'Free'],
    ])('describes the %s pricing model', async (model, expected) => {
      const { component } = await setup();
      expect(component.describePricingModel(model)).toBe(expected);
    });

    it.each<[ConceptWorkflowStatus | undefined, string]>([
      ['selected', 'Selected'],
      ['shortlisted', 'Shortlisted'],
      ['archived', 'Archived'],
      [undefined, 'Candidate'],
    ])('labels the %s workflow status', async (status, expected) => {
      const { component } = await setup();
      expect(component.workflowLabel(status)).toBe(expected);
    });

    it.each<[GenerationProvenance | undefined, string]>([
      ['ai-generated', 'AI-generated'],
      ['ai-enriched', 'AI enriched'],
      ['ai-fallback', 'AI fallback'],
      [undefined, 'Template only'],
    ])('labels %s provenance', async (provenance, expected) => {
      const { component } = await setup();
      expect(component.provenanceLabel(provenance)).toBe(expected);
      expect(
        component.provenanceDescription(provenance).length
      ).toBeGreaterThan(0);
    });

    it('formats the saved-at stamp for missing, invalid and valid timestamps', async () => {
      const { component } = await setup();

      expect(component.formatSavedAt('')).toBe(
        'Saved locally during this session'
      );
      expect(component.formatSavedAt('not-a-date')).toBe('Saved locally');
      expect(component.formatSavedAt('2026-05-26T12:00:00.000Z')).toBe(
        `Saved locally ${new Date('2026-05-26T12:00:00.000Z').toLocaleString()}`
      );
    });

    it('sanitizes rich text for preview and strips markup for plain text', async () => {
      const { component } = await setup();

      expect(component.previewRegionHtml('<p onclick="steal()">Hi</p>')).toBe(
        '<p>Hi</p>'
      );
      expect(component.previewRegionHtml('Plain & simple')).toBe(
        '<p>Plain &amp; simple</p>'
      );
      expect(component.previewRegionHtml('   ')).toBe('<p></p>');
      expect(component.plainText('<p>Hi   <b>there</b></p>')).toBe('Hi there');
    });
  });

  describe('selection', () => {
    it('records a concept selection and switches the rendered detail card', async () => {
      const { fixture, component, state, insights } = await setup();
      fixture.detectChanges();

      component.selectConcept('concept-2');
      fixture.detectChanges();

      expect(state.setSelectedConceptId).toHaveBeenCalledWith('concept-2');
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'concept_selected',
          conceptId: 'concept-2',
          workspaceId: 'workspace-1',
        })
      );
      expect(
        fixture.nativeElement.querySelector('.detail-card h2').textContent
      ).toContain('Show the system in plain language.');
    });

    it('activates the chosen channel output card', async () => {
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.selectChannelOutput('email-output');
      fixture.detectChanges();

      const active = fixture.nativeElement.querySelector(
        '.channel-grid .channel-card.active'
      );
      expect(active.textContent).toContain('Email sequence draft');
    });

    it('activates a material asset when its card is clicked', async () => {
      const { fixture } = await setup();
      fixture.detectChanges();

      const cards: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.material-grid .material-card')
      );
      cards[1].click();
      fixture.detectChanges();

      expect(cards[1].classList.contains('active')).toBe(true);
      expect(cards[0].classList.contains('active')).toBe(false);
      expect(
        fixture.nativeElement.querySelector('.surface-workbench').textContent
      ).toContain('Contact');
    });

    it('falls back to the first surface when the selected surface id is unknown', async () => {
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.selectMaterialOutput('asset-flyer', 'surface-missing');
      fixture.detectChanges();

      const activeTab = fixture.nativeElement.querySelector(
        '.surface-tabs button.active'
      );
      expect(activeTab.textContent).toContain('Front');
    });

    it('syncs the channel selection when a channel editor surface is activated', async () => {
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.setActiveEditorSurface('surface-email-output');
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector(
          '.channel-grid .channel-card.active'
        ).textContent
      ).toContain('Email sequence draft');
      expect(
        fixture.nativeElement.querySelector('.inspector-pane h3').textContent
      ).toContain('Email subject');
    });

    it('syncs the material and surface selection when a material editor surface is activated', async () => {
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.setActiveEditorSurface('surface-asset-flyer-surface-back');
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('.surface-tabs button.active')
          .textContent
      ).toContain('Back');
      expect(
        fixture.nativeElement.querySelector('.inspector-pane h3').textContent
      ).toContain('Body');
    });

    it('selects an explicit preview region', async () => {
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.selectPreviewRegion('region-web-output-web-cta');
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('.inspector-pane h3').textContent
      ).toContain('Primary CTA');
    });
  });

  describe('block editing', () => {
    it('writes a channel block edit back through the state service', async () => {
      const { fixture, component, state } = await setup();
      fixture.detectChanges();

      component.updateChannelBlock('web-output', 'web-hero', 'Revised hero.');

      const stored = state.concepts()[0].channelOutputs[0].blocks[0];
      expect(stored.value).toBe('Revised hero.');
      expect(state.concepts()[0].channelOutputs[1].blocks[0].value).toBe(
        'Execution and context, in one surface.'
      );
    });

    it('writes a material text block edit back through the state service', async () => {
      const { fixture, component, state } = await setup();
      fixture.detectChanges();

      component.updateMaterialTextBlock(
        'asset-flyer',
        'surface-front',
        'front-cta',
        'Book the walkthrough'
      );

      expect(
        state.concepts()[0].materialOutputs[0].surfaces[0].textBlocks[1].value
      ).toBe('Book the walkthrough');
      expect(
        state.concepts()[0].materialOutputs[1].surfaces[0].textBlocks[0].value
      ).toBe('hello@forgeofwill.dev');
    });

    it.each([
      ['updateMaterialImageUrl', 'imageUrl', 'https://cdn.example.com/new.png'],
      ['updateMaterialImageAlt', 'alt', 'Refreshed alt copy'],
      ['updateMaterialImagePrompt', 'prompt', 'A calmer console shot'],
    ])(
      'applies %s to the targeted image slot',
      async (method, field, value) => {
        const { fixture, component, state } = await setup();
        fixture.detectChanges();

        const callable = component as unknown as Record<
          string,
          (m: string, s: string, slot: string, next: string) => void
        >;
        callable[method]('asset-flyer', 'surface-front', 'front-image', value);

        const slot = state.concepts()[0].materialOutputs[0].surfaces[0]
          .imageSlots[0] as unknown as Record<string, unknown>;
        expect(slot[field]).toBe(value);
        expect(slot['id']).toBe('front-image');
      }
    );

    it('routes a preview-region edit to the backing channel block', async () => {
      const { fixture, component, state } = await setup();
      fixture.detectChanges();

      component.selectPreviewRegion('region-web-output-web-support');
      component.updateSelectedPreviewRegion('<p>Sharper support line.</p>');

      expect(state.concepts()[0].channelOutputs[0].blocks[1].value).toBe(
        '<p>Sharper support line.</p>'
      );
    });

    it('routes a preview-region edit to the backing material block', async () => {
      const { fixture, component, state } = await setup();
      fixture.detectChanges();

      component.setActiveEditorSurface('surface-asset-card-surface-card');
      component.updateSelectedPreviewRegion('team@forgeofwill.dev');

      expect(
        state.concepts()[0].materialOutputs[1].surfaces[0].textBlocks[0].value
      ).toBe('team@forgeofwill.dev');
    });

    it('logs channel, material and image block edits with their surface metadata', async () => {
      const { fixture, component, insights } = await setup();
      fixture.detectChanges();

      component.recordChannelBlockEdit('web-output', 'web-hero');
      component.recordMaterialBlockEdit(
        'asset-flyer',
        'surface-front',
        'front-headline'
      );
      component.recordMaterialImageEdit('asset-flyer', 'front-image');

      expect(insights.logEvent).toHaveBeenNthCalledWith(1, {
        type: 'block_updated',
        workspaceId: 'workspace-1',
        conceptId: 'concept-1',
        outputId: 'web-output',
        blockId: 'web-hero',
        metadata: { surface: 'channel' },
      });
      expect(insights.logEvent).toHaveBeenNthCalledWith(2, {
        type: 'block_updated',
        workspaceId: 'workspace-1',
        conceptId: 'concept-1',
        outputId: 'asset-flyer',
        blockId: 'front-headline',
        metadata: { surface: 'surface-front' },
      });
      expect(insights.logEvent).toHaveBeenNthCalledWith(3, {
        type: 'block_updated',
        workspaceId: 'workspace-1',
        conceptId: 'concept-1',
        outputId: 'asset-flyer',
        blockId: 'front-image',
        metadata: { surface: 'image' },
      });
    });

    it('logs the selected preview region edit against its channel block', async () => {
      const { fixture, component, insights } = await setup();
      fixture.detectChanges();

      component.selectPreviewRegion('region-web-output-web-cta');
      component.recordSelectedPreviewRegionEdit();

      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'block_updated',
          outputId: 'web-output',
          blockId: 'web-cta',
          metadata: { surface: 'channel' },
        })
      );
    });

    it('logs the selected preview region edit against its material block', async () => {
      const { fixture, component, insights } = await setup();
      fixture.detectChanges();

      component.setActiveEditorSurface('surface-asset-card-surface-card');
      component.recordSelectedPreviewRegionEdit();

      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'block_updated',
          outputId: 'asset-card',
          blockId: 'card-contact',
          metadata: { surface: 'surface-card' },
        })
      );
    });
  });

  describe('regeneration', () => {
    it('regenerates a channel block and reports it', async () => {
      const { fixture, component, generator, state, insights } = await setup();
      fixture.detectChanges();

      await component.regenerateSelectedChannelBlock('web-output', 'web-cta');
      fixture.detectChanges();

      expect(generator.regenerateChannelBlock).toHaveBeenCalledWith(
        expect.objectContaining({ secondaryChannels: ['email'] }),
        expect.objectContaining({ id: 'concept-1' }),
        expect.objectContaining({ id: 'web-output' }),
        expect.objectContaining({ id: 'web-cta' })
      );
      expect(state.concepts()[0].channelOutputs[0].blocks[2].value).toBe(
        'Regenerated block.'
      );
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'block_regenerated',
          blockId: 'web-cta',
          metadata: { surface: 'channel' },
        })
      );
      expect(feedbackText(fixture)).toContain('Primary CTA regenerated.');
    });

    it('ignores a channel block regeneration for an unknown block', async () => {
      const { fixture, component, generator } = await setup();
      fixture.detectChanges();

      await component.regenerateSelectedChannelBlock('web-output', 'nope');
      await component.regenerateSelectedChannelBlock('nope', 'web-cta');

      expect(generator.regenerateChannelBlock).not.toHaveBeenCalled();
    });

    it('regenerates a material text block and reports it', async () => {
      const { fixture, component, generator, state, insights } = await setup();
      fixture.detectChanges();

      await component.regenerateSelectedMaterialBlock(
        'asset-flyer',
        'surface-front',
        'front-headline'
      );
      fixture.detectChanges();

      expect(generator.regenerateMaterialTextBlock).toHaveBeenCalledWith(
        expect.objectContaining({ secondaryChannels: ['email'] }),
        expect.objectContaining({ id: 'concept-1' }),
        expect.objectContaining({ id: 'asset-flyer' }),
        expect.objectContaining({ id: 'surface-front' }),
        expect.objectContaining({ id: 'front-headline' })
      );
      expect(
        state.concepts()[0].materialOutputs[0].surfaces[0].textBlocks[0].value
      ).toBe('Regenerated material block.');
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'block_regenerated',
          outputId: 'asset-flyer',
          metadata: { surface: 'surface-front' },
        })
      );
      expect(feedbackText(fixture)).toContain('Headline regenerated.');
    });

    it.each([
      ['asset-flyer', 'surface-front', 'missing-block'],
      ['asset-flyer', 'missing-surface', 'front-headline'],
      ['missing-asset', 'surface-front', 'front-headline'],
    ])(
      'ignores a material regeneration for %s/%s/%s',
      async (assetId, surfaceId, blockId) => {
        const { fixture, component, generator } = await setup();
        fixture.detectChanges();

        await component.regenerateSelectedMaterialBlock(
          assetId,
          surfaceId,
          blockId
        );

        expect(generator.regenerateMaterialTextBlock).not.toHaveBeenCalled();
      }
    );

    it('regenerates the selected preview region through the channel path', async () => {
      const { fixture, component, generator } = await setup();
      fixture.detectChanges();

      component.selectPreviewRegion('region-web-output-web-support');
      await component.regenerateSelectedPreviewRegion();

      expect(generator.regenerateChannelBlock).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ id: 'web-output' }),
        expect.objectContaining({ id: 'web-support' })
      );
    });

    it('regenerates the selected preview region through the material path', async () => {
      const { fixture, component, generator } = await setup();
      fixture.detectChanges();

      component.setActiveEditorSurface('surface-asset-card-surface-card');
      await component.regenerateSelectedPreviewRegion();

      expect(generator.regenerateMaterialTextBlock).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ id: 'asset-card' }),
        expect.objectContaining({ id: 'surface-card' }),
        expect.objectContaining({ id: 'card-contact' })
      );
    });

    it('does nothing when there is no preview region to act on', async () => {
      const bareConcept = {
        ...buildConcepts()[0],
        channelOutputs: [],
        materialOutputs: [],
      };
      const { component, generator, state } = await setup({
        concepts: [bareConcept],
      });

      component.updateSelectedPreviewRegion('ignored');
      component.recordSelectedPreviewRegionEdit();
      await component.regenerateSelectedPreviewRegion();

      expect(state.setConcepts).not.toHaveBeenCalled();
      expect(generator.regenerateChannelBlock).not.toHaveBeenCalled();
    });
  });

  describe('regenerate the concept set', () => {
    const llmConcept: CampaignConcept = {
      ...buildConcepts()[0],
      id: 'gen-llm',
      generationMode: 'llm',
    };
    const hybridConcept: CampaignConcept = {
      ...buildConcepts()[1],
      id: 'gen-hybrid',
      generationMode: 'hybrid',
    };
    const templateConcept: CampaignConcept = {
      ...buildConcepts()[1],
      id: 'gen-template',
      generationMode: 'template',
    };

    it('marks concepts template-only and skips enrichment when AI polish is off', async () => {
      const { component, generator, enrichment, state, insights } = await setup(
        {
          request: buildRequest({ includeAiPolish: false }),
        }
      );
      generator.generateConcepts.mockResolvedValue([
        llmConcept,
        templateConcept,
      ]);

      await component.regenerate();

      expect(state.setRequest).toHaveBeenCalledWith(
        expect.objectContaining({ secondaryChannels: ['email'] })
      );
      expect(generator.generateConcepts).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'web' })
      );
      expect(enrichment.generateConcepts).not.toHaveBeenCalled();
      expect(
        state.concepts().map((concept) => concept.generationProvenance)
      ).toEqual(['template-only', 'template-only']);
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'generation_regenerated',
          conceptId: 'concept-1',
          metadata: { channel: 'web' },
        })
      );
    });

    it('derives per-mode provenance and token metadata from an applied enrichment run', async () => {
      const { component, generator, enrichment, state, insights } = await setup(
        {
          request: buildRequest({ includeAiPolish: true }),
        }
      );
      const baseConcepts = [llmConcept, hybridConcept, templateConcept];
      generator.generateConcepts.mockResolvedValue(baseConcepts);
      enrichment.generateConcepts.mockResolvedValue({
        concepts: baseConcepts,
        generationApplied: true,
        usage: { promptTokens: 320, completionTokens: 96, model: 'gemma3' },
      });

      await component.regenerate();

      expect(enrichment.generateConcepts).toHaveBeenCalledWith(
        expect.objectContaining({ secondaryChannels: ['email'] }),
        baseConcepts
      );
      expect(
        state.concepts().map((concept) => concept.generationProvenance)
      ).toEqual(['ai-generated', 'ai-enriched', 'template-only']);
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'generation_regenerated',
          metadata: {
            channel: 'web',
            promptTokens: 320,
            completionTokens: 96,
            model: 'gemma3',
          },
        })
      );
    });

    it('falls back to ai-fallback provenance when enrichment did not apply', async () => {
      const { component, generator, enrichment, state } = await setup({
        request: buildRequest({ includeAiPolish: true }),
      });
      const baseConcepts = [llmConcept, hybridConcept];
      generator.generateConcepts.mockResolvedValue(baseConcepts);
      enrichment.generateConcepts.mockResolvedValue({
        concepts: baseConcepts,
        generationApplied: false,
      });

      await component.regenerate();

      expect(
        state.concepts().map((concept) => concept.generationProvenance)
      ).toEqual(['ai-fallback', 'ai-fallback']);
    });
  });

  describe('clipboard', () => {
    it('copies the full strategy payload for the selected concept', async () => {
      const writeText = stubClipboard();
      const { fixture, component } = await setup();
      fixture.detectChanges();

      await component.copyConcept();
      fixture.detectChanges();

      const payload = writeText.mock.calls[0][0] as string;
      expect(payload).toContain(
        'Keep execution and context in one operating surface.'
      );
      expect(payload).toContain('Hero headline: Keep execution and context');
      expect(payload).toContain('Layout: hero-focus');
      expect(payload).toContain(
        'Image: Operator console | complete | https://cdn.example.com/hero.png'
      );
      expect(feedbackText(fixture)).toContain(
        'Strategy and outputs copied to clipboard.'
      );
    });

    it('copies a single channel output and logs the copy', async () => {
      const writeText = stubClipboard();
      const { fixture, component, insights } = await setup();
      fixture.detectChanges();

      await component.copyOutput(
        buildChannelOutputs()[1] as unknown as ChannelOutput
      );
      fixture.detectChanges();

      expect(writeText).toHaveBeenCalledWith(
        [
          'Email sequence draft',
          'A supporting nurture sequence.',
          'Email subject: Execution and context, in one surface.',
        ].join('\n')
      );
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'output_copied',
          outputId: 'email-output',
        })
      );
      expect(feedbackText(fixture)).toContain(
        'Email sequence draft copied to clipboard.'
      );
    });

    it('copies a material asset and logs the copy', async () => {
      const writeText = stubClipboard();
      const { fixture, component, insights } = await setup();
      fixture.detectChanges();

      await component.copyMaterial(buildCardAsset());

      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('Contact: hello@forgeofwill.dev')
      );
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'material_copied',
          outputId: 'asset-card',
        })
      );
    });

    it('copies the active editor surface through the channel path', async () => {
      const writeText = stubClipboard();
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.setActiveEditorSurface('surface-social-output');
      await component.copyActiveSurface();

      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('Social hook: One operating surface.')
      );
    });

    it('copies the active editor surface through the material path', async () => {
      const writeText = stubClipboard();
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.setActiveEditorSurface('surface-asset-card-surface-card');
      await component.copyActiveSurface();

      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('Business Card')
      );
    });

    it('routes back to the generator when no clipboard is available', async () => {
      const { fixture, component, navigate } = await setup();
      fixture.detectChanges();

      await component.copyConcept();
      fixture.detectChanges();

      expect(navigate).toHaveBeenCalledWith(['/offers/new']);
      expect(feedbackText(fixture)).toContain('Clipboard unavailable here.');
    });

    it('does nothing when there is no active surface to copy or download', async () => {
      const writeText = stubClipboard();
      const bareConcept = {
        ...buildConcepts()[0],
        channelOutputs: [],
        materialOutputs: [],
      };
      const { component } = await setup({ concepts: [bareConcept] });

      await component.copyActiveSurface();
      component.downloadActiveSurface();

      expect(writeText).not.toHaveBeenCalled();
      expect(downloads).toHaveLength(0);
    });
  });

  describe('downloads', () => {
    it('downloads the markdown bundle and logs the export format', async () => {
      const { fixture, component, insights } = await setup();
      fixture.detectChanges();

      component.downloadConceptBundle('markdown');
      fixture.detectChanges();

      expect(downloads[0].filename).toBe('concept-1.md');
      expect(downloads[0].blob.type).toBe('text/markdown');
      await expect(readBlob(downloads[0].blob)).resolves.toContain(
        '# Keep execution and context in one operating surface.'
      );
      await expect(readBlob(downloads[0].blob)).resolves.toContain(
        '- forgeofwill-flyer.html'
      );
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bundle_exported',
          conceptId: 'concept-1',
          metadata: { format: 'markdown' },
        })
      );
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:results-page-mock');
      expect(feedbackText(fixture)).toContain('concept-1.md downloaded.');
    });

    it('downloads the manifest as json', async () => {
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.downloadConceptBundle('manifest');

      expect(downloads[0].filename).toBe('concept-1.manifest.json');
      const manifest = JSON.parse(await readBlob(downloads[0].blob));
      expect(manifest.businessName).toBe('Forge of Will');
      expect(manifest.channels).toEqual([
        'landing-page',
        'email-sequence',
        'social-campaign',
      ]);
    });

    it('downloads the full json bundle', async () => {
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.downloadConceptBundle('json');

      expect(downloads[0].filename).toBe('concept-1.bundle.json');
      const bundle = JSON.parse(await readBlob(downloads[0].blob));
      expect(bundle.concept.id).toBe('concept-1');
      expect(bundle.request.secondaryChannels).toEqual(['email']);
      expect(bundle.files.map((file: { path: string }) => file.path)).toContain(
        'forgeofwill-card.html'
      );
    });

    it('downloads a channel output as markdown and as html', async () => {
      const { fixture, component, insights } = await setup();
      fixture.detectChanges();

      const output = buildChannelOutputs()[0];
      component.downloadOutput(output);
      component.downloadOutputHtml(output);

      expect(downloads.map((entry) => entry.filename)).toEqual([
        'web-output.md',
        'web-output.html',
      ]);
      await expect(readBlob(downloads[1].blob)).resolves.toContain(
        '<title>Landing page draft</title>'
      );
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'output_downloaded',
          metadata: { format: 'markdown' },
        })
      );
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'output_downloaded',
          metadata: { format: 'html' },
        })
      );
    });

    it('renders social-campaign channel exports with the dark chrome', async () => {
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.downloadOutputHtml(buildChannelOutputs()[2]);

      await expect(readBlob(downloads[0].blob)).resolves.toContain(
        'linear-gradient(155deg, #111827, #1f2937)'
      );
    });

    it('embeds only safe image sources in a material export', async () => {
      const { fixture, component, insights } = await setup();
      fixture.detectChanges();

      component.downloadMaterial(buildFlyerAsset());

      expect(downloads[0].filename).toBe('forgeofwill-flyer.html');
      const html = await readBlob(downloads[0].blob);
      expect(html).toContain('<img src="https://cdn.example.com/hero.png"');
      // The relative URL and the malformed base64 payload must both degrade to
      // the prompt placeholder rather than reaching the src attribute.
      expect(html).not.toContain('/local/only.png');
      expect(html).not.toContain('not-base64');
      expect(html).toContain('<strong>Wireframe grid</strong>');
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'material_downloaded',
          outputId: 'asset-flyer',
        })
      );
    });

    it('embeds a well-formed base64 payload as a data url', async () => {
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.downloadMaterial(buildCardAsset());

      await expect(readBlob(downloads[0].blob)).resolves.toContain(
        '<img src="data:image/png;base64,aGVsbG8="'
      );
    });

    it('downloads the active editor surface through the channel path', async () => {
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.setActiveEditorSurface('surface-email-output');
      component.downloadActiveSurface();

      expect(downloads[0].filename).toBe('email-output.html');
    });

    it('downloads the active editor surface through the material path', async () => {
      const { fixture, component } = await setup();
      fixture.detectChanges();

      component.setActiveEditorSurface('surface-asset-card-surface-card');
      component.downloadActiveSurface();

      expect(downloads[0].filename).toBe('forgeofwill-card.html');
    });
  });

  describe('workflow status', () => {
    it('marks one concept selected and demotes the rest', async () => {
      const archived = buildConcepts();
      archived[1] = { ...archived[1], workflowStatus: 'archived' };
      const { fixture, component, state } = await setup({ concepts: archived });
      fixture.detectChanges();

      component.markConceptSelected('concept-1');

      expect(state.concepts().map((concept) => concept.workflowStatus)).toEqual(
        ['selected', 'archived']
      );
    });

    it('toggles a concept in and out of the shortlist', async () => {
      const { fixture, component, state, insights } = await setup();
      fixture.detectChanges();

      component.toggleShortlistConcept('concept-2');
      expect(state.concepts()[1].workflowStatus).toBe('shortlisted');

      component.toggleShortlistConcept('concept-2');
      expect(state.concepts()[1].workflowStatus).toBe('candidate');
      expect(state.concepts()[0].workflowStatus).toBe('candidate');
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'concept_shortlisted' })
      );
    });

    it('keeps at most two concepts in the compare tray and removes on re-toggle', async () => {
      const concepts = buildConcepts();
      concepts.push({ ...concepts[1], id: 'concept-3' });
      const { fixture, component } = await setup({ concepts });
      fixture.detectChanges();

      component.toggleCompareConcept('concept-1');
      component.toggleCompareConcept('concept-2');
      component.toggleCompareConcept('concept-3');
      fixture.detectChanges();

      const compared = Array.from(
        fixture.nativeElement.querySelectorAll('.compare-grid .channel-card')
      ).map((card) => (card as HTMLElement).textContent ?? '');
      expect(compared).toHaveLength(2);
      expect(compared[0]).toContain('Show the system in plain language.');

      component.toggleCompareConcept('concept-2');
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelectorAll('.compare-grid .channel-card')
      ).toHaveLength(0);
    });

    it('archives the losing concepts and snapshots a version when a winner is chosen', async () => {
      const concepts = buildConcepts();
      concepts[1] = { ...concepts[1], workflowStatus: 'shortlisted' };
      const { fixture, component, state, insights } = await setup({ concepts });
      fixture.detectChanges();

      component.toggleCompareConcept('concept-1');
      component.toggleCompareConcept('concept-2');
      component.chooseComparedWinner('concept-2');

      expect(state.concepts().map((concept) => concept.workflowStatus)).toEqual(
        ['archived', 'selected']
      );
      expect(state.setDecisionSummary).toHaveBeenCalledWith(
        'Winner chosen: Show the system in plain language. over 1 compared option.'
      );
      expect(state.saveWorkspaceVersion).toHaveBeenCalledWith(
        'Winner selected: Show the system in plain language.'
      );
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'compare_winner_selected',
          conceptId: 'concept-2',
        })
      );
    });

    it('ignores a compare winner that is not in the concept set', async () => {
      const { fixture, component, state } = await setup();
      fixture.detectChanges();

      component.chooseComparedWinner('concept-missing');

      expect(state.setDecisionSummary).not.toHaveBeenCalled();
      expect(state.setSelectedConceptId).not.toHaveBeenCalled();
    });

    it('records concept feedback against the current workspace', async () => {
      const { fixture, component, insights } = await setup();
      fixture.detectChanges();

      component.submitConceptFeedback('negative', 'too-generic');
      fixture.detectChanges();

      expect(insights.recordConceptFeedback).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        conceptId: 'concept-1',
        sentiment: 'negative',
        reason: 'too-generic',
      });
      expect(feedbackText(fixture)).toContain('Feedback recorded.');
    });
  });

  describe('workspaces', () => {
    it('creates a new workspace from the current brief', async () => {
      const { fixture, component, state } = await setup();
      fixture.detectChanges();

      component.createWorkspaceFromCurrent();

      expect(state.setRequest).toHaveBeenCalledWith(
        expect.objectContaining({ secondaryChannels: ['email'] })
      );
      expect(state.createWorkspace).toHaveBeenCalledWith('Current Workspace');
    });

    it('renames and duplicates the current workspace', async () => {
      const { fixture, component, state } = await setup({
        workspace: buildWorkspace({ name: 'Launch Offer' }),
      });
      fixture.detectChanges();

      component.renameWorkspace();
      component.duplicateWorkspace();

      expect(state.renameCurrentWorkspace).toHaveBeenCalledWith('Launch Offer');
      expect(state.duplicateCurrentWorkspace).toHaveBeenCalled();
    });

    it('saves a numbered workspace snapshot', async () => {
      const { fixture, component, state, insights } = await setup();
      fixture.detectChanges();

      component.saveWorkspaceVersion();

      expect(state.saveWorkspaceVersion).toHaveBeenCalledWith(
        'Current Workspace snapshot 2'
      );
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workspace_version_saved',
          conceptId: 'concept-1',
        })
      );
    });

    it('restores a workspace version and reports it', async () => {
      const restored = buildWorkspace({
        name: 'Restored Offer',
        selectedConceptId: 'concept-2',
      });
      const { fixture, component, state, insights } = await setup();
      state.restoreWorkspaceVersion?.mockImplementation(() => {
        state.currentWorkspace.mockReturnValue(restored);
      });
      fixture.detectChanges();

      component.restoreWorkspaceVersion('version-1');
      fixture.detectChanges();

      expect(state.restoreWorkspaceVersion).toHaveBeenCalledWith('version-1');
      expect(
        fixture.nativeElement.querySelector('.workspace-stack h3').textContent
      ).toContain('Restored Offer');
      expect(
        fixture.nativeElement.querySelector('.detail-card h2').textContent
      ).toContain('Show the system in plain language.');
      expect(feedbackText(fixture)).toContain('Workspace version restored.');
      expect(insights.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workspace_version_restored',
          conceptId: 'concept-2',
        })
      );
    });

    it('skips version APIs the state service does not expose', async () => {
      const { fixture, component, insights } = await setup({
        omitVersionApis: true,
      });
      fixture.detectChanges();

      component.saveWorkspaceVersion();
      component.restoreWorkspaceVersion('version-1');

      expect(insights.logEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'workspace_version_saved' })
      );
      expect(insights.logEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'workspace_version_restored' })
      );
    });

    it('loads another workspace and rebinds the request, name and selection', async () => {
      const second = buildWorkspace({
        id: 'workspace-2',
        name: 'Second Offer',
        selectedConceptId: 'concept-2',
        request: buildRequest({ channel: 'email', secondaryChannels: [] }),
      });
      const { fixture, component, state } = await setup({
        workspaces: [buildWorkspace(), second],
        onSelectWorkspace: (id, current) => {
          if (id !== 'workspace-2') {
            return buildWorkspace();
          }
          current.request.set(second.request);
          return second;
        },
      });
      fixture.detectChanges();

      component.loadWorkspace('workspace-2');
      fixture.detectChanges();

      expect(state.selectWorkspace).toHaveBeenCalledWith('workspace-2');
      expect(
        fixture.nativeElement.querySelector('.workspace-stack h3').textContent
      ).toContain('Second Offer');
      expect(
        fixture.nativeElement.querySelector('.detail-card h2').textContent
      ).toContain('Show the system in plain language.');
      expect(
        fixture.nativeElement.querySelector('.deck-list').textContent
      ).toContain('Primary channel: Email');
    });

    it('loads the workspace named by the route when it differs from the active one', async () => {
      const { fixture, state } = await setup({
        currentWorkspaceId: 'workspace-1',
        routeParams: { offerId: 'workspace-2' },
      });
      fixture.detectChanges();

      expect(state.selectWorkspace).toHaveBeenCalledWith('workspace-2');
    });

    it('ignores a route offer id that already matches the active workspace', async () => {
      const { fixture, state } = await setup({
        currentWorkspaceId: 'workspace-1',
        routeParams: { offerId: 'workspace-1' },
      });
      fixture.detectChanges();

      expect(state.selectWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('command deck', () => {
    it('reads token usage from the most recent generation event that carries it', async () => {
      const events: MarketingEvent[] = [
        {
          id: 'event-1',
          type: 'generation_requested',
          createdAt: '2026-05-26T12:00:00.000Z',
          metadata: {
            promptTokens: 320,
            completionTokens: 96,
            model: 'gemma3',
          },
        },
        {
          id: 'event-2',
          type: 'generation_regenerated',
          createdAt: '2026-05-26T12:01:00.000Z',
          metadata: { channel: 'web' },
        },
        {
          id: 'event-3',
          type: 'concept_selected',
          createdAt: '2026-05-26T12:02:00.000Z',
        },
      ];
      const { fixture } = await setup({ events });
      fixture.detectChanges();

      const deck =
        fixture.nativeElement.querySelector('.deck-list').textContent;
      expect(deck).toContain('320 prompt');
      expect(deck).toContain('96 completion');
      expect(deck).toContain('gemma3');
    });

    it('falls back to locally derived workspace status when the service exposes none', async () => {
      const { fixture } = await setup();
      fixture.detectChanges();

      const deck =
        fixture.nativeElement.querySelector('.deck-card-primary').textContent;
      expect(deck).toContain('Browser storage only');
      expect(deck).toContain('Saved locally during this session');
      expect(deck).toContain('Current Workspace');
    });

    it('renders the usage signal metrics from the insights summary', async () => {
      const { fixture } = await setup();
      fixture.detectChanges();

      const metrics =
        fixture.nativeElement.querySelector('.metric-grid').textContent;
      expect(metrics).toContain('3generation runs');
      expect(metrics).toContain('4block regenerations');
    });

    it('renders the empty state when no concepts exist', async () => {
      const { fixture } = await setup({ concepts: [] });
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('.empty-state')
      ).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.results-layout')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain(
        'Open an offer workspace first.'
      );
    });
  });
});
