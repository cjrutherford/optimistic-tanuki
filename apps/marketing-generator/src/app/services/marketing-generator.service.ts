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
  ChannelType,
  ChannelOutput,
  ChannelOutputBlock,
  ChannelOutputType,
  DeliveryModel,
  GenerationRequest,
  MaterialDeliverableRequest,
  MaterialImageSlot,
  MaterialSurface,
  MaterialSurfaceType,
  MaterialTemplateFamily,
  MaterialTextBlock,
  MarketingMaterialType,
  OfferingPreset,
  PricingModel,
} from '../types';

interface ConceptAngle {
  id: string;
  label: string;
  hook: string;
  sectionType: string;
}

interface OfferingNarrative {
  positioning: string;
  valueProposition: string;
  objectives: string[];
  proofPoints: string[];
  adArchetypes: string[];
  deliveryModel?: DeliveryModel;
  pricingModel?: PricingModel;
  selfHostedNote?: string;
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
      const narrative = this.resolveOfferingNarrative(offering, request);
      const intentPrefix = this.intentPrefix(request.campaignIntent);
      const channelLabel = CHANNEL_LABELS[request.channel];
      const audienceLabel = audience.label;
      const archetype = this.selectAdArchetype(narrative, index);
      const headline = `${
        offering.name
      } for ${audienceLabel.toLowerCase()} who need ${intentPrefix}`;
      const subheadline = `${
        offering.category
      } built to ${offering.summary.toLowerCase()} ${angle.hook.toLowerCase()} Anchored in ${archetype}.`;
      const cta = this.ctaFor(request.channel, request.campaignIntent);

      return {
        id: `${offering.id}-${angle.id}-${index}`,
        angle: angle.label,
        generationMode: 'template' as const,
        workflowStatus: 'candidate' as const,
        rubric: this.buildRubric(index, angle, narrative),
        headline,
        subheadline,
        cta,
        channelLabel,
        audienceLabel,
        sectionType: angle.sectionType,
        positioning: narrative.positioning,
        valueProposition: narrative.valueProposition,
        objectives: narrative.objectives,
        proofPoints: narrative.proofPoints,
        deliveryModel: narrative.deliveryModel,
        pricingModel: narrative.pricingModel,
        selfHostedNote: narrative.selfHostedNote,
        sections: [
          {
            title: 'Positioning',
            body: narrative.positioning,
          },
          {
            title: 'Objective alignment',
            body: `${
              angle.label
            } supports ${narrative.objectives[0].toLowerCase()} while keeping the message concrete for ${audience.label.toLowerCase()}.`,
          },
          {
            title: 'Ad archetype',
            body: `${archetype} gives this direction a recognizable campaign frame for ${audience.label.toLowerCase()}.`,
          },
          {
            title: 'Proof points',
            body: narrative.proofPoints.slice(0, 2).join(' '),
          },
          {
            title: 'Why it lands',
            body: `${
              CAMPAIGN_INTENT_LABELS[request.campaignIntent]
            } concepts for ${
              request.channel
            } should center ${offering.features[0].toLowerCase()} and ${
              offering.features[1]?.toLowerCase() ||
              offering.features[0].toLowerCase()
            }.`,
          },
          {
            title: 'Audience trigger',
            body: `${audience.desiredOutcome} while keeping the promise concrete: ${angle.hook}`,
          },
          ...(narrative.deliveryModel
            ? [
                {
                  title: 'Delivery model',
                  body: this.describeDeliveryModel(narrative.deliveryModel),
                },
              ]
            : []),
          ...(narrative.pricingModel
            ? [
                {
                  title: 'Pricing model',
                  body: this.describePricingModel(narrative.pricingModel),
                },
              ]
            : []),
          ...(narrative.selfHostedNote
            ? [
                {
                  title: 'Self-hosted',
                  body: narrative.selfHostedNote,
                },
              ]
            : []),
        ],
        channelOutputs: this.buildChannelOutputs(
          request,
          offering,
          narrative,
          archetype,
          audience,
          headline,
          subheadline,
          cta,
          angle
        ),
        materialOutputs: this.buildAssets(
          request,
          offering,
          narrative,
          archetype,
          audienceLabel,
          headline,
          subheadline,
          cta,
          angle.label
        ),
      };
    });

    return concepts;
  }

  async regenerateChannelBlock(
    request: GenerationRequest,
    concept: CampaignConcept,
    output: ChannelOutput,
    block: ChannelOutputBlock
  ): Promise<string> {
    const contextLead =
      block.role === 'subject'
        ? `${concept.headline} for ${concept.audienceLabel}`
        : block.role === 'cta'
        ? this.ctaFor(request.channel, request.campaignIntent)
        : `${concept.headline} ${concept.subheadline}`.trim();
    const proofLead =
      concept.proofPoints?.[0] || concept.sections[0]?.body || '';

    switch (block.role) {
      case 'hero':
      case 'hook':
        return `${
          concept.headline
        } with ${concept.angle.toLowerCase()} clarity for ${concept.audienceLabel.toLowerCase()}.`;
      case 'subject':
        return `${this.resolveOffering(request).name}: ${concept.angle} for ${
          concept.audienceLabel
        }`;
      case 'preview':
        return `${
          concept.angle
        } for ${concept.audienceLabel.toLowerCase()}. ${proofLead}`.trim();
      case 'proof':
        return `${proofLead} ${concept.valueProposition || ''}`.trim();
      case 'cta':
        return this.ctaFor(request.channel, request.campaignIntent);
      case 'caption':
        return `${contextLead} ${
          concept.valueProposition || ''
        } ${proofLead}`.trim();
      default:
        return `${contextLead} ${concept.valueProposition || ''}`.trim();
    }
  }

  async regenerateMaterialTextBlock(
    request: GenerationRequest,
    concept: CampaignConcept,
    asset: CampaignAsset,
    surface: MaterialSurface,
    block: MaterialTextBlock
  ): Promise<string> {
    const brandName =
      request.brand.businessName || this.resolveOffering(request).name;
    const proofLead =
      concept.proofPoints?.[0] || concept.sections[0]?.body || '';

    switch (block.role) {
      case 'headline':
        return `${brandName}: ${concept.angle} for ${concept.audienceLabel}`;
      case 'subheadline':
        return `${
          concept.subheadline
        } Built for ${asset.label.toLowerCase()} ${surface.label.toLowerCase()}.`;
      case 'body':
        return `${proofLead} ${concept.valueProposition || ''}`.trim();
      case 'cta':
        return this.ctaFor(request.channel, request.campaignIntent);
      case 'contact':
        return `${brandName} | ${concept.audienceLabel} | ${
          concept.objectives?.[0] || concept.angle
        }`;
    }
  }

  private resolveOffering(request: GenerationRequest): OfferingPreset {
    if (request.offeringKind === 'custom-app') {
      return {
        id: 'custom-app',
        kind: 'preset-app',
        name: request.customApp.name.trim() || 'Custom app',
        category:
          request.customApp.category.trim() || 'Custom software product',
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
        positioning:
          'A custom software product shaped for a specific audience and a clear operating goal.',
        valueProposition:
          request.customApp.primaryGoal.trim() ||
          'Turn a custom product brief into a campaign system with concrete outputs.',
        objectives: [
          'Clarify the custom product promise quickly',
          'Show why the offer is relevant to the chosen audience',
          'Create campaign-ready material from the brief',
        ],
        proofPoints: this.splitOrFallback(
          request.customApp.features,
          'workflow clarity, structured messaging, fast concept iteration'
        ),
        adArchetypes: [
          'custom product launch',
          'offer clarification',
          'audience-fit campaign',
        ],
        deliveryModel: 'hosted',
        pricingModel: 'subscription-unlimited',
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

  private resolveOfferingNarrative(
    offering: OfferingPreset,
    request: GenerationRequest
  ): OfferingNarrative {
    return {
      positioning:
        offering.positioning ||
        `${
          offering.name
        } is positioned around ${offering.differentiators[0].toLowerCase()}.`,
      valueProposition:
        offering.valueProposition ||
        `${offering.name} helps teams act on ${offering.summary.toLowerCase()}`,
      objectives: offering.objectives?.length
        ? offering.objectives
        : [
            `Increase clarity around ${offering.name}`,
            `Turn interest into action for ${request.channel}`,
          ],
      proofPoints: offering.proofPoints?.length
        ? offering.proofPoints
        : [
            `${offering.features[0]} keeps the offer concrete`,
            `${offering.differentiators[0]} differentiates the product`,
          ],
      adArchetypes: offering.adArchetypes?.length
        ? offering.adArchetypes
        : ['operator clarity', 'offer proof'],
      deliveryModel: offering.deliveryModel,
      pricingModel: offering.pricingModel,
      selfHostedNote: offering.selfHostedNote,
    };
  }

  private describeDeliveryModel(deliveryModel: DeliveryModel): string {
    switch (deliveryModel) {
      case 'hosted':
        return 'Hosted';
      case 'self-hosted':
        return 'Self-hosted';
      case 'hybrid':
        return 'Hybrid hosted and self-hosted';
      case 'npm-package':
        return 'npm package';
    }
  }

  private describePricingModel(pricingModel: PricingModel): string {
    switch (pricingModel) {
      case 'metered':
        return 'Metered usage';
      case 'block-usage':
        return 'Block usage';
      case 'subscription-unlimited':
        return 'Subscription unlimited';
      case 'free':
        return 'Free';
    }
  }

  private selectAdArchetype(
    narrative: OfferingNarrative,
    index: number
  ): string {
    return (
      narrative.adArchetypes[index % narrative.adArchetypes.length] ||
      'offer proof'
    );
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
    narrative: OfferingNarrative,
    archetype: string,
    audience: (typeof AUDIENCE_PERSONAS)[number],
    headline: string,
    subheadline: string,
    cta: string,
    angle: ConceptAngle
  ): ChannelOutput[] {
    const channels = [
      request.channel,
      ...request.secondaryChannels.filter(
        (channel) => channel !== request.channel
      ),
    ];

    return channels.map((channel, index) =>
      this.createChannelOutput(
        this.outputTypeForChannel(channel),
        request,
        offering,
        narrative,
        archetype,
        audience,
        headline,
        subheadline,
        cta,
        angle,
        index === 0
      )
    );
  }

  private outputTypeForChannel(channel: ChannelType): ChannelOutputType {
    switch (channel) {
      case 'web':
        return 'landing-page';
      case 'email':
        return 'email-sequence';
      case 'social':
        return 'social-campaign';
    }
  }

  private buildRubric(
    index: number,
    angle: ConceptAngle,
    narrative: OfferingNarrative
  ): {
    clarity: number;
    differentiation: number;
    specificity: number;
    actionability: number;
  } {
    const base = 7 + (index % 2);

    return {
      clarity: Math.min(
        10,
        base + (angle.id === 'operator' || angle.id === 'proof' ? 1 : 0)
      ),
      differentiation: Math.min(
        10,
        base + (narrative.adArchetypes.length > 2 ? 1 : 0)
      ),
      specificity: Math.min(
        10,
        base + (narrative.proofPoints.length > 1 ? 1 : 0)
      ),
      actionability: Math.min(
        10,
        base + (angle.id === 'outcome' || angle.id === 'contrast' ? 1 : 0)
      ),
    };
  }

  private createChannelOutput(
    type: ChannelOutputType,
    request: GenerationRequest,
    offering: OfferingPreset,
    narrative: OfferingNarrative,
    archetype: string,
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
      summary: `${summary} ${narrative.valueProposition} Archetype: ${archetype}.`,
      isPrimary,
      blocks: this.buildChannelBlocks(
        id,
        type,
        request,
        offering,
        narrative,
        archetype,
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
    narrative: OfferingNarrative,
    archetype: string,
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
          value: `${subheadline} ${
            narrative.valueProposition
          } Built for ${audience.desiredOutcome.toLowerCase()} through the ${archetype} frame.`,
        },
        {
          id: `${outputId}-proof`,
          role: 'proof',
          label: 'Proof strip',
          value: `${narrative.proofPoints[0]} ${
            narrative.proofPoints[1] || ''
          }`.trim(),
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
          value: `${angle.hook} ${narrative.proofPoints[0]} Archetype: ${archetype}.`,
        },
        {
          id: `${outputId}-supporting`,
          role: 'supporting',
          label: 'Email body',
          value: `${headline}. ${narrative.valueProposition} ${narrative.proofPoints[0]} ${archetype}.`,
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
        value: `${subheadline} ${angle.hook} ${narrative.valueProposition} ${archetype}.`,
      },
      {
        id: `${outputId}-proof`,
        role: 'proof',
        label: 'Proof line',
        value: `${
          narrative.proofPoints[0]
        } for ${audience.desiredOutcome.toLowerCase()}.`,
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
    narrative: OfferingNarrative,
    archetype: string,
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
        narrative,
        archetype,
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
    narrative: OfferingNarrative,
    archetype: string,
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
      templateFamily: preset.templateFamily,
      templateName: layoutVariant,
      surfaces: preset.surfaces.map((surfaceType, surfaceIndex) =>
        this.buildSurface(
          deliverable.type,
          assetId,
          surfaceType,
          surfaceIndex,
          request,
          offering,
          narrative,
          archetype,
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
    narrative: OfferingNarrative,
    archetype: string,
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
        narrative,
        archetype,
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
    narrative: OfferingNarrative,
    archetype: string,
    audienceLabel: string,
    headline: string,
    subheadline: string,
    cta: string,
    angle: string
  ): MaterialTextBlock[] {
    const rolePrefix = `${this.typeLabel(type)} ${this.surfaceLabel(
      surfaceType
    )}`;

    return [
      {
        id: `${surfaceId}-headline`,
        role: 'headline',
        label: `${rolePrefix} headline`,
        value:
          surfaceType === 'front' || surfaceType === 'single'
            ? `${headline} ${archetype}`.trim()
            : `${offering.name}: ${angle} for ${audienceLabel}`,
      },
      {
        id: `${surfaceId}-subheadline`,
        role: 'subheadline',
        label: `${rolePrefix} subheadline`,
        value:
          surfaceType === 'back' ? narrative.valueProposition : subheadline,
      },
      {
        id: `${surfaceId}-body`,
        role: 'body',
        label: `${rolePrefix} body`,
        value: `${`${narrative.proofPoints[0]} ${
          narrative.proofPoints[1] || ''
        }`.trim()} ${archetype}`.trim(),
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
        value: `${offering.name} | ${audienceLabel} | ${narrative.objectives[0]}`,
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
      prompt: `${this.typeLabel(type)} ${this.surfaceLabel(
        surfaceType
      ).toLowerCase()} concept for ${
        offering.name
      }, ${angle.toLowerCase()}, audience ${audienceLabel.toLowerCase()}, style ${
        style || 'clean modern marketing'
      }, colors ${request.brand.primaryColor} and ${request.brand.accentColor}`,
      alt: `${offering.name} ${this.surfaceLabel(
        surfaceType
      ).toLowerCase()} preview`,
      imageUrl: null,
      status: request.generateImages ? 'prompt-ready' : 'prompt-disabled',
      imageBase64: null,
      errorMessage: request.generateImages
        ? null
        : 'Image prompt preparation disabled.',
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
