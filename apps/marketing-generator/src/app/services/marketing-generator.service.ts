import { Injectable } from '@angular/core';
import {
  MATERIAL_FORMAT_PRESETS,
  findMaterialFormatPreset,
} from '../data/material-format-presets';
import {
  AUDIENCE_PERSONAS,
  CAMPAIGN_INTENT_LABELS,
  CHANNEL_LABELS,
  OFFERING_PRESETS,
} from '../data/presets';
import {
  CampaignAsset,
  CampaignConcept,
  CampaignIntent,
  ChannelOutput,
  ChannelOutputBlock,
  ChannelOutputType,
  GenerationRequest,
  MaterialDeliverableRequest,
  MaterialImageSlot,
  MaterialSurface,
  MaterialSurfaceType,
  MaterialTextBlock,
  MarketingMaterialType,
  OfferingPreset,
} from '../types';

interface ConceptAngle {
  id: string;
  label: string;
  hook: string;
  sectionType: string;
}

const CONCEPT_ANGLES: ConceptAngle[] = [
  {
    id: 'operator',
    label: 'Operator clarity',
    hook: 'Make the next operational decision easier to take.',
    sectionType: 'Narrative landing',
  },
  {
    id: 'velocity',
    label: 'Delivery velocity',
    hook: 'Remove drag between curiosity and action.',
    sectionType: 'Launch hero',
  },
  {
    id: 'proof',
    label: 'Trust by proof',
    hook: 'Show the system in plain language instead of vague promises.',
    sectionType: 'Proof grid',
  },
  {
    id: 'identity',
    label: 'Audience identity',
    hook: 'Reflect how the audience already describes their work.',
    sectionType: 'Editorial story',
  },
  {
    id: 'outcome',
    label: 'Outcome first',
    hook: 'Lead with the before-and-after transformation.',
    sectionType: 'Conversion stack',
  },
  {
    id: 'contrast',
    label: 'Category contrast',
    hook: 'Position the offer against the clutter around it.',
    sectionType: 'Statement panel',
  },
];

@Injectable({
  providedIn: 'root',
})
export class MarketingGeneratorService {
  async generateConcepts(
    request: GenerationRequest
  ): Promise<CampaignConcept[]> {
    const offering = this.resolveOffering(request);
    const audience = AUDIENCE_PERSONAS.find(
      (persona) => persona.id === request.audienceId
    );

    if (!audience) {
      throw new Error(`Unknown audience persona: ${request.audienceId}`);
    }

    const concepts = CONCEPT_ANGLES.map((angle, index) => {
      const intentPrefix = this.intentPrefix(request.campaignIntent);
      const channelLabel = CHANNEL_LABELS[request.channel];
      const audienceLabel = audience.label;
      const headline = `${offering.name} for ${audienceLabel.toLowerCase()} who need ${intentPrefix}`;
      const subheadline = `${offering.category} built to ${offering.summary.toLowerCase()} ${angle.hook.toLowerCase()}`;
      const cta = this.ctaFor(request.channel, request.campaignIntent);

      return {
        id: `${offering.id}-${angle.id}-${index}`,
        angle: angle.label,
        generationMode: 'template' as const,
        headline,
        subheadline,
        cta,
        channelLabel,
        audienceLabel,
        sectionType: angle.sectionType,
        sections: [
          {
            title: 'Positioning',
            body: `${offering.name} helps ${audience.profile.toLowerCase()} by focusing on ${offering.differentiators[0].toLowerCase()}.`,
          },
          {
            title: 'Why it lands',
            body: `${CAMPAIGN_INTENT_LABELS[request.campaignIntent]} concepts for ${request.channel} should center ${offering.features[0].toLowerCase()} and ${offering.features[1]?.toLowerCase() || offering.features[0].toLowerCase()}.`,
          },
          {
            title: 'Audience trigger',
            body: `${audience.desiredOutcome} while keeping the promise concrete: ${angle.hook}`,
          },
        ],
        channelOutputs: this.buildChannelOutputs(
          request,
          offering,
          audience,
          headline,
          subheadline,
          cta,
          angle
        ),
        materialOutputs: this.buildAssets(
          request,
          offering,
          audienceLabel,
          headline,
          subheadline,
          cta,
          angle.label
        ),
      };
    });

    if (!request.includeAiPolish) {
      return concepts;
    }

    return concepts.map((concept, index) =>
      index % 2 === 0
        ? {
            ...concept,
            generationMode: 'hybrid',
            subheadline: `${concept.subheadline} Tuned with a sharper ${request.tone} tone and channel-specific pacing.`,
            channelOutputs: concept.channelOutputs.map((output) =>
              output.isPrimary
                ? {
                    ...output,
                    summary: `${output.summary} Tuned for a sharper ${request.tone} channel pace.`,
                    blocks: output.blocks.map((block) =>
                      block.role === 'supporting' || block.role === 'caption'
                        ? {
                            ...block,
                            value: `${block.value} Tuned for a sharper ${request.tone} delivery.`,
                          }
                        : block
                    ),
                  }
                : output
            ),
            materialOutputs: concept.materialOutputs.map((asset) =>
              asset.isPrimary
                ? {
                    ...asset,
                    surfaces: asset.surfaces.map((surface) => ({
                      ...surface,
                      textBlocks: surface.textBlocks.map((block) =>
                        block.role === 'body'
                          ? {
                              ...block,
                              value: `${block.value} Tuned for a sharper ${request.tone} delivery.`,
                            }
                          : block
                      ),
                    })),
                  }
                : asset
            ),
          }
        : concept
    );
  }

  private resolveOffering(request: GenerationRequest): OfferingPreset {
    if (request.offeringKind === 'custom-app') {
      return {
        id: 'custom-app',
        kind: 'preset-app',
        name: request.customApp.name.trim() || 'Custom app',
        category: request.customApp.category.trim() || 'Custom software product',
        summary:
          request.customApp.summary.trim() ||
          'a configurable product concept for a defined audience.',
        differentiators: this.splitOrFallback(
          request.customApp.differentiators,
          'clearer positioning, faster understanding, stronger audience fit'
        ),
        features: this.splitOrFallback(
          request.customApp.features,
          'workflow clarity, structured messaging, fast concept iteration'
        ),
        audienceHint: request.customApp.primaryGoal.trim() || 'Earn response',
      };
    }

    const offering = OFFERING_PRESETS.find(
      (preset) => preset.id === request.selectedOfferingId
    );

    if (!offering) {
      throw new Error(`Unknown offering preset: ${request.selectedOfferingId}`);
    }

    return offering;
  }

  private splitOrFallback(value: string, fallback: string): string[] {
    const parsed = value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    return parsed.length > 0
      ? parsed
      : fallback.split(',').map((part) => part.trim());
  }

  private intentPrefix(intent: CampaignIntent): string {
    switch (intent) {
      case 'awareness':
        return 'a sharper first impression';
      case 'conversion':
        return 'a reason to act now';
      case 'launch':
        return 'a clear introduction to something new';
    }
  }

  private ctaFor(_channel: string, intent: CampaignIntent): string {
    return intent === 'conversion'
      ? 'Book a planning call'
      : intent === 'launch'
        ? 'See the campaign build'
        : 'Explore the offer';
  }

  private buildChannelOutputs(
    request: GenerationRequest,
    offering: OfferingPreset,
    audience: (typeof AUDIENCE_PERSONAS)[number],
    headline: string,
    subheadline: string,
    cta: string,
    angle: ConceptAngle
  ): ChannelOutput[] {
    switch (request.channel) {
      case 'web':
        return [
          this.createChannelOutput(
            'landing-page',
            request,
            offering,
            audience,
            headline,
            subheadline,
            cta,
            angle,
            true
          ),
        ];
      case 'email':
        return [
          this.createChannelOutput(
            'email-sequence',
            request,
            offering,
            audience,
            headline,
            subheadline,
            cta,
            angle,
            true
          ),
        ];
      case 'social':
        return [
          this.createChannelOutput(
            'social-campaign',
            request,
            offering,
            audience,
            headline,
            subheadline,
            cta,
            angle,
            true
          ),
        ];
    }
  }

  private createChannelOutput(
    type: ChannelOutputType,
    request: GenerationRequest,
    offering: OfferingPreset,
    audience: (typeof AUDIENCE_PERSONAS)[number],
    headline: string,
    subheadline: string,
    cta: string,
    angle: ConceptAngle,
    isPrimary: boolean
  ): ChannelOutput {
    const id = `${type}-${angle.id}`;
    const label =
      type === 'landing-page'
        ? 'Landing page draft'
        : type === 'email-sequence'
          ? 'Email sequence draft'
          : 'Social campaign draft';
    const summary =
      type === 'landing-page'
        ? `A web-first story arc for ${audience.label.toLowerCase()} anchored in ${angle.label.toLowerCase()}.`
        : type === 'email-sequence'
          ? `A short nurture sequence that translates ${angle.label.toLowerCase()} into inbox-ready copy.`
          : `A social-first campaign set that turns ${angle.label.toLowerCase()} into fast-hook messaging.`;

    return {
      id,
      type,
      label,
      summary,
      isPrimary,
      blocks: this.buildChannelBlocks(
        id,
        type,
        request,
        offering,
        audience,
        headline,
        subheadline,
        cta,
        angle
      ),
    };
  }

  private buildChannelBlocks(
    outputId: string,
    type: ChannelOutputType,
    request: GenerationRequest,
    offering: OfferingPreset,
    audience: (typeof AUDIENCE_PERSONAS)[number],
    headline: string,
    subheadline: string,
    cta: string,
    angle: ConceptAngle
  ): ChannelOutputBlock[] {
    if (type === 'landing-page') {
      return [
        {
          id: `${outputId}-hero`,
          role: 'hero',
          label: 'Hero headline',
          value: headline,
        },
        {
          id: `${outputId}-supporting`,
          role: 'supporting',
          label: 'Hero support',
          value: `${subheadline} Built for ${audience.desiredOutcome.toLowerCase()}`,
        },
        {
          id: `${outputId}-proof`,
          role: 'proof',
          label: 'Proof strip',
          value: `${offering.features[0]}, ${offering.features[1] || offering.features[0]}, and ${offering.differentiators[0]} in one concise page flow.`,
        },
        {
          id: `${outputId}-cta`,
          role: 'cta',
          label: 'Primary CTA',
          value: cta,
        },
      ];
    }

    if (type === 'email-sequence') {
      return [
        {
          id: `${outputId}-subject`,
          role: 'subject',
          label: 'Email subject',
          value: `${offering.name}: ${request.campaignIntent} message for ${audience.label}`,
        },
        {
          id: `${outputId}-preview`,
          role: 'preview',
          label: 'Preview line',
          value: `${angle.hook} ${offering.differentiators[0]} keeps the promise concrete.`,
        },
        {
          id: `${outputId}-supporting`,
          role: 'supporting',
          label: 'Email body',
          value: `${headline}. ${offering.name} gives ${audience.profile.toLowerCase()} a clearer path through ${offering.features[0].toLowerCase()} and ${offering.features[1]?.toLowerCase() || offering.features[0].toLowerCase()}.`,
        },
        {
          id: `${outputId}-cta`,
          role: 'cta',
          label: 'Email CTA',
          value: cta,
        },
      ];
    }

    return [
      {
        id: `${outputId}-hook`,
        role: 'hook',
        label: 'Social hook',
        value: headline,
      },
      {
        id: `${outputId}-caption`,
        role: 'caption',
        label: 'Primary caption',
        value: `${subheadline} ${angle.hook} ${offering.name} keeps the offer concrete for ${audience.label.toLowerCase()}.`,
      },
      {
        id: `${outputId}-proof`,
        role: 'proof',
        label: 'Proof line',
        value: `${offering.features[0]} + ${offering.differentiators[0]} for ${audience.desiredOutcome.toLowerCase()}.`,
      },
      {
        id: `${outputId}-cta`,
        role: 'cta',
        label: 'Social CTA',
        value: cta,
      },
    ];
  }

  private buildAssets(
    request: GenerationRequest,
    offering: OfferingPreset,
    audienceLabel: string,
    headline: string,
    subheadline: string,
    cta: string,
    angle: string
  ): CampaignAsset[] {
    const deliverables = request.deliverables.length
      ? request.deliverables
      : ([
          { type: 'flyer', formatId: 'flyer-letter', quantity: 1 },
        ] as MaterialDeliverableRequest[]);

    return deliverables.map((deliverable, index) =>
      this.buildAsset(
        deliverable,
        index,
        request,
        offering,
        audienceLabel,
        headline,
        subheadline,
        cta,
        angle
      )
    );
  }

  private buildAsset(
    deliverable: MaterialDeliverableRequest,
    index: number,
    request: GenerationRequest,
    offering: OfferingPreset,
    audienceLabel: string,
    headline: string,
    subheadline: string,
    cta: string,
    angle: string
  ): CampaignAsset {
    const preset =
      findMaterialFormatPreset(deliverable.type, deliverable.formatId) ||
      MATERIAL_FORMAT_PRESETS[deliverable.type][0];
    const assetId = `${deliverable.type}-${index}`;
    const layoutVariant = preset.layoutVariants[0];

    return {
      id: assetId,
      type: deliverable.type,
      formatId: preset.id,
      label: preset.label,
      canvas: {
        width: preset.width,
        height: preset.height,
        unit: preset.unit,
        dpi: preset.dpi,
      },
      layoutVariant,
      surfaces: preset.surfaces.map((surfaceType, surfaceIndex) =>
        this.buildSurface(
          deliverable.type,
          assetId,
          surfaceType,
          surfaceIndex,
          request,
          offering,
          audienceLabel,
          headline,
          subheadline,
          cta,
          angle
        )
      ),
      downloadFileName: `${offering.id}-${preset.id}-${angle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}`,
      isPrimary: index === 0,
    };
  }

  private buildSurface(
    type: MarketingMaterialType,
    assetId: string,
    surfaceType: MaterialSurfaceType,
    surfaceIndex: number,
    request: GenerationRequest,
    offering: OfferingPreset,
    audienceLabel: string,
    headline: string,
    subheadline: string,
    cta: string,
    angle: string
  ): MaterialSurface {
    const surfaceId = `${assetId}-surface-${surfaceIndex}`;

    return {
      id: surfaceId,
      label: this.surfaceLabel(surfaceType),
      type: surfaceType,
      textBlocks: this.buildTextBlocks(
        type,
        surfaceType,
        surfaceId,
        offering,
        audienceLabel,
        headline,
        subheadline,
        cta,
        angle
      ),
      imageSlots: [
        this.buildImageSlot(
          type,
          surfaceType,
          surfaceId,
          request,
          offering,
          audienceLabel,
          angle
        ),
      ],
    };
  }

  private buildTextBlocks(
    type: MarketingMaterialType,
    surfaceType: MaterialSurfaceType,
    surfaceId: string,
    offering: OfferingPreset,
    audienceLabel: string,
    headline: string,
    subheadline: string,
    cta: string,
    angle: string
  ): MaterialTextBlock[] {
    const rolePrefix = `${this.typeLabel(type)} ${this.surfaceLabel(surfaceType)}`;

    return [
      {
        id: `${surfaceId}-headline`,
        role: 'headline',
        label: `${rolePrefix} headline`,
        value:
          surfaceType === 'front' || surfaceType === 'single'
            ? headline
            : `${offering.name}: ${angle} for ${audienceLabel}`,
      },
      {
        id: `${surfaceId}-subheadline`,
        role: 'subheadline',
        label: `${rolePrefix} subheadline`,
        value:
          surfaceType === 'back'
            ? `${offering.name} keeps the promise concrete for ${audienceLabel.toLowerCase()}.`
            : subheadline,
      },
      {
        id: `${surfaceId}-body`,
        role: 'body',
        label: `${rolePrefix} body`,
        value: `${offering.name} helps ${audienceLabel.toLowerCase()} focus on ${offering.features[0].toLowerCase()} through ${angle.toLowerCase()}.`,
      },
      {
        id: `${surfaceId}-cta`,
        role: 'cta',
        label: `${rolePrefix} call to action`,
        value: cta,
      },
      {
        id: `${surfaceId}-contact`,
        role: 'contact',
        label: `${rolePrefix} contact line`,
        value: `${offering.name} | ${audienceLabel} | ${offering.audienceHint}`,
      },
    ];
  }

  private buildImageSlot(
    type: MarketingMaterialType,
    surfaceType: MaterialSurfaceType,
    surfaceId: string,
    request: GenerationRequest,
    offering: OfferingPreset,
    audienceLabel: string,
    angle: string
  ): MaterialImageSlot {
    const style = [
      request.brand.visualStyle,
      request.visualDirection,
      request.tone,
    ]
      .filter(Boolean)
      .join(', ');

    return {
      id: `${surfaceId}-image`,
      prompt: `${this.typeLabel(type)} ${this.surfaceLabel(surfaceType).toLowerCase()} concept for ${offering.name}, ${angle.toLowerCase()}, audience ${audienceLabel.toLowerCase()}, style ${style || 'clean modern marketing'}, colors ${request.brand.primaryColor} and ${request.brand.accentColor}`,
      alt: `${offering.name} ${this.surfaceLabel(surfaceType).toLowerCase()} preview`,
      imageUrl: null,
      status: request.generateImages ? 'idle' : 'failed',
      imageBase64: null,
      errorMessage: request.generateImages ? null : 'Image generation disabled.',
    };
  }

  private surfaceLabel(surfaceType: MaterialSurfaceType): string {
    switch (surfaceType) {
      case 'front':
        return 'Front';
      case 'back':
        return 'Back';
      case 'inside-left':
        return 'Inside left';
      case 'inside-right':
        return 'Inside right';
      case 'single':
        return 'Single panel';
    }
  }

  private typeLabel(type: MarketingMaterialType): string {
    switch (type) {
      case 'flyer':
        return 'Flyer';
      case 'brochure':
        return 'Brochure';
      case 'business-card':
        return 'Business card';
      case 'web-ad':
        return 'Web ad';
    }
  }
}
