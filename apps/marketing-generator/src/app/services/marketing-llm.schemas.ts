import { z } from 'zod';

const blockSchema = z.object({
  id: z.string(),
  value: z.string().optional(),
});

const sectionSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
});

const channelOutputSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  summary: z.string().optional(),
  blocks: z.array(blockSchema).optional(),
});

const imageSlotSchema = z.object({
  id: z.string(),
  prompt: z.string().optional(),
  alt: z.string().optional(),
});

const surfaceSchema = z.object({
  id: z.string(),
  textBlocks: z.array(blockSchema).optional(),
  imageSlots: z.array(imageSlotSchema).optional(),
});

const materialOutputSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  layoutVariant: z.string().optional(),
  surfaces: z.array(surfaceSchema).optional(),
});

const conceptSchema = z.object({
  id: z.string(),
  angle: z.string().optional(),
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  sections: z.array(sectionSchema).optional(),
  channelOutputs: z.array(channelOutputSchema).optional(),
  materialOutputs: z.array(materialOutputSchema).optional(),
});

export const enrichmentPayloadSchema = z.object({
  concepts: z.array(conceptSchema),
});

export const generationPayloadSchema = z.object({
  concepts: z.array(conceptSchema),
});

export type EnrichmentPayload = z.infer<typeof enrichmentPayloadSchema>;
export type GenerationPayload = z.infer<typeof generationPayloadSchema>;

export type LlmParseResult<T> =
  | { success: true; data: T }
  | { success: false; reason: string };

const stripFences = (content: string): string => {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
};

const extractJsonObject = (content: string): string | null => {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  return content.slice(start, end + 1);
};

export const parseLlmPayload = <S extends z.ZodType>(
  content: string,
  schema: S
): LlmParseResult<z.infer<S>> => {
  const json = extractJsonObject(stripFences(content));
  if (json === null) {
    return { success: false, reason: 'No JSON object found in LLM response.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    return {
      success: false,
      reason: `LLM response was not valid JSON: ${(error as Error).message}`,
    };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      reason: `LLM response failed schema validation: ${result.error.message}`,
    };
  }

  return { success: true, data: result.data };
};
