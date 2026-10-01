import { isSubstantiveThread, selectStoryThreads } from '../src/agenda.js';
import {
  assembleStory,
  assertDistinctStoryNarratives,
  deriveNarrativeFromClaims,
  selectStoryTimelineEvents,
  storyFilename,
} from '../src/story.js';

const T = (
  topicKey: string,
  meetings: string[],
  heading = 'A sufficiently long substantive heading here',
  bodyLen = 300
) => ({
  topicKey,
  items: meetings.map((m) => ({
    topicKey,
    meetingDate: m,
    heading,
    body: 'x'.repeat(bodyLen),
    itemTitle: heading,
    uris: [] as string[],
  })),
  meetings,
  related: [],
});

describe('story selection', () => {
  it('rejects boilerplate and single-meeting threads', () => {
    expect(
      isSubstantiveThread(
        T(
          'topic:approval-minutes-previous-meeting',
          ['2026-06-22', '2026-07-13'],
          'APPROVAL OF MINUTES FROM PREVIOUS MEETING here'
        )
      )
    ).toBe(false);
    expect(
      isSubstantiveThread(
        T('topic:water-rates-vote', ['2026-08-24'], 'Water rates vote tonight')
      )
    ).toBe(false);
    expect(
      isSubstantiveThread(
        T(
          'topic:water-rates-increase-ordinance',
          ['2026-08-10', '2026-08-24'],
          'Water rate increase ordinance second reading'
        )
      )
    ).toBe(true);
  });
  it('ranks by meetings then items, caps at limit', () => {
    const threads = [
      T(
        'topic:a',
        ['2026-08-01', '2026-08-02'],
        'First substantive topic heading here yes'
      ),
      T(
        'topic:b',
        ['2026-08-01', '2026-08-02', '2026-08-03'],
        'Second substantive topic heading here yes'
      ),
    ];
    const picked = selectStoryThreads(threads, 1);
    expect(picked.length).toBe(1);
    expect(picked[0].topicKey).toBe('topic:b');
  });
});

describe('assembleStory', () => {
  it('rejects duplicate narratives across canonical stories but permits distinct threads', () => {
    expect(() =>
      assertDistinctStoryNarratives([
        { storyKey: 'town|news|one', narrative: 'The council met.' },
        { storyKey: 'town|news|two', narrative: ' The council   met. ' },
      ])
    ).toThrow(/duplicate story narrative/i);
    expect(() =>
      assertDistinctStoryNarratives([
        { storyKey: 'town|news|one', narrative: 'The council met.' },
        { storyKey: 'town|news|two', narrative: 'The board met.' },
      ])
    ).not.toThrow();
  });

  it('derives deterministic narrative text from validated claims', () => {
    expect(
      deriveNarrativeFromClaims([
        {
          text: 'Road work begins.',
          citations: [{ sourceKey: 'roads', civicItemId: 1 }],
        },
        {
          text: 'Drivers should use caution.',
          citations: [{ sourceKey: 'roads', civicItemId: 1 }],
        },
      ])
    ).toBe('Road work begins. Drivers should use caution.');
  });
  it('fails closed when agenda rows do not carry exact persisted identity', () => {
    const events = [
      {
        date: '2026-09-08',
        heading: '1. Zoning Application PP26-0016',
        body: 'Zoning application submitted by Strong Rock Development Group.',
      },
      {
        date: '2026-09-08',
        heading:
          '7. Resolution Granting Enterprise Zone Incentives to Veazey White, LLC',
        body: 'Resolution granting Enterprise Zone incentives to Veazey White, LLC.',
      },
      {
        date: '2026-09-08',
        heading:
          '8. Ordinance Proposing the Creation of a Downtown Entertainment District',
        body: 'Ordinance proposing the creation of a Downtown Entertainment District.',
      },
    ];
    const selected = selectStoryTimelineEvents(events, {
      title:
        'Resolution Granting Enterprise Zone Incentives to Veazey White, LLC',
      claims: [
        {
          text: 'The agenda included a resolution granting Enterprise Zone incentives to Veazey White, LLC.',
          citations: [],
        },
      ],
    });
    expect(selected).toStrictEqual([]);
  });

  it('binds agenda timelines by exact agendaItemId rather than token overlap', () => {
    const events = [
      {
        sourceKey: 'agenda',
        civicItemId: 70,
        agendaItemId: 7,
        heading: 'Road improvement A',
        body: 'Road improvements are listed for North Street.',
        date: '2026-09-08',
      },
      {
        sourceKey: 'agenda',
        civicItemId: 70,
        agendaItemId: 8,
        heading: 'Road improvement B',
        body: 'Road improvements are listed for South Street.',
        date: '2026-09-08',
      },
    ];
    expect(
      selectStoryTimelineEvents(events, {
        title: 'Road improvements',
        claims: [
          {
            text: 'Road improvements are listed.',
            citations: [
              { sourceKey: 'agenda', civicItemId: 70, agendaItemId: 7 },
            ],
          },
        ],
      })
    ).toStrictEqual([events[0]]);
  });
  it('withholds an agenda timeline when the model story cannot be safely bound to a row', () => {
    const events = [
      {
        date: '2026-08-17',
        heading: '1. Award Recommendation for RFP 2026-03',
        body: 'Award recommendation for the generator project.',
      },
      {
        date: '2026-08-17',
        heading: '2. Festival designation',
        body: 'Resolution designating a festival.',
      },
    ];
    expect(
      selectStoryTimelineEvents(events, { title: 'Council agenda update' })
    ).toStrictEqual([]);
  });
  it('renders narrative, timeline, sources', () => {
    const md = assembleStory({
      locality: 'Nashville, GA',
      title: 'Road renaming saga',
      status: 'pending',
      narrative: 'Two hearings, no decision.',
      timeline: [
        {
          date: '2026-06-22',
          heading: 'First hearing',
          detail: 'The hearing was held.',
          url: 'https://example.org/hearing',
        },
      ],
      meetings: ['2026-06-22', '2026-07-13'],
      sources: [{ title: 'Minutes', url: 'https://example.org/m' }],
      model: 'qwen3:8b',
      updatedAt: '2026-09-11',
    });
    expect(md).toMatch(/# Road renaming saga/);
    expect(md).toMatch(/\*\*Status:\*\* pending/);
    expect(md).toMatch(/2026-06-22.*First hearing/);
    expect(md).toMatch(
      /First hearing.*\[evidence\]\(https:\/\/example\.org\/hearing\)/
    );
    expect(md).toMatch(/\[source\]\(https:\/\/example\.org\/m\)/);
  });

  it('fails closed instead of rendering meeting occurrence language for agenda-only evidence', () => {
    expect(() =>
      assembleStory({
        locality: 'Tifton, GA',
        title: 'City Council agenda',
        status: 'pending',
        agendaOnly: true,
        narrative: 'The City Council met to discuss agenda items.',
        timeline: [
          {
            date: '2026-08-17',
            heading: 'Listed agenda items',
            detail: 'The agenda lists proposed items.',
          },
        ],
        meetings: ['2026-08-17'],
        sources: [{ title: 'Agenda', url: 'https://example.org/agenda' }],
        model: 'qwen3:8b',
        updatedAt: '2026-09-13',
      })
    ).toThrow(/agenda-only|agenda\/listed\/scheduled/i);
  });
  it('guards every agenda-only rendered public field, not just the narrative', () => {
    for (const field of [
      'title',
      'timeline heading',
      'timeline detail',
    ] as const) {
      expect(() =>
        assembleStory({
          locality: 'Adel, GA',
          title:
            field === 'title' ? 'City Council meeting held' : 'Listed agenda',
          status: 'pending',
          agendaOnly: true,
          narrative: 'The agenda lists discussion items.',
          timeline: [
            {
              date: '2026-09-12',
              heading:
                field === 'timeline heading'
                  ? 'The council met'
                  : 'Listed agenda items',
              detail:
                field === 'timeline detail'
                  ? 'The meeting was held.'
                  : 'The agenda lists proposed items.',
            },
          ],
          meetings: [],
          sources: [{ title: 'Agenda', url: 'https://example.org/agenda' }],
          model: 'fixture',
          updatedAt: '2026-09-13',
        })
      ).toThrow(/agenda-only|agenda\/listed\/scheduled/i);
    }
    expect(() =>
      assembleStory({
        locality: 'Adel, GA',
        title: 'Scheduled council meeting',
        status: 'pending',
        agendaOnly: true,
        narrative: 'The council meeting will be held on September 12.',
        timeline: [
          {
            date: '2026-09-12',
            heading: 'Meeting scheduled',
            detail: 'The meeting will be held on September 12.',
          },
        ],
        meetings: [],
        sources: [{ title: 'Agenda', url: 'https://example.org/agenda' }],
        model: 'fixture',
        updatedAt: '2026-09-13',
      })
    ).not.toThrow();
  });

  it('rejects present/future wording for historical agenda stories and omits ordinal-only timeline labels', () => {
    expect(() =>
      assembleStory({
        locality: 'Tifton, GA',
        title: 'Council agenda',
        status: 'pending',
        agendaOnly: true,
        asOf: '2026-09-13',
        narrative: 'The City Council will discuss the resolution.',
        timeline: [{ date: '2026-09-08', heading: '7.', detail: '3.' }],
        meetings: ['2026-09-08'],
        sources: [{ title: 'Agenda' }],
        model: 'fixture',
        updatedAt: '2026-09-13',
      })
    ).toThrow(/temporal|modality|agenda/i);
    const markdown = assembleStory({
      locality: 'Tifton, GA',
      title: 'Council agenda',
      status: 'pending',
      agendaOnly: true,
      asOf: '2026-09-13',
      narrative:
        'The agenda listed the resolution; no outcome record is available.',
      timeline: [
        { date: '2026-09-08', heading: '7.', detail: '3.' },
        {
          date: '2026-09-08',
          heading: 'Resolution listed',
          detail: 'No outcome record available.',
        },
      ],
      meetings: ['2026-09-08'],
      sources: [{ title: 'Agenda' }],
      model: 'fixture',
      updatedAt: '2026-09-13',
    });
    expect(markdown).not.toMatch(/— 7\.|— 3\./u);
    expect(markdown).toMatch(/Resolution listed/);
  });
  it('renders explicit provenance when a deterministic evidence title is used', () => {
    const md = assembleStory({
      locality: 'Tifton, GA',
      title: 'Tift schools support',
      titleOrigin: 'evidence',
      status: 'ongoing',
      narrative: 'The supplied records describe local school support.',
      timeline: [],
      meetings: [],
      sources: [{ title: 'School record', url: 'https://example.test/story' }],
      model: 'qwen2.5:7b-instruct',
      updatedAt: '2026-09-13',
    });
    expect(md).toMatch(/\*\*Title source:\*\* deterministic evidence input/);
  });
  it('storyFilename slugifies safely', () => {
    expect(storyFilename('topic:water-rates-increase!')).toBe(
      'topic-water-rates-increase.md'
    );
    expect(storyFilename('topic:water-rates-increase!', 'A'.repeat(64))).toBe(
      `topic-water-rates-increase-${'a'.repeat(64)}.md`
    );
  });
});
