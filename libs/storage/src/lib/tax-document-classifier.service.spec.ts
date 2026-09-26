import { AssetType } from '@optimistic-tanuki/models';
import { UnprocessableEntityException } from '@nestjs/common';

import { TaxDocumentClassifierService } from './tax-document-classifier.service';

const text = (value: string): Buffer => Buffer.from(value, 'utf8');

const FORM_1040_BODY = text(
  'Form 1040 (2025)\nU.S. Individual Income Tax Return\nFor the year ending December 31, 2025'
);
const W2_BODY = text(
  'Form W-2 Wage and Tax Statement 2025\nSocial Security wages: 120000.00\nWages, tips, other compensation'
);
const W2_1099_BODY = text(
  'Form 1099-NEC Nonemployee Compensation 2025\nForm 1099-MISC Miscellaneous Information'
);

describe('TaxDocumentClassifierService', () => {
  const classifier = new TaxDocumentClassifierService();

  describe('Form 1040 routing', () => {
    it.each([
      '1040.pdf',
      'form_1040.pdf',
      'Form-1040-2025.pdf',
      'client-1040-final.pdf',
      '2025 Form 1040 U.S. Individual Income Tax Return.pdf',
    ])('routes %s to FORM_1040 on the filename', (filename) => {
      const classification = classifier.classify({
        filename,
        type: AssetType.DOCUMENT,
      });

      expect(classification.formType).toBe('FORM_1040');
      expect(classification.isTaxDocument).toBe(true);
      expect(classification.handling).toBe('TAX_STRICT');
    });

    it('routes a tax return with a neutral filename on its content signature', () => {
      const classification = classifier.classify({
        filename: 'scan-0001.pdf',
        content: FORM_1040_BODY,
        type: AssetType.DOCUMENT,
      });

      expect(classification.formType).toBe('FORM_1040');
      expect(classification.evidence).toContain('content:form 1040');
      expect(classification.evidence).toContain(
        'content:u.s. individual income tax return'
      );
    });
  });

  describe('W-2 routing', () => {
    it.each([
      'w-2.pdf',
      'W2_2025.pdf',
      'w2.pdf',
      'W-2-Wage-and-Tax-Statement.pdf',
    ])('routes %s to FORM_W2 on the filename', (filename) => {
      const classification = classifier.classify({
        filename,
        type: AssetType.DOCUMENT,
      });

      expect(classification.formType).toBe('FORM_W2');
      expect(classification.handling).toBe('TAX_STRICT');
    });

    it('routes a wage statement with a neutral filename on its content signature', () => {
      const classification = classifier.classify({
        filename: 'upload.pdf',
        content: W2_BODY,
        type: AssetType.DOCUMENT,
      });

      expect(classification.formType).toBe('FORM_W2');
      expect(
        classification.evidence.some((e) =>
          e.includes('wage and tax statement')
        )
      ).toBe(true);
    });
  });

  describe('1099 routing', () => {
    it.each(['1099.pdf', '1099-NEC.pdf', '1099_misc.pdf', '1099-DIV-2025.pdf'])(
      'routes %s to FORM_1099 on the filename',
      (filename) => {
        const classification = classifier.classify({
          filename,
          type: AssetType.DOCUMENT,
        });

        expect(classification.formType).toBe('FORM_1099');
        expect(classification.handling).toBe('TAX_STRICT');
      }
    );

    it('routes a 1099 with a neutral filename on its content signature', () => {
      const classification = classifier.classify({
        filename: 'contractor-payout.pdf',
        content: W2_1099_BODY,
        type: AssetType.DOCUMENT,
      });

      expect(classification.formType).toBe('FORM_1099');
      expect(classification.matchedFormTypes).toContain('FORM_1099');
    });
  });

  describe('non tax documents', () => {
    it.each([
      'client-headshot.png',
      'retainer-agreement.pdf',
      'office-walkthrough.mp4',
      'payroll-2025.xlsx',
    ])('leaves %s on standard handling', (filename) => {
      const classification = classifier.classify({
        filename,
        content: text('Retainer agreement for representation.'),
        type: AssetType.DOCUMENT,
      });

      expect(classification.isTaxDocument).toBe(false);
      expect(classification.formType).toBeNull();
      expect(classification.handling).toBe('STANDARD');
      expect(classification.mimeContradiction).toBe(false);
    });

    it('handles a payload with no content at all', () => {
      const classification = classifier.classify({ filename: 'mystery.pdf' });

      expect(classification.isTaxDocument).toBe(false);
    });
  });

  describe('mime and content mismatch', () => {
    it('flags a tax form declared as an image', () => {
      const classification = classifier.classify({
        filename: '1040.pdf',
        content: FORM_1040_BODY,
        declaredMimeType: 'image/png',
      });

      expect(classification.isTaxDocument).toBe(true);
      expect(classification.mimeContradiction).toBe(true);
      expect(classification.contradictionDetail).toMatch(
        /image, video, or audio/
      );
    });

    it('flags a tax form smuggled through a media extension', () => {
      const classification = classifier.classify({
        filename: '1040.jpg',
        content: FORM_1040_BODY,
        type: AssetType.IMAGE,
      });

      expect(classification.mimeContradiction).toBe(true);
      expect(classification.declaredMimeType).toBe('image/jpeg');
    });

    it('flags a pdf declared mime type on a media filename when the content is a tax form', () => {
      const classification = classifier.classify({
        filename: 'scan.mp4',
        content: W2_BODY,
        declaredMimeType: 'application/pdf',
      });

      expect(classification.mimeContradiction).toBe(true);
      expect(classification.contradictionDetail).toMatch(/\.mp4/);
    });

    it('rejects a contradictory tax upload through assertStorable', () => {
      expect(() =>
        classifier.assertStorable({
          filename: '1040.pdf',
          content: FORM_1040_BODY,
          declaredMimeType: 'image/png',
        })
      ).toThrow(UnprocessableEntityException);
      expect(() =>
        classifier.assertStorable({
          filename: '1040.pdf',
          content: FORM_1040_BODY,
          declaredMimeType: 'image/png',
        })
      ).toThrow(/contradicts a FORM_1040 content signature/);
    });

    it('does not let a .txt file bypass tax handling', () => {
      const classification = classifier.classify({
        filename: '1040.txt',
        content: FORM_1040_BODY,
        type: AssetType.DOCUMENT,
      });

      expect(classification.isTaxDocument).toBe(true);
      expect(classification.handling).toBe('TAX_STRICT');
      expect(classification.mimeContradiction).toBe(false);
      expect(() =>
        classifier.assertStorable({
          filename: '1040.txt',
          content: FORM_1040_BODY,
          type: AssetType.DOCUMENT,
        })
      ).not.toThrow();
    });

    it('does not flag a non tax document that is merely a text file', () => {
      const classification = classifier.classify({
        filename: 'notes.txt',
        content: text('Meeting notes about the office move.'),
        type: AssetType.DOCUMENT,
      });

      expect(classification.mimeContradiction).toBe(false);
    });
  });

  describe('detection limits', () => {
    it('does not scan past the bounded content window', () => {
      const padding = Buffer.alloc(300 * 1024, 0x20);
      const lateSignature = Buffer.from(
        'Form 1099-NEC Nonemployee Compensation'
      );

      const classification = classifier.classify({
        filename: 'large.pdf',
        content: Buffer.concat([padding, lateSignature]),
        type: AssetType.DOCUMENT,
      });

      expect(classification.isTaxDocument).toBe(false);
    });

    it('ignores content when the payload is empty', () => {
      const classification = classifier.classify({
        filename: 'empty.pdf',
        content: Buffer.alloc(0),
        type: AssetType.DOCUMENT,
      });

      expect(classification.isTaxDocument).toBe(false);
    });

    it('keeps binary payloads from producing false positives', () => {
      const classification = classifier.classify({
        filename: 'clip.mp4',
        content: Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
        type: AssetType.VIDEO,
      });

      expect(classification.isTaxDocument).toBe(false);
    });

    it('matches a content signature even when the filename disagrees', () => {
      const classification = classifier.classify({
        filename: 'invoice.pdf',
        content: FORM_1040_BODY,
        type: AssetType.DOCUMENT,
      });

      expect(classification.formType).toBe('FORM_1040');
      expect(classification.evidence).toEqual([
        'content:form 1040',
        'content:u.s. individual income tax return',
        'content:individual income tax return',
        'content:form 1040 (',
      ]);
    });

    it('records the filename pattern that triggered the tax routing', () => {
      const classification = classifier.classify({
        filename: 'client-1040-final.pdf',
        content: FORM_1040_BODY,
        type: AssetType.DOCUMENT,
      });

      expect(classification.evidence).toContain('filename:\\b1040\\b');
      expect(classification.evidence).toContain('content:form 1040');
    });
  });
});
