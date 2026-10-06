import type { LlmOperation } from './contracts.js';

/** The only evidence identity fields that are allowed to reach a JSON schema. */
export interface CitationSchemaEvidence {
  sourceKey: string;
  civicItemId: number;
  agendaItemId?: number;
}

export type JsonSchema = Record<string, unknown>;

/** Keep model-provided schemas bounded even when an upstream query is too broad. */
export const MAX_DYNAMIC_SCHEMA_EVIDENCE = 256;
export const MAX_DYNAMIC_SCHEMA_BYTES = 128 * 1024;
const MAX_SOURCE_KEY_LENGTH = 256;

export class DynamicSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DynamicSchemaError';
  }
}

const PUBLIC_PROSE_DESCRIPTION =
  'Public prose must not mention internal sourceKey or civicItemId values or copy citation marker text; those identifiers are opaque and may appear only as exact fields inside citation objects. Section and heading labels are navigation metadata, not evidence. Institutional roles and locality/state names must be supported by the cited item title/body or authoritative source metadata.';
const LIMITATION_DESCRIPTION =
  'Optional plain-text limitation. Omit this field when there is no substantive limitation; do not use placeholders such as None, N/A, Not Applicable, optional, or blank text.';
const CITATION_SOURCE_KEY_DESCRIPTION =
  'Internal sourceKey identity; use only inside this citation object.';
const CITATION_ITEM_ID_DESCRIPTION =
  'Internal civicItemId identity; use only inside this citation object as the exact JSON number.';

const CITATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sourceKey: {
      type: 'string',
      minLength: 1,
      description: CITATION_SOURCE_KEY_DESCRIPTION,
    },
    civicItemId: {
      type: 'integer',
      minimum: 1,
      description: CITATION_ITEM_ID_DESCRIPTION,
    },
  },
  required: ['sourceKey', 'civicItemId'],
} as const;

const LIMITATION_SCHEMA = {
  type: 'string',
  minLength: 1,
  description: LIMITATION_DESCRIPTION,
} as const;

/**
 * Schemas used by callers that do not provide an evidence set (for example the
 * legacy transport helper). Strict summarizer requests always use the dynamic
 * builder below, so they never send this unconstrained citation schema.
 */
export const OLLAMA_RESPONSE_SCHEMAS = {
  cluster: {
    type: 'object',
    additionalProperties: false,
    properties: {
      headline: {
        type: 'string',
        minLength: 1,
        description: PUBLIC_PROSE_DESCRIPTION,
      },
      summary: {
        type: 'string',
        minLength: 1,
        description: PUBLIC_PROSE_DESCRIPTION,
      },
      whyItMatters: {
        type: 'string',
        minLength: 1,
        description: PUBLIC_PROSE_DESCRIPTION,
      },
      citations: { type: 'array', minItems: 1, items: CITATION_SCHEMA },
      limitation: LIMITATION_SCHEMA,
    },
    required: ['headline', 'summary', 'whyItMatters', 'citations'],
  },
  // The edition as a short news article: a headline, then paragraphs, each a
  // run of claims that carry their own citations.
  brief: {
    type: 'object',
    additionalProperties: false,
    properties: {
      headline: {
        type: 'string',
        minLength: 1,
        description: PUBLIC_PROSE_DESCRIPTION,
      },
      paragraphs: {
        type: 'array',
        minItems: 1,
        maxItems: 12,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            claims: {
              type: 'array',
              minItems: 1,
              maxItems: 12,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  text: {
                    type: 'string',
                    minLength: 1,
                    description: PUBLIC_PROSE_DESCRIPTION,
                  },
                  citations: {
                    type: 'array',
                    minItems: 1,
                    items: CITATION_SCHEMA,
                  },
                  limitation: LIMITATION_SCHEMA,
                },
                required: ['text', 'citations'],
              },
            },
          },
          required: ['claims'],
        },
      },
    },
    required: ['headline', 'paragraphs'],
  },
  // The editor's plan for an article: the matters worth reporting, most
  // consequential first, each with the facts and citations that carry it.
  // Internal to the brief; nothing here is published.
  brief_plan: {
    type: 'object',
    additionalProperties: false,
    properties: {
      matters: {
        type: 'array',
        minItems: 1,
        maxItems: 12,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            body: {
              type: 'string',
              minLength: 1,
              description:
                'The public body, organization or person acting, named exactly as the evidence names it.',
            },
            subject: {
              type: 'string',
              minLength: 1,
              description: 'What the matter is, in a few words.',
            },
            facts: {
              type: 'array',
              minItems: 1,
              maxItems: 8,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  text: {
                    type: 'string',
                    minLength: 1,
                    description: PUBLIC_PROSE_DESCRIPTION,
                  },
                  citations: {
                    type: 'array',
                    minItems: 1,
                    items: CITATION_SCHEMA,
                  },
                },
                required: ['text', 'citations'],
              },
            },
          },
          required: ['body', 'subject', 'facts'],
        },
      },
    },
    required: ['matters'],
  },
  story: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: {
        type: 'string',
        minLength: 1,
        description: PUBLIC_PROSE_DESCRIPTION,
      },
      claims: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: {
              type: 'string',
              minLength: 1,
              description: PUBLIC_PROSE_DESCRIPTION,
            },
            citations: { type: 'array', minItems: 1, items: CITATION_SCHEMA },
          },
          required: ['text', 'citations'],
        },
      },
      status: { type: 'string', enum: ['decided', 'pending', 'ongoing'] },
      limitation: LIMITATION_SCHEMA,
    },
    required: ['title', 'claims', 'status'],
  },
  agenda_fixup: {
    type: 'object',
    additionalProperties: false,
    properties: {
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            section: {
              type: 'string',
              minLength: 1,
              description: PUBLIC_PROSE_DESCRIPTION,
            },
            heading: {
              type: 'string',
              minLength: 1,
              description: PUBLIC_PROSE_DESCRIPTION,
            },
            body: {
              type: 'string',
              minLength: 1,
              description: PUBLIC_PROSE_DESCRIPTION,
            },
            citations: { type: 'array', minItems: 1, items: CITATION_SCHEMA },
          },
          required: ['section', 'heading', 'body', 'citations'],
        },
      },
    },
    required: ['items'],
  },
} as const;

function cloneSchema(schema: JsonSchema): Record<string, any> {
  return JSON.parse(JSON.stringify(schema)) as Record<string, any>;
}

function normalizeEvidence(
  evidence: readonly CitationSchemaEvidence[]
): CitationSchemaEvidence[] {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new DynamicSchemaError(
      'dynamic citation schema requires a non-empty evidence set'
    );
  }
  const identities = new Map<string, CitationSchemaEvidence>();
  for (const item of evidence) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.sourceKey !== 'string' ||
      !item.sourceKey.trim()
    ) {
      throw new DynamicSchemaError(
        'dynamic citation schema evidence requires a non-empty sourceKey'
      );
    }
    if (item.sourceKey.length > MAX_SOURCE_KEY_LENGTH) {
      throw new DynamicSchemaError(
        `dynamic citation schema sourceKey exceeds ${MAX_SOURCE_KEY_LENGTH} characters`
      );
    }
    if (!Number.isSafeInteger(item.civicItemId) || item.civicItemId <= 0) {
      throw new DynamicSchemaError(
        'dynamic citation schema evidence requires a positive safe integer civicItemId'
      );
    }
    if (
      item.agendaItemId !== undefined &&
      (!Number.isSafeInteger(item.agendaItemId) || item.agendaItemId <= 0)
    ) {
      throw new DynamicSchemaError(
        'dynamic citation schema evidence requires a positive safe integer agendaItemId'
      );
    }
    identities.set(
      `${item.sourceKey}\u0000${item.civicItemId}\u0000${
        item.agendaItemId ?? ''
      }`,
      {
        sourceKey: item.sourceKey,
        civicItemId: item.civicItemId,
        ...(item.agendaItemId === undefined
          ? {}
          : { agendaItemId: item.agendaItemId }),
      }
    );
  }
  if (identities.size > MAX_DYNAMIC_SCHEMA_EVIDENCE) {
    throw new DynamicSchemaError(
      `dynamic citation schema evidence set is too large (maximum ${MAX_DYNAMIC_SCHEMA_EVIDENCE} unique bindings)`
    );
  }
  return [...identities.values()].sort(
    (left, right) =>
      (left.sourceKey < right.sourceKey
        ? -1
        : left.sourceKey > right.sourceKey
        ? 1
        : 0) ||
      (left.civicItemId < right.civicItemId
        ? -1
        : left.civicItemId > right.civicItemId
        ? 1
        : 0) ||
      (left.agendaItemId ?? 0) - (right.agendaItemId ?? 0)
  );
}

function citationUnion(
  evidence: readonly CitationSchemaEvidence[]
): Record<string, unknown> {
  return {
    oneOf: evidence.map(({ sourceKey, civicItemId, agendaItemId }) => ({
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceKey: {
          const: sourceKey,
          description: CITATION_SOURCE_KEY_DESCRIPTION,
        },
        civicItemId: {
          const: civicItemId,
          description: CITATION_ITEM_ID_DESCRIPTION,
        },
        ...(agendaItemId === undefined
          ? {}
          : {
              agendaItemId: {
                const: agendaItemId,
                description:
                  'Exact internal agendaItemId identity; use only inside this citation object.',
              },
            }),
      },
      required: [
        'sourceKey',
        'civicItemId',
        ...(agendaItemId === undefined ? [] : ['agendaItemId']),
      ],
    })),
  };
}

function replaceCitationItems(
  operation: LlmOperation,
  schema: Record<string, any>,
  citations: Record<string, unknown>
): void {
  if (operation === 'cluster') schema['properties'].citations.items = citations;
  else if (operation === 'brief')
    schema[
      'properties'
    ].paragraphs.items.properties.claims.items.properties.citations.items =
      citations;
  else if (operation === 'brief_plan')
    schema[
      'properties'
    ].matters.items.properties.facts.items.properties.citations.items =
      citations;
  else if (operation === 'story')
    schema['properties'].claims.items.properties.citations.items = citations;
  else schema['properties'].items.items.properties.citations.items = citations;
}

/**
 * Build one immutable-by-convention operation schema for one request. The
 * citation union binds both fields together, preventing a model from mixing a
 * source key from one evidence row with an ID from another.
 */
export function buildOllamaResponseSchema(
  operation: LlmOperation,
  evidence: readonly CitationSchemaEvidence[]
): JsonSchema {
  if (
    !Object.prototype.hasOwnProperty.call(OLLAMA_RESPONSE_SCHEMAS, operation)
  ) {
    throw new DynamicSchemaError(
      `unsupported operation schema: ${String(operation)}`
    );
  }
  const normalized = normalizeEvidence(evidence);
  const schema = cloneSchema(
    OLLAMA_RESPONSE_SCHEMAS[operation] as unknown as JsonSchema
  );
  replaceCitationItems(operation, schema, citationUnion(normalized));
  const bytes = Buffer.byteLength(JSON.stringify(schema), 'utf8');
  if (bytes > MAX_DYNAMIC_SCHEMA_BYTES) {
    throw new DynamicSchemaError(
      `dynamic citation schema exceeds ${MAX_DYNAMIC_SCHEMA_BYTES} bytes`
    );
  }
  return schema;
}

/** Descriptive aliases for callers that do not use the Ollama-specific name. */
export const buildDynamicResponseSchema = buildOllamaResponseSchema;
export const buildResponseSchema = buildOllamaResponseSchema;
