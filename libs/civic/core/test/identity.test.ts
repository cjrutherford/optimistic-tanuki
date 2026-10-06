import { canonicalStoryKey } from '../src/identity.js';

describe('canonical story identity', () => {
  it('prefers explicit case, matter, and permit identifiers', () => {
    const a = canonicalStoryKey('cook-county-ga', 'meeting', {
      title: 'Case CU-2026-11 RV park',
      body: '',
    });
    const b = canonicalStoryKey('cook-county-ga', 'news', {
      title: 'Matter CU 2026 11 update',
      body: '',
      caseId: 'CU-2026-11',
    });
    const c = canonicalStoryKey('cook-county-ga', 'permit', {
      title: 'Permit P-2026-04',
      body: '',
    });
    expect(a.strategy).toBe('explicit-id');
    expect(a.key).toBe(b.key);
    expect(c.strategy).toBe('explicit-id');
  });

  it('uses canonical URLs only within the same scope and kind', () => {
    const first = canonicalStoryKey('cook-county-ga', 'news', {
      title: 'A',
      body: '',
      canonicalUrl: 'https://News.example/story/',
    });
    const same = canonicalStoryKey('cook-county-ga', 'news', {
      title: 'Different title',
      body: '',
      canonicalUrl: 'https://news.example/story',
    });
    const otherKind = canonicalStoryKey('cook-county-ga', 'meeting', {
      title: 'A',
      body: '',
      canonicalUrl: 'https://news.example/story',
    });
    const otherScope = canonicalStoryKey('berrien-county-ga', 'news', {
      title: 'A',
      body: '',
      canonicalUrl: 'https://news.example/story',
    });
    expect(first.key).toBe(same.key);
    expect(first.key).not.toBe(otherKind.key);
    expect(first.key).not.toBe(otherScope.key);
    expect(first.strategy).toBe('canonical-url');
  });

  it('uses stable entity/action/jurisdiction/date before title fallback', () => {
    const first = canonicalStoryKey('cook-county-ga', 'permit', {
      title: 'Zoning punctuation',
      body: '',
      entity: 'Water Plant',
      action: 'Approve',
      jurisdiction: 'cook-county-ga',
      eventDate: '2026-09-12',
    });
    const second = canonicalStoryKey('cook-county-ga', 'permit', {
      title: 'water-plant — approved!',
      body: '',
      entity: ' water plant ',
      action: 'approved',
      jurisdiction: 'cook-county-ga',
      eventDate: '2026-09-12T18:00:00Z',
    });
    const fallback = canonicalStoryKey('cook-county-ga', 'news', {
      title: 'Unrelated item',
      body: '',
    });
    expect(first.key).toBe(second.key);
    expect(first.strategy).toBe('entity-date');
    expect(fallback.strategy).toBe('fallback');
    expect(fallback.key).toMatch(/cook-county-ga/);
  });

  it('does not merge generic words or same titles across counties', () => {
    const a = canonicalStoryKey('cook-county-ga', 'news', {
      title: 'Update',
      body: 'General update',
    });
    const b = canonicalStoryKey('cook-county-ga', 'news', {
      title: 'Update',
      body: 'Different update',
    });
    const c = canonicalStoryKey('berrien-county-ga', 'news', {
      title: 'Update',
      body: 'General update',
    });
    expect(a.key).not.toBe(b.key);
    expect(a.key).not.toBe(c.key);
  });

  it('keeps fallback identities conservative with effective day and content', () => {
    const first = canonicalStoryKey('cook-county-ga', 'news', {
      title: 'Road update',
      body: 'A different report',
      publishedAt: '2026-09-12T10:00:00Z',
    });
    const same = canonicalStoryKey('cook-county-ga', 'news', {
      title: 'Road update',
      body: 'A different report',
      publishedAt: '2026-09-12T18:00:00Z',
    });
    const changedBody = canonicalStoryKey('cook-county-ga', 'news', {
      title: 'Road update',
      body: 'Another report',
      publishedAt: '2026-09-12T10:00:00Z',
    });
    const changedDate = canonicalStoryKey('cook-county-ga', 'news', {
      title: 'Road update',
      body: 'A different report',
      publishedAt: '2026-09-13T10:00:00Z',
    });
    expect(first.key).toBe(same.key);
    expect(first.key).not.toBe(changedBody.key);
    expect(first.key).not.toBe(changedDate.key);
    expect(first.strategy).toBe('fallback');
  });
});
