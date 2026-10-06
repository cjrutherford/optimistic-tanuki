import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assessEditorialText,
  extractReadableArticle,
  isReadableArticleText,
  readablePageText,
} from '../src/readable-text.js';
import { isEditoriallyEligibleBody } from '../src/article-enrichment.js';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', 'articles', name), 'utf8');
const MENU =
  'Subscribe Home News Obituaries Sports Classifieds E-Edition Contests Best of Riverton Home Subscriptions Newsletter Signup E-Edition News Sports Local Sports Obituaries Opinion Classifieds Public Notices Contact Us About Us';
const PROSE =
  "The county approved a bridge repair project on Old Mill Road during Monday's commission meeting. Construction begins next month and is expected to last about eleven weeks. Commissioners said a state grant covers most of the cost, with the rest drawn from the road fund. School buses will use the Pine Street route while crews replace the deck and guardrails.";

describe('readable article extraction', () => {
  it('keeps article paragraphs and drops page chrome from a newspaper template', () => {
    const article = extractReadableArticle(
      fixture('normal.html'),
      'https://publisher.example/story/123'
    );
    expect(article?.method).toBe('readability');
    expect(article?.text.split('\n\n').length).toBe(4);
    expect(article?.text ?? '').not.toMatch(
      /Subscribe|Swipe or click|newsletter|You Might Like|Most Popular|Privacy Policy/u
    );
  });

  it('drops a closing social and app promotion after the story', () => {
    const html = `<html><body><article><p>${PROSE}</p><p>A second paragraph adds that the work was approved after a public hearing with no objections from residents.</p><p>To stay up to date on all the latest news as it develops, follow WALB on Facebook and X. For more news, download the WALB News app.</p></article></body></html>`;
    const article = extractReadableArticle(
      html,
      'https://station.example/story'
    );
    expect(article?.text ?? '').toMatch(/no objections from residents\.$/u);
  });

  it('strips navigation, chrome containers, and link lists from arbitrary pages', () => {
    const text = readablePageText(fixture('government-post.html'));
    expect(text).toMatch(/seasonal flu vaccines are now available/u);
    expect(text).not.toMatch(
      /Careers|Recent Posts|Clinic hours update|Skip to content/u
    );
  });

  it('returns nothing article-sized for a page without content', () => {
    const article = extractReadableArticle(
      fixture('malformed.html'),
      'https://publisher.example/bad'
    );
    expect(isReadableArticleText(article?.text ?? '')).toBe(false);
    expect(article?.text ?? '').not.toMatch(/bad\(\)|Menu/u);
  });
});

describe('editorial prose gate', () => {
  it('accepts article prose and rejects listings, menus, and fragments', () => {
    expect(isReadableArticleText(PROSE)).toBe(true);
    expect(
      isReadableArticleText(
        extractReadableArticle(
          fixture('listing.html'),
          'https://publisher.example/news'
        )?.text ?? ''
      )
    ).toBe(false);
    expect(isReadableArticleText(`${MENU} ${MENU}`)).toBe(false);
    expect(isReadableArticleText('The council met.')).toBe(false);
  });

  it('measures menu runs inside whitespace-collapsed text', () => {
    const polluted = assessEditorialText(`${MENU} ${PROSE} ${MENU}`);
    expect(polluted.menuRatio > 0.4).toBeTruthy();
    expect(assessEditorialText(PROSE).menuRatio).toBe(0);
  });

  it('rejects page-length menu text as briefing evidence but keeps short snippets and meeting lists', () => {
    expect(isEditoriallyEligibleBody(`${MENU} ${MENU} ${PROSE}`, 'news')).toBe(
      false
    );
    expect(isEditoriallyEligibleBody(PROSE, 'news')).toBe(true);
    expect(
      isEditoriallyEligibleBody(
        'Council approves water project after a public hearing',
        'news'
      )
    ).toBe(true);
    expect(
      isEditoriallyEligibleBody(
        `Agenda ${'Call to Order Roll Call Approval of Minutes Old Business New Business Public Comment Adjournment '.repeat(
          4
        )}`,
        'meeting'
      )
    ).toBe(true);
  });
});
