import { assembleOutsiderBriefing } from '../src/briefing2.js';

test('bootstrap briefing does not imply day-over-day comparison', () => {
  const markdown = assembleOutsiderBriefing({
    locality: 'Adel, GA',
    periodStart: '2026-09-14',
    periodEnd: '2026-09-15',
    lede: 'Initial briefing: available context is summarized.',
    inBrief: ['The council reviewed a water plan.'],
    newItems: [
      {
        title: 'Water plan',
        date: '2026-09-14',
        url: 'https://example.test/water',
      },
    ],
    upcoming: [],
    threads: [],
    appendix: [],
    sourceCount: 1,
    model: 'candidate',
    editionMode: 'bootstrap',
  });
  expect(markdown).toMatch(/Initial briefing/u);
  expect(markdown).not.toMatch(
    /since (?:the last briefing|yesterday)|new this week/iu
  );
});
