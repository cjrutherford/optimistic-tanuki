import {
  assembleArticleEdition,
  assembleOutsiderBriefing,
  boldHeadline,
} from '../src/briefing2.js';

describe('assembleOutsiderBriefing', () => {
  it('renders lede, brief, new, upcoming, stories, appendix', () => {
    const md = assembleOutsiderBriefing({
      locality: 'Nashville, GA',
      periodStart: '2026-09-04',
      periodEnd: '2026-09-11',
      lede: '3 new items across 2 topics.',
      inBrief: ['Water rates rise 12% to fix Main St pipes.'],
      newItems: [
        {
          title: 'Water vote',
          date: '2026-09-14',
          url: 'https://example.org/w',
        },
      ],
      upcoming: [{ title: 'Council meets', date: '2026-09-14' }],
      threads: [
        {
          heading: 'Water rates',
          history: 'Rose twice.',
          meetings: ['2026-08-10', '2026-09-14'],
          story: '../../stories/x.md',
          links: [],
        },
      ],
      appendix: [{ heading: 'All', items: [{ title: 'Water vote' }] }],
      sourceCount: 9,
      model: 'qwen3:8b',
    });
    expect(md).toMatch(/# Nashville, GA — week of 2026-09-11/);
    expect(md).toMatch(/## The lead/);
    expect(md).toMatch(/## New this week/);
    expect(md).toMatch(/## Coming up/);
    expect(md).toMatch(/## Stories/);
    expect(md).toMatch(/Full story/);
    expect(md).toMatch(/<details>/);
  });
  it('titles daily editions by date and lists agenda lines under their meeting', () => {
    const md = assembleOutsiderBriefing({
      locality: 'Nashville, GA',
      cadence: 'daily',
      periodStart: '2026-09-14',
      periodEnd: '2026-09-15',
      lede: '1 new item.',
      inBrief: [],
      newItems: [{ title: 'Agenda 09/14/2026' }],
      upcoming: [],
      threads: [],
      appendix: [],
      sourceCount: 2,
      model: 'm',
      agendas: [
        {
          title: 'Agenda 09/14/2026',
          date: '2026-09-14',
          url: 'https://city.example/agenda',
          items: ['Recovery Proclamation', 'Millage Rate Tentative Proposal'],
        },
        { title: 'Empty agenda', items: [] },
      ],
    });
    expect(md).toMatch(/^# Nashville, GA — daily briefing, 2026-09-15$/mu);
    expect(md).not.toMatch(/week of|New this week/u);
    expect(md).toMatch(/## New today/u);
    expect(md).toMatch(
      /## On the agenda\n\n- \*\*Agenda 09\/14\/2026\*\* \(2026-09-14\) \[source\]\(https:\/\/city\.example\/agenda\)\n {2}- Recovery Proclamation\n {2}- Millage Rate Tentative Proposal\n\n/u
    );
    expect(md).not.toMatch(/Empty agenda/u);
  });
  it('omits empty sections', () => {
    const md = assembleOutsiderBriefing({
      locality: 'X',
      periodStart: 'a',
      periodEnd: 'b',
      lede: 'None new.',
      inBrief: ['Quiet week.'],
      newItems: [],
      upcoming: [],
      threads: [],
      appendix: [],
      sourceCount: 1,
      model: 'm',
    });
    expect(!md.includes('## New this week')).toBeTruthy();
    expect(!md.includes('## Coming up')).toBeTruthy();
    expect(!md.includes('## Stories')).toBeTruthy();
  });

  it('keeps restricted-source disclosure adjacent in Coming up and the source appendix', () => {
    const disclosure =
      'Limited-access source: only a publisher snippet was available; details may be incomplete. Read the full article directly: [article](https://publisher.example/story)';
    const md = assembleOutsiderBriefing({
      locality: 'Adel, GA',
      periodStart: '2026-09-12',
      periodEnd: '2026-09-13',
      lede: 'One item tracked.',
      inBrief: [],
      newItems: [],
      upcoming: [
        {
          title: 'Headline only',
          date: '2026-09-14',
          url: 'https://publisher.example/story',
          disclosure,
        },
      ],
      threads: [],
      appendix: [
        {
          heading: 'Local News',
          items: [
            {
              title: 'Headline only',
              url: 'https://publisher.example/story',
              disclosure,
            },
          ],
        },
      ],
      sourceCount: 1,
      model: 'fixture',
    });
    expect(md).toMatch(
      /## Coming up[\s\S]*Headline only[\s\S]*Limited-access source/
    );
    expect(md).toMatch(
      /All sources[\s\S]*Headline only[\s\S]*Limited-access source/
    );
    expect(md).toMatch(/publisher\.example\/story/);
  });

  it('labels observed freshness separately from a fetched fallback', () => {
    const md = assembleOutsiderBriefing({
      locality: 'Adel, GA',
      periodStart: '2026-09-12',
      periodEnd: '2026-09-13',
      lede: 'One item tracked.',
      inBrief: [],
      newItems: [],
      upcoming: [],
      threads: [],
      appendix: [],
      sourceCount: 2,
      model: 'fixture',
      sourceFreshness: [
        {
          sourceKey: 'observed-source',
          observedAt: '2026-09-12T15:00:00.000Z',
          basis: 'observed',
        },
        {
          sourceKey: 'fetched-source',
          fetchedAt: '2026-09-13T15:01:00.000Z',
          basis: 'fetched-fallback',
        },
      ],
    });
    expect(md).toMatch(
      /Configured source — observed 2026-09-12T15:00:00\.000Z/
    );
    expect(md).toMatch(
      /Configured source — fetched 2026-09-13T15:01:00\.000Z \(item observation unavailable\)/
    );
  });
});

describe('boldHeadline', () => {
  it('bolds a headline whatever whitespace the source left around it', () => {
    expect(
      boldHeadline(
        'Georgia candidates sharpen contrasts ahead of early voting '
      )
    ).toBe('**Georgia candidates sharpen contrasts ahead of early voting**');
    expect(boldHeadline('  Council\n  meets\tTuesday ')).toBe(
      '**Council meets Tuesday**'
    );
  });

  it('escapes asterisks in the headline so they cannot end the bold early', () => {
    expect(boldHeadline('Budget *draft* posted')).toBe(
      '**Budget \\*draft\\* posted**'
    );
  });

  it('writes nothing for an empty headline rather than a stray pair of markers', () => {
    expect(boldHeadline('   ')).toBe('');
  });
});

describe('assembleArticleEdition', () => {
  const edition = (
    paragraphs: {
      claims: { text: string; sources: number[]; limitation?: string }[];
    }[]
  ) =>
    assembleArticleEdition({
      locality: 'Madison, FL',
      periodStart: '2026-09-23',
      periodEnd: '2026-09-24',
      headline: 'Banquet set for Sept. 29',
      paragraphs,
      sources: [
        { title: 'Banquet', url: 'https://example.org/b' },
        { title: 'Agenda', url: 'https://example.org/a' },
      ],
      upcoming: [],
      sourceCount: 2,
      model: 'test',
      disclosure: 'test',
    });

  it('cites a run of sentences from one source once, at its end', () => {
    const md = edition([
      {
        claims: [
          { text: 'The banquet is Sept. 29.', sources: [1] },
          { text: 'It begins at 6 p.m.', sources: [1] },
          { text: 'The council meets Monday.', sources: [2] },
        ],
      },
    ]);
    expect(md).toMatch(
      /The banquet is Sept\. 29\. It begins at 6 p\.m\. \[\\\[1\\\]\]\(https:\/\/example\.org\/b\) The council meets Monday\. \[\\\[2\\\]\]/
    );
  });

  it('keeps the marker on a sentence that carries a limitation', () => {
    const md = edition([
      {
        claims: [
          {
            text: 'The banquet is Sept. 29.',
            sources: [1],
            limitation: 'per the organizer',
          },
          { text: 'It begins at 6 p.m.', sources: [1] },
        ],
      },
    ]);
    expect(md.match(/\\\[1\\\]/g)?.length).toBe(2);
  });

  it('merges consecutive paragraphs that rest on the same source, and only those', () => {
    const md = edition([
      { claims: [{ text: 'The banquet is Sept. 29.', sources: [1] }] },
      { claims: [{ text: 'The speaker was adopted.', sources: [1] }] },
      { claims: [{ text: 'The council meets Monday.', sources: [2] }] },
    ]);
    expect(md).toMatch(
      /The banquet is Sept\. 29\. The speaker was adopted\. \[/
    );
    expect(md).toMatch(/\n\nThe council meets Monday\./);
  });
});
