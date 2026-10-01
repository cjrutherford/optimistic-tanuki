import { createOllamaSummarizer } from '../src/summarizer.js';

test('binds transport evidence kind and exact agenda row body in cluster and brief prompts', async () => {
  const prompts: string[] = [];
  let call = 0;
  const summarizer = createOllamaSummarizer({
    strict: true,
    baseUrl: 'http://test.local/v1',
    primary: 'candidate',
    fallback: 'candidate',
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(String(init?.body)) as {
        messages: { content: string }[];
      };
      prompts.push(request.messages[1]!.content);
      call += 1;
      const content =
        call === 1
          ? {
              headline: 'Resolution Approving housing plan',
              summary: 'The resolution is listed for consideration.',
              whyItMatters: 'Residents can review the housing plan.',
              citations: [
                { sourceKey: 'town-agenda', civicItemId: 7, agendaItemId: 42 },
              ],
            }
          : {
              bullets: [
                {
                  text: 'The resolution is listed for consideration.',
                  citations: [
                    {
                      sourceKey: 'town-agenda',
                      civicItemId: 7,
                      agendaItemId: 42,
                    },
                  ],
                },
              ],
            };
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(content) } }],
        }),
        { status: 200 }
      );
    },
  });
  const agendaRow = {
    sourceKey: 'town-agenda',
    civicItemId: 7,
    agendaItemId: 42,
    evidenceKind: 'agenda-row' as const,
    title: 'Agenda item',
    body: 'Resolution Approving the housing plan is listed for consideration.',
    parentDocumentContext: {
      title: 'Council agenda',
      body: 'PARENT BODY MUST NOT BE USED AS ROW EVIDENCE.',
    },
  };
  await summarizer.summarizeCluster({
    kind: 'legislation',
    topic: 'housing',
    items: [agendaRow],
  });
  await summarizer.tldr({
    locality: 'Adel, GA',
    period: '2026-09-15',
    clusterSummaries: [
      { heading: 'Policy', summary: agendaRow.body, evidence: [agendaRow] },
    ],
  });

  expect(prompts.length).toBe(2);
  for (const prompt of prompts) {
    expect(prompt).toMatch(/evidenceKind=agenda-row/u);
    expect(prompt).toMatch(/Resolution Approving/u);
    expect(prompt).toMatch(/closed-world evidence editor/iu);
    expect(prompt).toMatch(/silent(?:ly)?[^\n]*ledger/iu);
    expect(prompt).toMatch(/never emit[^\n]*(?:reasoning|ledger|self-check)/iu);
    expect(prompt).toMatch(
      /body=Resolution Approving the housing plan is listed for consideration\./u
    );
    expect(prompt).not.toMatch(
      /^body=PARENT BODY MUST NOT BE USED AS ROW EVIDENCE\./mu
    );
  }
});

test('marks ordinary source evidence separately from agenda-row transport', async () => {
  let prompt = '';
  const summarizer = createOllamaSummarizer({
    strict: true,
    baseUrl: 'http://test.local/v1',
    primary: 'candidate',
    fallback: 'candidate',
    fetchImpl: async (_url, init) => {
      prompt = (
        JSON.parse(String(init?.body)) as { messages: { content: string }[] }
      ).messages[1]!.content;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  headline: 'Road work',
                  summary: 'Road work begins.',
                  whyItMatters: 'Residents can plan.',
                  citations: [{ sourceKey: 'town-news', civicItemId: 8 }],
                }),
              },
            },
          ],
        }),
        { status: 200 }
      );
    },
  });
  await summarizer.summarizeCluster({
    kind: 'news',
    topic: 'roads',
    items: [
      {
        sourceKey: 'town-news',
        civicItemId: 8,
        title: 'Road work',
        body: 'Road work begins.',
        evidenceKind: 'source-item',
      },
    ],
  });
  expect(prompt).toMatch(/evidenceKind=source-item/u);
});
