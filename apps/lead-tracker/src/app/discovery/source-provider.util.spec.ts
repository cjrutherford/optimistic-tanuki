import {
  extractContactPoints,
  selectPrimaryContactValue,
  type LeadContactPoint,
} from './source-provider.util';

describe('source-provider.util contact extraction', () => {
  it('extracts mailto, tel, plain-text contacts, and contact links from html', () => {
    const contacts = extractContactPoints(
      `
        <main>
          <a href="mailto:jobs@example.com">jobs@example.com</a>
          <a href="tel:+1-555-0100">Call us</a>
          <a href="https://www.linkedin.com/in/hiring-manager">LinkedIn</a>
          <a href="/contact">Contact</a>
          Reach recruiting@example.com or +1 (555) 0100 for details.
        </main>
      `,
      'https://example.com/jobs/role'
    );

    expect(contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'email',
          value: 'jobs@example.com',
          href: 'mailto:jobs@example.com',
        }),
        expect.objectContaining({
          kind: 'phone',
          value: '+15550100',
          href: 'tel:+15550100',
        }),
        expect.objectContaining({
          kind: 'link',
          href: 'https://www.linkedin.com/in/hiring-manager',
        }),
        expect.objectContaining({
          kind: 'link',
          href: 'https://example.com/contact',
        }),
        expect.objectContaining({
          kind: 'email',
          value: 'recruiting@example.com',
          href: 'mailto:recruiting@example.com',
        }),
      ])
    );
  });

  it('prefers primary contacts when selecting scalar fallback values', () => {
    const contacts: LeadContactPoint[] = [
      {
        kind: 'email',
        value: 'secondary@example.com',
        href: 'mailto:secondary@example.com',
        label: 'Secondary',
        source: 'posting-page',
        isPrimary: false,
      },
      {
        kind: 'email',
        value: 'primary@example.com',
        href: 'mailto:primary@example.com',
        label: 'Primary',
        source: 'provider',
        isPrimary: true,
      },
    ];

    expect(selectPrimaryContactValue(contacts, 'email')).toBe(
      'primary@example.com'
    );
  });
});
