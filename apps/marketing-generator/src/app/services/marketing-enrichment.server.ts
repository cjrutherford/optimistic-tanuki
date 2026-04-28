import { loadConfig } from '../config';
import { CampaignConcept, GenerationRequest } from '../types';

type FetchLike = typeof fetch;

interface EnrichmentServerOptions {
  baseUrl?: string;
  model: string;
  timeoutMs: number;
  fetchImpl?: FetchLike;
}

interface EnrichmentPayload {
  concepts?: Array<{
    id: string;
    headline?: string;
    subheadline?: string;
    sections?: Array<{ title?: string; body?: string }>;
    channelOutputs?: Array<{
      id: string;
      label?: string;
      summary?: string;
      blocks?: Array<{ id: string; value?: string }>;
    }>;
    materialOutputs?: Array<{
      id: string;
      label?: string;
      layoutVariant?: string;
      surfaces?: Array<{
        id: string;
        textBlocks?: Array<{ id: string; value?: string }>;
        imageSlots?: Array<{ id: string; prompt?: string; alt?: string }>;
      }>;
    }>;
  }>;
}

export class MarketingEnrichmentServer {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options?: Partial<EnrichmentServerOptions>) {
    const config = loadConfig();
    this.baseUrl =
      options?.baseUrl ||
      process.env['OLLAMA_BASE_URL'] ||
      `http://${config.ollama.host}:${config.ollama.port}`;
    this.model = options?.model || config.ollama.model;
    this.timeoutMs = options?.timeoutMs || config.ollama.timeoutMs;
    this.fetchImpl = options?.fetchImpl || fetch;
  }

  async enrich(
    request: GenerationRequest,
    concepts: CampaignConcept[]
  ): Promise<CampaignConcept[]> {
    try {
      const response = await this.invokeModel(request, concepts);
      const parsed = this.extractPayload(response);
      return this.mergeConcepts(concepts, parsed);
    } catch {
      return concepts;
    }
  }

  private async invokeModel(
    request: GenerationRequest,
    concepts: CampaignConcept[]
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: 'json',
          messages: [
            {
              role: 'system',
              content: this.systemPrompt(),
            },
            {
              role: 'user',
              content: this.userPrompt(request, concepts),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM request failed with ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private systemPrompt(): string {
    return `You enrich marketing campaign concepts for a product marketing generator.

Return only valid JSON with this shape:
{
  "concepts": [
    {
      "id": "<concept id>",
      "headline": "<optional enriched headline>",
      "subheadline": "<optional enriched subheadline>",
      "sections": [
        { "title": "<section title>", "body": "<rewritten section body>" }
      ],
      "channelOutputs": [
        {
          "id": "<channel output id>",
          "label": "<optional output label>",
          "summary": "<optional rewritten summary>",
          "blocks": [
            {
              "id": "<block id>",
              "value": "<optional rewritten value>"
            }
          ]
        }
      ],
      "materialOutputs": [
        {
          "id": "<material output id>",
          "label": "<optional material label>",
          "layoutVariant": "<optional material layout variant>",
          "surfaces": [
            {
              "id": "<surface id>",
              "textBlocks": [
                {
                  "id": "<text block id>",
                  "value": "<optional rewritten value>"
                }
              ],
              "imageSlots": [
                {
                  "id": "<image slot id>",
                  "prompt": "<optional rewritten prompt>",
                  "alt": "<optional rewritten alt text>"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Do not add or remove concept ids, channel output ids, block ids, material output ids, surface ids, text block ids, or image slot ids. Keep the copy concrete, specific, and format-appropriate.`;
  }

  private userPrompt(
    request: GenerationRequest,
    concepts: CampaignConcept[]
  ): string {
    return JSON.stringify({
      request,
      concepts,
      instructions: [
        'Enrich the existing concepts instead of inventing a different product.',
        'Prioritize sharper headlines, clearer subheadlines, stronger output labels, and stronger surface-level copy.',
        'Rewrite image prompts and alt text only when you can improve specificity.',
        'Keep the same concept ids, channel output ids, block ids, material output ids, surface ids, text block ids, and image slot ids so the caller can merge deterministically.',
      ],
    });
  }

  private extractPayload(response: unknown): EnrichmentPayload {
    const content =
      typeof response === 'object' &&
      response !== null &&
      'message' in response &&
      typeof (response as { message?: { content?: unknown } }).message?.content === 'string'
        ? (response as { message: { content: string } }).message.content
        : '';

    if (!content) {
      return {};
    }

    const normalized = this.extractJsonObject(content);
    return JSON.parse(normalized) as EnrichmentPayload;
  }

  private extractJsonObject(content: string): string {
    const trimmed = content.trim();
    if (trimmed.startsWith('{')) {
      return trimmed;
    }

    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('No JSON object in LLM response');
    }

    return match[0];
  }

  private mergeConcepts(
    concepts: CampaignConcept[],
    payload: EnrichmentPayload
  ): CampaignConcept[] {
    const enrichedById = new Map((payload.concepts || []).map((concept) => [concept.id, concept]));

    return concepts.map((concept) => {
      const enriched = enrichedById.get(concept.id);
      if (!enriched) {
        return concept;
      }

      const sections =
        enriched.sections && enriched.sections.length === concept.sections.length
          ? concept.sections.map((section, index) => ({
              title: enriched.sections?.[index]?.title || section.title,
              body: enriched.sections?.[index]?.body || section.body,
            }))
          : concept.sections;

      const channelOutputsById = new Map(
        (enriched.channelOutputs || []).map((output) => [output.id, output])
      );
      const materialOutputsById = new Map(
        (enriched.materialOutputs || []).map((asset) => [asset.id, asset])
      );

      return {
        ...concept,
        generationMode: 'hybrid',
        headline: enriched.headline || concept.headline,
        subheadline: enriched.subheadline || concept.subheadline,
        sections,
        channelOutputs: concept.channelOutputs.map((output) => {
          const enrichedOutput = channelOutputsById.get(output.id);
          if (!enrichedOutput) {
            return output;
          }

          const blocksById = new Map(
            (enrichedOutput.blocks || []).map((block) => [block.id, block])
          );

          return {
            ...output,
            label: enrichedOutput.label || output.label,
            summary: enrichedOutput.summary || output.summary,
            blocks: output.blocks.map((block) => {
              const enrichedBlock = blocksById.get(block.id);
              return enrichedBlock
                ? {
                    ...block,
                    value: enrichedBlock.value || block.value,
                  }
                : block;
            }),
          };
        }),
        materialOutputs: concept.materialOutputs.map((asset) => {
          const enrichedAsset = materialOutputsById.get(asset.id);
          return enrichedAsset
            ? {
                ...asset,
                label: enrichedAsset.label || asset.label,
                layoutVariant: enrichedAsset.layoutVariant || asset.layoutVariant,
                surfaces: asset.surfaces.map((surface) => {
                  const enrichedSurface = (enrichedAsset.surfaces || []).find(
                    (candidate) => candidate.id === surface.id
                  );

                  if (!enrichedSurface) {
                    return surface;
                  }

                  const textBlocksById = new Map(
                    (enrichedSurface.textBlocks || []).map((block) => [block.id, block])
                  );
                  const imageSlotsById = new Map(
                    (enrichedSurface.imageSlots || []).map((slot) => [slot.id, slot])
                  );

                  return {
                    ...surface,
                    textBlocks: surface.textBlocks.map((block) => {
                      const enrichedBlock = textBlocksById.get(block.id);
                      return enrichedBlock
                        ? {
                            ...block,
                            value: enrichedBlock.value || block.value,
                          }
                        : block;
                    }),
                    imageSlots: surface.imageSlots.map((slot) => {
                      const enrichedSlot = imageSlotsById.get(slot.id);
                      return enrichedSlot
                        ? {
                            ...slot,
                            prompt: enrichedSlot.prompt || slot.prompt,
                            alt: enrichedSlot.alt || slot.alt,
                          }
                        : slot;
                    }),
                  };
                }),
              }
            : asset;
        }),
      };
    });
  }
}
