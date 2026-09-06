import {
  extractCompanyFromHeadline,
  extractFundingAmount,
  stripPublisherSuffix,
} from './funding-headline.util';
import { estimateBuyerLeadValue } from './lead-value.util';

describe('reading a funding headline', () => {
  it('takes the company from the front of the sentence', () => {
    expect(
      extractCompanyFromHeadline('Acme raises $50M Series B to expand platform')
    ).toBe('Acme');
    expect(
      extractCompanyFromHeadline('Northwind Health secured $12m in Series A')
    ).toBe('Northwind Health');
  });

  it('drops the aside that describes the company rather than names it', () => {
    expect(
      extractCompanyFromHeadline(
        'Acme, a logistics startup, lands $8M to grow its fleet'
      )
    ).toBe('Acme');
  });

  it('trims the publication that signed the headline', () => {
    expect(
      extractCompanyFromHeadline('Acme raises $50M Series B | TechCrunch')
    ).toBe('Acme');
    expect(stripPublisherSuffix('Something happened — Reuters')).toBe(
      'Something happened'
    );
  });

  it('ignores a leading feed label', () => {
    expect(
      extractCompanyFromHeadline('Exclusive: Acme raises $50M Series B')
    ).toBe('Acme');
  });

  it('says nothing rather than guessing when the shape is unfamiliar', () => {
    // A missing company invites a correction; a wrong one does not.
    expect(
      extractCompanyFromHeadline('$50M for Acme as investors pile in')
    ).toBeNull();
    expect(
      extractCompanyFromHeadline('Why the funding winter is finally thawing')
    ).toBeNull();
    expect(extractCompanyFromHeadline('raises $50M')).toBeNull();
    expect(extractCompanyFromHeadline('')).toBeNull();
  });

  it('will not mistake a whole clause for a company name', () => {
    expect(
      extractCompanyFromHeadline(
        'A little known logistics business from Ohio finally raises $8M'
      )
    ).toBeNull();
  });

  it('keeps the raise as the source wrote it', () => {
    expect(extractFundingAmount('Acme raises $50M Series B')).toBe('$50M');
    expect(extractFundingAmount('secured £12.5m in Series A')).toBe('£12.5m');
    expect(extractFundingAmount('no money mentioned here')).toBeNull();
  });
});

describe('what a buyer lead is worth', () => {
  it('reads the middle of a stated band', () => {
    expect(estimateBuyerLeadValue(['$5k-$25k'])).toBe(15000);
    expect(estimateBuyerLeadValue(['$25k-$100k'])).toBe(62500);
  });

  it('treats a ceiling as a ceiling and a floor as a floor', () => {
    expect(estimateBuyerLeadValue(['Under $5k'])).toBe(2500);
    // Nothing states the top of "$100k+", so the floor is all that can be
    // claimed.
    expect(estimateBuyerLeadValue(['$100k+'])).toBe(100000);
  });

  it('leaves an unknown value unknown', () => {
    expect(estimateBuyerLeadValue([])).toBe(0);
    expect(estimateBuyerLeadValue(undefined)).toBe(0);
    expect(estimateBuyerLeadValue(['it depends'])).toBe(0);
  });

  it('understands millions as well as thousands', () => {
    expect(estimateBuyerLeadValue(['$1m-$2m'])).toBe(1500000);
  });
});
