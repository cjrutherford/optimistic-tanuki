import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { VaultDocumentEntity } from '@optimistic-tanuki/business-security';
import { VaultDocumentService } from './vault-document.service';

type Row = VaultDocumentEntity;

const TRANSCRIPT_TEXT = `TRANSCRIPT OF PROCEEDINGS
Case No. 3:24-cv-01842-JLT
Date: March 14, 2025

THE WITNESS:
Q.  Are you the custodian of records for the Shreveport yard?
A.  I am.

--- 2 ---
Q.  What happened to the manifest on the third of March?
A.  It went into the shredder.
Q.  Who authorised that?
A.  Nobody.
`;

const SCHEDULE_TEXT = `Schedule C (Form 1040) 2024
Filer: Delacroix Fabrication LLC
Part I - Income
1  Gross receipts or sales                    1,284,500.00
3  Gross profit                              1,283,300.00
Part II - Expenses
25 Total expenses                                47,310.55
Part III - Net Profit
31 Net profit                                1,235,989.45
`;

const OTHER_TENANT_TEXT = `CONFIDENTIAL: Northgate Holdings acquisition memo.
Project codename BLUE HARBOR. Target valuation 480,000,000.
`;

const createInMemoryStore = () => {
  const rows: Row[] = [];
  const boundTenants: string[] = [];

  const createManager = (): EntityManager =>
    ({
      queryRunner: {
        query: async (sql: string, params: unknown[] = []) => {
          if (sql.includes('app.current_tenant_id')) {
            boundTenants.push(String(params[0]));
          }
          return [];
        },
        isTransactionActive: true,
        isReleased: false,
      },
      getRepository: () => ({
        find: async ({
          where,
        }: {
          where: Partial<Row> & { documentId?: unknown };
        }) => {
          const operator = where.documentId as { _value?: unknown } | undefined;
          const ids = Array.isArray(operator?._value)
            ? (operator!._value as string[])
            : [];
          return rows.filter(
            (row) =>
              row.tenantId === where.tenantId &&
              (ids.length === 0 || ids.includes(row.documentId))
          );
        },
        findOne: async ({ where }: { where: Partial<Row> }) =>
          rows.find(
            (row) =>
              row.tenantId === where.tenantId &&
              row.documentId === where.documentId
          ) ?? null,
        select: undefined,
        upsert: async (values: Partial<Row>) => {
          const existing = rows.find(
            (row) =>
              row.tenantId === values.tenantId &&
              row.documentId === values.documentId
          );
          const next = { id: `doc-row-${rows.length + 1}`, ...values } as Row;
          if (existing) {
            Object.assign(existing, next);
            return existing;
          }
          rows.push(next);
          return next;
        },
      }),
    } as unknown as EntityManager);

  return {
    rows,
    boundTenants,
    asDataSource: () =>
      ({
        transaction: async <T>(
          operation: (manager: EntityManager) => Promise<T>
        ): Promise<T> => operation(createManager()),
      } as unknown as DataSource),
  };
};

describe('VaultDocumentService', () => {
  let store: ReturnType<typeof createInMemoryStore>;
  let service: VaultDocumentService;

  beforeEach(() => {
    store = createInMemoryStore();
    service = new VaultDocumentService(store.asDataSource());
  });

  const seed = async (
    tenantId: string,
    documentId: string,
    fileName: string,
    contentText: string,
    mimeType = 'text/plain'
  ) => {
    await service.ingest({
      tenantId,
      documentId,
      fileName,
      mimeType,
      documentHash: 'a'.repeat(64),
      contentText,
    });
  };

  describe('ingest', () => {
    it('stores the extracted text against the tenant', async () => {
      await seed('wirepro-cpa', 'doc-1', 'deposition.txt', TRANSCRIPT_TEXT);

      const result = await service.retrieve('wirepro-cpa', ['doc-1'], 'test');
      expect(result.retrievedDocumentIds).toEqual(['doc-1']);
      expect(result.excerpts.length).toBeGreaterThan(0);
    });

    it('recognises a deposition transcript by its content', async () => {
      await seed('wirepro-cpa', 'doc-1', 'deposition.txt', TRANSCRIPT_TEXT);
      const [row] = store.rows;
      expect(row.kind).toBe('transcript');
    });

    it('recognises a tax schedule by its content', async () => {
      await seed('wirepro-cpa', 'doc-2', 'schedule-c.txt', SCHEDULE_TEXT);
      const [row] = store.rows;
      expect(row.kind).toBe('tax_schedule');
    });

    it('leaves a document it cannot classify as other rather than guessing', async () => {
      await seed('wirepro-cpa', 'doc-3', 'memo.txt', 'A short internal memo.');
      const [row] = store.rows;
      expect(row.kind).toBe('other');
    });

    it('replaces the stored text when the same document is re-dropped', async () => {
      await seed('wirepro-cpa', 'doc-1', 'deposition.txt', TRANSCRIPT_TEXT);
      await seed('wirepro-cpa', 'doc-1', 'deposition.txt', 'A replacement.');

      expect(store.rows).toHaveLength(1);
      const result = await service.retrieve('wirepro-cpa', ['doc-1'], 'test');
      expect(result.excerpts[0].text).toBe('A replacement.');
    });

    it('refuses an ingest with no tenant rather than storing it unscoped', async () => {
      await expect(
        service.ingest({
          tenantId: '',
          documentId: 'doc-1',
          fileName: 'x.txt',
          mimeType: 'text/plain',
          documentHash: 'a'.repeat(64),
          contentText: 'text',
        })
      ).rejects.toThrow(BadRequestException);
      expect(store.rows).toHaveLength(0);
    });
  });

  describe('tenant scoping', () => {
    beforeEach(async () => {
      await seed(
        'wirepro-cpa',
        'doc-transcript',
        'deposition.txt',
        TRANSCRIPT_TEXT
      );
      await seed(
        'northgate-law',
        'doc-memo',
        'acquisition.txt',
        OTHER_TENANT_TEXT
      );
    });

    it('binds the tenant into the database session on every read', async () => {
      store.boundTenants.length = 0;
      await service.retrieve('wirepro-cpa', ['doc-transcript'], 'test');
      expect(store.boundTenants).toEqual(['wirepro-cpa']);
    });

    it('never returns a document belonging to a different tenant', async () => {
      const result = await service.retrieve(
        'wirepro-cpa',
        ['doc-memo'],
        'acquisition'
      );

      expect(result.retrievedDocumentIds).toEqual([]);
      expect(result.excerpts).toEqual([]);
      expect(result.unavailableDocumentIds).toEqual(['doc-memo']);
    });

    it('keeps another tenant content out of an otherwise successful result', async () => {
      const result = await service.retrieve(
        'wirepro-cpa',
        ['doc-transcript', 'doc-memo'],
        'custodian records'
      );

      const serialised = JSON.stringify(result);
      expect(serialised).not.toContain('BLUE HARBOR');
      expect(serialised).not.toContain('Northgate');
      expect(result.retrievedDocumentIds).toEqual(['doc-transcript']);
      expect(result.unavailableDocumentIds).toEqual(['doc-memo']);
    });

    it('reports a document that does not exist the same way as one that is not theirs', async () => {
      const missing = await service.retrieve(
        'wirepro-cpa',
        ['doc-nope'],
        'test'
      );
      const foreign = await service.retrieve(
        'wirepro-cpa',
        ['doc-memo'],
        'test'
      );

      // The two answers must be indistinguishable apart from the id that was
      // asked about, or the tool is a probe for what other tenants hold.
      const shape = (result: {
        retrievedDocumentIds: string[];
        unavailableDocumentIds: string[];
        excerpts: unknown[];
      }) => ({
        retrieved: result.retrievedDocumentIds,
        unavailable: result.unavailableDocumentIds.length,
        excerpts: result.excerpts,
      });

      expect(shape(missing)).toEqual(shape(foreign));
    });

    it('refuses a retrieve with no tenant', async () => {
      await expect(
        service.retrieve('  ', ['doc-transcript'], 'test')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('excerpts', () => {
    beforeEach(async () => {
      await seed(
        'wirepro-cpa',
        'doc-transcript',
        'deposition.txt',
        TRANSCRIPT_TEXT
      );
    });

    it('returns the passage that answers the question, not the first passage', async () => {
      const result = await service.retrieve(
        'wirepro-cpa',
        ['doc-transcript'],
        'Who authorised the shredding of the manifest?'
      );

      const joined = result.excerpts.map((excerpt) => excerpt.text).join('\n');
      expect(joined).toContain('Who authorised that?');
    });

    it('quotes the stored text exactly and points at the offset it came from', async () => {
      const result = await service.retrieve(
        'wirepro-cpa',
        ['doc-transcript'],
        'shredder'
      );
      const excerpt = result.excerpts.find((candidate) =>
        candidate.text.includes('shredder')
      );

      expect(excerpt).toBeDefined();
      expect(
        TRANSCRIPT_TEXT.slice(
          excerpt!.offset,
          excerpt!.offset + excerpt!.length
        )
      ).toBe(excerpt!.text);
    });

    it('carries the page the passage was found on', async () => {
      const result = await service.retrieve(
        'wirepro-cpa',
        ['doc-transcript'],
        'shredder'
      );
      const excerpt = result.excerpts.find((candidate) =>
        candidate.text.includes('shredder')
      );

      expect(excerpt?.page).toBe(2);
    });

    it('labels every excerpt with the document it came from', async () => {
      const result = await service.retrieve(
        'wirepro-cpa',
        ['doc-transcript'],
        'test'
      );
      for (const excerpt of result.excerpts) {
        expect(excerpt.documentId).toBe('doc-transcript');
        expect(excerpt.fileName).toBe('deposition.txt');
        expect(excerpt.kind).toBe('transcript');
      }
    });

    it('caps the excerpt budget rather than returning the whole document', async () => {
      const result = await service.retrieve(
        'wirepro-cpa',
        ['doc-transcript'],
        'test',
        { maxExcerpts: 2 }
      );
      expect(result.excerpts.length).toBeLessThanOrEqual(2);
    });

    it('returns a lead excerpt when the question matches nothing at all', async () => {
      const result = await service.retrieve(
        'wirepro-cpa',
        ['doc-transcript'],
        'zzzzz qqqqq'
      );

      expect(result.excerpts.length).toBeGreaterThan(0);
      expect(
        TRANSCRIPT_TEXT.startsWith(result.excerpts[0].text.slice(0, 10))
      ).toBe(true);
    });
  });

  describe('documents with no readable text', () => {
    it('reports a stored document with no text as unavailable rather than empty', async () => {
      await seed('wirepro-cpa', 'doc-pdf', 'scan.pdf', '', 'application/pdf');
      const result = await service.retrieve('wirepro-cpa', ['doc-pdf'], 'test');

      expect(result.retrievedDocumentIds).toEqual([]);
      expect(result.excerpts).toEqual([]);
      expect(result.unavailableDocumentIds).toEqual(['doc-pdf']);
    });
  });

  describe('reading a whole document back for a structured parse', () => {
    beforeEach(async () => {
      await seed(
        'wirepro-cpa',
        'doc-transcript',
        'deposition.txt',
        TRANSCRIPT_TEXT
      );
      await seed(
        'northgate-law',
        'doc-memo',
        'acquisition.txt',
        OTHER_TENANT_TEXT
      );
    });

    it('returns the stored text byte for byte', async () => {
      expect(await service.readText('wirepro-cpa', 'doc-transcript')).toBe(
        TRANSCRIPT_TEXT
      );
    });

    it('returns nothing for a document belonging to another tenant', async () => {
      expect(await service.readText('wirepro-cpa', 'doc-memo')).toBeNull();
    });

    it('returns nothing for a document that does not exist', async () => {
      expect(await service.readText('wirepro-cpa', 'doc-nope')).toBeNull();
    });

    it('returns an empty string for a document with no readable text', async () => {
      await seed('wirepro-cpa', 'doc-pdf', 'scan.pdf', '', 'application/pdf');
      expect(await service.readText('wirepro-cpa', 'doc-pdf')).toBe('');
    });
  });
});
