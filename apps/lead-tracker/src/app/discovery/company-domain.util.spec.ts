import { resolveCompanyWebsite } from './company-domain.util';

const articleUrl = 'https://techcrunch.com/2026/01/acme-raises-50m';

const resolve = (company: string | null, links: string[]) =>
  resolveCompanyWebsite({ company, articleUrl, links });

describe('resolving the company a funding article is about', () => {
  it('picks the link that corroborates the company name', () => {
    expect(
      resolve('Acme', [
        'https://techcrunch.com/tag/funding',
        'https://twitter.com/acme',
        'https://www.acme.com/about',
      ])
    ).toBe('https://acme.com/');
  });

  it('matches a multi-word name against a condensed domain', () => {
    expect(resolve('Northwind Health', ['https://northwindhealth.io/'])).toBe(
      'https://northwindhealth.io/'
    );
  });

  it('falls back to the first word when the domain is shorter than the name', () => {
    expect(resolve('Northwind Health', ['https://northwind.com/'])).toBe(
      'https://northwind.com/'
    );
  });

  it('never returns the publication that ran the story', () => {
    expect(
      resolve('Acme', [
        'https://techcrunch.com/acme-coverage',
        'https://subdomain.techcrunch.com/acme',
      ])
    ).toBeNull();
  });

  it('ignores social profiles and data aggregators', () => {
    expect(
      resolve('Acme', [
        'https://www.linkedin.com/company/acme',
        'https://www.crunchbase.com/organization/acme',
        'https://twitter.com/acme',
      ])
    ).toBeNull();
  });

  it('returns nothing rather than guessing at an unrelated link', () => {
    // A funding article links to a great many things. "The first outbound
    // link" would be a coin toss presented as a finding.
    expect(
      resolve('Acme', [
        'https://sequoia.com/portfolio',
        'https://example.org/newsletter',
      ])
    ).toBeNull();
  });

  it('will not match on a name too short to mean anything', () => {
    expect(resolve('Ai', ['https://ai-weekly-digest.com/'])).toBeNull();
  });

  it('has nothing to work with when the headline yielded no company', () => {
    expect(resolve(null, ['https://acme.com/'])).toBeNull();
    expect(resolve('Acme', [])).toBeNull();
  });

  it('prefers an exact domain over one that merely contains the name', () => {
    expect(
      resolve('Acme', [
        'https://acme-reviews-and-complaints.com/',
        'https://acme.com/',
      ])
    ).toBe('https://acme.com/');
  });

  it('shrugs off a malformed link rather than failing the whole page', () => {
    expect(resolve('Acme', ['not-a-url', 'https://acme.com/'])).toBe(
      'https://acme.com/'
    );
  });
});
