export interface SmtpSetupSecrets {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
}

export function buildSmtpTransportOptions(secrets: SmtpSetupSecrets) {
  const port = Number(secrets.SMTP_PORT || '465');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port');
  }

  return {
    host: secrets.SMTP_HOST || 'mail.christopherrutherford.net',
    port,
    secure: (secrets.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: {
      user: secrets.SMTP_USER || '',
      pass: secrets.SMTP_PASS || '',
    },
  };
}
