import { buildSmtpTransportOptions } from './email-setup';

describe('buildSmtpTransportOptions', () => {
  it('uses implicit TLS on the configured Stalwart endpoint', () => {
    expect(
      buildSmtpTransportOptions({
        SMTP_HOST: 'mail.christopherrutherford.net',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'no-reply@christopherrutherford.net',
        SMTP_PASS: 'secret',
      })
    ).toEqual({
      host: 'mail.christopherrutherford.net',
      port: 465,
      secure: true,
      auth: { user: 'no-reply@christopherrutherford.net', pass: 'secret' },
    });
  });
});
