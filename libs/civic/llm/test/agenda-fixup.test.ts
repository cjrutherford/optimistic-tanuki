import {
  createOllamaSummarizer,
  fixupAgendaItems,
  StrictLlmError,
} from '../src/index.js';

function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected function to throw');
}
describe('strict agenda fixup', () => {
  it('rejects incomplete evidence before transport', async () => {
    let calls = 0;
    const summarizer = createOllamaSummarizer({
      baseUrl: 'http://test.local/v1',
      fetchImpl: async () => {
        calls += 1;
        return new Response('unexpected', { status: 500 });
      },
    });
    expect(
      ((error: unknown) =>
        error instanceof StrictLlmError && error.code === 'invalid')(
        captureError(() =>
          summarizer.fixupAgendaItems({
            body: 'text',
            sourceKey: '',
            civicItemId: 42,
            runId: 'run',
          })
        )
      )
    ).toBe(true);
    expect(
      ((error: unknown) =>
        error instanceof StrictLlmError && error.code === 'invalid')(
        captureError(() =>
          summarizer.fixupAgendaItems({
            body: 'text',
            sourceKey: 'meeting-doc',
            civicItemId: 42.2,
            runId: 'run',
          })
        )
      )
    ).toBe(true);
    expect(calls).toBe(0);
  });
  it('requires source/item/run evidence and records agenda_fixup provenance', async () => {
    const summarizer = createOllamaSummarizer({
      baseUrl: 'http://test.local/v1',
      runId: 'run-agenda',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    items: [
                      {
                        section: 'Roads',
                        heading: 'Road work',
                        body: 'Starts Sept 12.',
                        citations: [
                          { sourceKey: 'meeting-doc', civicItemId: 42 },
                        ],
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200 }
        ),
    });
    const result = await summarizer.fixupAgendaItems({
      body: 'Roads: Road work starts Sept 12.',
      sourceKey: 'meeting-doc',
      civicItemId: 42,
      runId: 'run-agenda',
    });
    expect(result[0].heading).toBe('Road work');
    expect(result[0].provenance.operation).toBe('agenda_fixup');
    expect(result[0].provenance.inputSha256.length).toBe(64);
  });

  it('fails strictly when agenda fixup cannot be generated', async () => {
    const summarizer = createOllamaSummarizer({
      baseUrl: 'http://test.local/v1',
      fetchImpl: async () => new Response('down', { status: 500 }),
    });
    await expect(
      (() =>
        summarizer.fixupAgendaItems({
          body: 'text',
          sourceKey: 'meeting-doc',
          civicItemId: 42,
          runId: 'run',
        }))()
    ).rejects.toThrow(StrictLlmError);
  });

  describe('state qualifiers', () => {
    const body =
      'Planning: The Town of Chapel Hill, NC will review the Weaver Street plan.';
    const answering = (rowBody: string) =>
      createOllamaSummarizer({
        baseUrl: 'http://test.local/v1',
        runId: 'run-state',
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      items: [
                        {
                          section: 'Planning',
                          heading: 'Weaver Street plan',
                          body: rowBody,
                          citations: [
                            { sourceKey: 'meeting-doc', civicItemId: 42 },
                          ],
                        },
                      ],
                    }),
                  },
                },
              ],
            }),
            { status: 200 }
          ),
      });

    it("accepts the town's own state once the fixup knows the town", async () => {
      const result = await answering(
        'The Town of Chapel Hill, NC will review the Weaver Street plan.'
      ).fixupAgendaItems({
        body,
        sourceKey: 'meeting-doc',
        civicItemId: 42,
        localitySlug: 'chapel-hill-nc',
        runId: 'run-state',
      });
      expect(result[0].body).toContain('Chapel Hill, NC');
    });

    it('still rejects a state the town is not in', async () => {
      await expect(
        answering(
          'The Town of Chapel Hill, TX will review the Weaver Street plan.'
        ).fixupAgendaItems({
          body,
          sourceKey: 'meeting-doc',
          civicItemId: 42,
          localitySlug: 'chapel-hill-nc',
          runId: 'run-state',
        })
      ).rejects.toThrow(/unsupported-named-state-qualifier.*tx/u);
    });
  });
});
