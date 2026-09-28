import { AssetType } from '@optimistic-tanuki/models';
import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as path from 'path';

import {
  extensionOf,
  isMediaMimeType,
  mimeTypeFromFileName,
  resolveDeclaredMimeType,
} from './file-mime';

export type TaxFormType = 'FORM_1040' | 'FORM_W2' | 'FORM_1099';
export type TaxHandling = 'TAX_STRICT' | 'STANDARD';

export interface TaxClassificationInput {
  filename: string;
  content?: Buffer;
  declaredMimeType?: string;
  type?: AssetType;
}

export interface TaxDocumentClassification {
  isTaxDocument: boolean;
  formType: TaxFormType | null;
  matchedFormTypes: TaxFormType[];
  handling: TaxHandling;
  evidence: string[];
  declaredMimeType: string | null;
  mimeContradiction: boolean;
  contradictionDetail: string | null;
}

interface TaxFormSignature {
  formType: TaxFormType;
  filenamePatterns: RegExp[];
  contentMarkers: string[];
}

export const TAX_CONTENT_SCAN_BYTES = 256 * 1024;

const TAX_FORM_SIGNATURES: TaxFormSignature[] = [
  {
    formType: 'FORM_1040',
    filenamePatterns: [
      /\b1040\b/,
      /\bform\s?1040\b/,
      /individual\s+income\s+tax\s+return/,
    ],
    contentMarkers: [
      'form 1040',
      'u.s. individual income tax return',
      'individual income tax return',
      'form 1040 (',
    ],
  },
  {
    formType: 'FORM_W2',
    filenamePatterns: [/\bw[\s-]?2\b/, /wage\s+and\s+tax\s+statement/],
    contentMarkers: [
      'wage and tax statement',
      'form w-2',
      'w-2 wage and tax',
      'social security wages',
      'wages, tips, other compensation',
    ],
  },
  {
    formType: 'FORM_1099',
    filenamePatterns: [
      /\b1099\b/,
      /\b1099[\s-]?(nec|misc|int|div|rent|broker)\b/,
    ],
    contentMarkers: [
      'form 1099',
      'form 1099-misc',
      'form 1099-nec',
      'form 1099-int',
      'form 1099-div',
      'nonemployee compensation',
      'miscellaneous information',
    ],
  },
];

@Injectable()
export class TaxDocumentClassifierService {
  private readonly logger = new Logger(TaxDocumentClassifierService.name);

  classify(input: TaxClassificationInput): TaxDocumentClassification {
    const basename = path.basename(input.filename ?? '');
    const declaredMimeType =
      input.declaredMimeType ??
      (input.type
        ? resolveDeclaredMimeType(basename, input.type)
        : mimeTypeFromFileName(basename));

    const filenameHits = this.matchFilename(basename);
    const contentHits = this.matchContent(input.content);

    const combined = new Map<TaxFormType, string[]>();
    for (const hit of [...filenameHits, ...contentHits]) {
      const existing = combined.get(hit.formType) ?? [];
      existing.push(hit.evidence);
      combined.set(hit.formType, existing);
    }

    let formType: TaxFormType | null = null;
    const matchedFormTypes: TaxFormType[] = [];
    const evidence: string[] = [];
    for (const candidate of TAX_FORM_SIGNATURES) {
      const hits = combined.get(candidate.formType);
      if (!hits) {
        continue;
      }
      matchedFormTypes.push(candidate.formType);
      evidence.push(...hits);
      if (formType === null) {
        formType = candidate.formType;
      }
    }

    const isTaxDocument = formType !== null;
    const contradiction = isTaxDocument
      ? this.detectMimeContradiction(basename, declaredMimeType, contentHits)
      : { contradicted: false, detail: null };

    if (contradiction.contradicted) {
      this.logger.warn(
        `Rejected tax document upload: declared type ${declaredMimeType} contradicts ${formType} content signature for ${basename}`
      );
    }

    return {
      isTaxDocument,
      formType,
      matchedFormTypes,
      handling: isTaxDocument ? 'TAX_STRICT' : 'STANDARD',
      evidence,
      declaredMimeType,
      mimeContradiction: contradiction.contradicted,
      contradictionDetail: contradiction.detail,
    };
  }

  assertStorable(input: TaxClassificationInput): TaxDocumentClassification {
    const classification = this.classify(input);
    if (classification.mimeContradiction) {
      throw new UnprocessableEntityException(
        `File declared type ${classification.declaredMimeType} contradicts a ${
          classification.formType ?? 'tax form'
        } content signature. ${classification.contradictionDetail ?? ''}`.trim()
      );
    }
    return classification;
  }

  private matchFilename(
    basename: string
  ): Array<{ formType: TaxFormType; evidence: string }> {
    const normalized = basename.toLowerCase().replace(/[._]+/g, ' ');
    const hits: Array<{ formType: TaxFormType; evidence: string }> = [];
    for (const signature of TAX_FORM_SIGNATURES) {
      for (const pattern of signature.filenamePatterns) {
        if (pattern.test(normalized)) {
          hits.push({
            formType: signature.formType,
            evidence: `filename:${pattern.source}`,
          });
        }
      }
    }
    return hits;
  }

  private matchContent(
    content?: Buffer
  ): Array<{ formType: TaxFormType; evidence: string }> {
    if (!content || content.length === 0) {
      return [];
    }

    const scan = content.subarray(0, TAX_CONTENT_SCAN_BYTES).toString('latin1');
    const normalized = scan.toLowerCase();
    const hits: Array<{ formType: TaxFormType; evidence: string }> = [];

    for (const signature of TAX_FORM_SIGNATURES) {
      for (const marker of signature.contentMarkers) {
        if (normalized.includes(marker)) {
          hits.push({
            formType: signature.formType,
            evidence: `content:${marker}`,
          });
        }
      }
    }
    return hits;
  }

  private detectMimeContradiction(
    basename: string,
    declaredMimeType: string | null,
    contentHits: Array<{ formType: TaxFormType; evidence: string }>
  ): { contradicted: boolean; detail: string | null } {
    const contentSignatureDetected = contentHits.length > 0;

    if (isMediaMimeType(declaredMimeType)) {
      return {
        contradicted: true,
        detail:
          'tax form content cannot be delivered as an image, video, or audio payload; ' +
          'resubmit as a document type that is checked against the tax form signature.',
      };
    }

    if (
      contentSignatureDetected &&
      isMediaMimeType(mimeTypeFromFileName(basename))
    ) {
      return {
        contradicted: true,
        detail: `filename extension "${extensionOf(
          basename
        )}" carries a media type that cannot hold a tax form payload.`,
      };
    }

    return { contradicted: false, detail: null };
  }
}
