import {
  renderDomainEmailTemplate,
  rootDomainFor,
} from './domain-email-template';

describe('domain email template', () => {
  it('reduces a sender address or subdomain to its root domain', () => {
    expect(rootDomainFor('no-reply@auth.optimistic-tanuki.com')).toBe(
      'optimistic-tanuki.com'
    );
    expect(
      rootDomainFor('https://hardware.hopefulaspirationsindustries.com')
    ).toBe('hopefulaspirationsindustries.com');
  });

  it('renders a branded, accessible action email with a text fallback', () => {
    const email = renderDomainEmailTemplate({
      domain: 'https://hardware.hopefulaspirationsindustries.com',
      appName: 'HAI Computer',
      heading: 'Verify your email address',
      body: ['Use the secure link below to confirm your account.'],
      action: {
        label: 'Verify email',
        url: 'https://hardware.hopefulaspirationsindustries.com/auth/verify#token=test-token',
      },
      note: 'If you did not request this, you can safely ignore this email.',
    });

    expect(email.rootDomain).toBe('hopefulaspirationsindustries.com');
    expect(email.html).toContain('HAI Computer');
    expect(email.html).toContain('background-color:#0f766e');
    expect(email.html).toContain(
      'href="https://hardware.hopefulaspirationsindustries.com/auth/verify#token=test-token"'
    );
    expect(email.html).toContain('Verify email');
    expect(email.text).toContain(
      'Verify email: https://hardware.hopefulaspirationsindustries.com/auth/verify#token=test-token'
    );
  });

  it('uses a root-domain identity and escapes untrusted content for unknown domains', () => {
    const email = renderDomainEmailTemplate({
      domain: 'notifications.example.org',
      heading: '<strong>Update</strong>',
      body: ['Hello <script>alert(1)</script>'],
    });

    expect(email.rootDomain).toBe('example.org');
    expect(email.html).toContain('example.org');
    expect(email.html).toContain('&lt;strong&gt;Update&lt;/strong&gt;');
    expect(email.html).not.toContain('<script>');
    expect(email.text).toContain('Hello <script>alert(1)</script>');
  });
});
