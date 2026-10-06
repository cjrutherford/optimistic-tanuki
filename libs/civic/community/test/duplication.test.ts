import {
  allowedQuotation,
  CorpusIndex,
  describeFinding,
  MIN_RUN,
} from '../src/duplication.js';

const article = (words: number, seed = 'council') =>
  Array.from(
    { length: words },
    (_, index) => `${seed}${index % 7 === 0 ? '' : index}`
  ).join(' ');

const gazette = {
  id: 'gazette-1',
  publisher: 'Tifton Gazette',
  title: 'City sets millage rate',
  url: 'https://tiftongazette.com/millage',
  body:
    'The Tifton City Council voted Monday to hold the millage rate at 9.5 mills for the coming fiscal year, ' +
    'after a public hearing in which three residents asked the council to lower it. The city manager said the ' +
    'rate would fund two new firefighter positions and the resurfacing of Love Avenue. ' +
    article(900),
};

describe('near-duplicate detection', () => {
  const index = new CorpusIndex([gazette]);

  it("lets a report in the contributor's own words through", () => {
    expect(
      index.check(
        'I was at the meeting. Three of us asked them to cut the rate, and they kept it where it was.'
      )
    ).toBe(null);
  });

  it('lets a short attributed quotation through', () => {
    const text =
      'The Gazette reported the city manager said the rate "would fund two new firefighter positions" — I heard the same.';
    expect(index.check(text)).toBe(null);
  });

  it('refuses a pasted article as a repost, naming the source', () => {
    const finding = index.check(gazette.body);
    expect(finding?.kind).toBe('repost');
    expect(finding?.document.publisher).toBe('Tifton Gazette');
    expect(describeFinding(finding!)).toMatch(/Tifton Gazette/u);
  });

  it('refuses a quotation over the cap, even spread across several extracts', () => {
    const extract = (from: number) =>
      gazette.body
        .split(' ')
        .slice(from, from + 30)
        .join(' ');
    const own =
      'My own view first, at some length, about what happened and why it matters to our street and our neighbours. '.repeat(
        6
      );
    const text = `${own}${extract(40)} And then: ${extract(
      200
    )} And finally: ${extract(400)}`;
    const finding = index.check(text);
    expect(finding).toBeTruthy();
    expect(finding!.kind).toBe('over-quote');
    expect(finding!.allowedWords).toBe(75);
    expect(finding!.copiedWords >= 76).toBeTruthy();
  });

  it('matches however the copy was typeset', () => {
    const shouted = gazette.body
      .toUpperCase()
      .replace(/ /gu, '  ')
      .replace(/'/gu, '’');
    expect(index.check(shouted)?.kind).toBe('repost');
  });

  it('caps a quotation at ten percent of a short source', () => {
    expect(allowedQuotation(200)).toBe(20);
    expect(allowedQuotation(2000)).toBe(75);
    const notice = {
      id: 'n',
      publisher: 'City of Tifton',
      title: 'Notice',
      url: null,
      body: article(120, 'notice'),
    };
    const small = new CorpusIndex([notice]);
    const copied = notice.body.split(' ').slice(0, 20).join(' ');
    expect(small.check(`Posted at city hall: ${copied}`)?.allowedWords).toBe(
      12
    );
  });

  it('never counts shared phrasing shorter than a run', () => {
    const phrase = gazette.body
      .split(' ')
      .slice(0, MIN_RUN - 1)
      .join(' ');
    expect(
      index.check(
        `${phrase} — that is how the story began, and here is what I saw instead.`
      )
    ).toBe(null);
  });
});
