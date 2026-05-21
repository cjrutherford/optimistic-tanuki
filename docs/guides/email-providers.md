# Email Provider Setup Guide

This guide covers how to configure and use the email plugin system in Optimistic Tanuki. The `@optimistic-tanuki/email` library provides a plug-in architecture that lets you swap between local SMTP servers, third-party email APIs, and a development console provider without changing application code.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [SMTP Provider](#smtp-provider)
  - [Local SMTP Server](#local-smtp-server)
  - [Gmail SMTP](#gmail-smtp)
  - [Outlook / Microsoft 365 SMTP](#outlook--microsoft-365-smtp)
  - [Amazon SES SMTP](#amazon-ses-smtp)
- [HTTP API Provider](#http-api-provider)
  - [SendGrid](#sendgrid)
  - [Mailgun](#mailgun)
  - [Amazon SES API](#amazon-ses-api)
  - [Custom API Endpoint](#custom-api-endpoint)
- [Console Provider](#console-provider)
- [Multiple Providers](#multiple-providers)
- [Creating a Custom Provider](#creating-a-custom-provider)
- [Environment Variable Reference](#environment-variable-reference)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The email system uses three main components:

| Component | Purpose |
|---|---|
| **`EmailProvider`** | Interface that every provider plugin must implement (`sendEmail`, `verifyConnection`) |
| **`EmailPluginRegistry`** | Manages registered providers and tracks the active provider |
| **`EmailService`** | Injectable service that delegates calls to the active provider |
| **`EmailModule`** | NestJS dynamic module with `forRoot()` and `forRootAsync()` configuration |

```
Application
  └── EmailService (inject this)
        └── EmailPluginRegistry
              ├── SmtpEmailProvider      (active)
              ├── HttpApiEmailProvider
              └── ConsoleEmailProvider
```

The registry supports multiple providers at once. The first provider registered becomes the default, but you can switch the active provider at runtime.

### The EmailProvider Interface

Every provider implements this contract:

```typescript
interface EmailProvider {
  readonly name: string;
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
  verifyConnection(): Promise<boolean>;
}
```

### EmailMessage Structure

```typescript
interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;           // Plain text body
  html?: string;           // HTML body
  from?: string;           // Overrides provider default
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
}
```

---

## Quick Start

Import the `EmailModule` in your NestJS module and inject `EmailService` where needed.

### Static Configuration

```typescript
import { Module } from '@nestjs/common';
import { EmailModule, SmtpEmailProvider } from '@optimistic-tanuki/email';

@Module({
  imports: [
    EmailModule.forRoot({
      providers: [
        new SmtpEmailProvider({
          host: 'localhost',
          port: 1025,
          defaultFrom: 'app@example.com',
        }),
      ],
    }),
  ],
})
export class AppModule {}
```

### Async Configuration (with ConfigService)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  EmailModule,
  SmtpEmailProvider,
  ConsoleEmailProvider,
} from '@optimistic-tanuki/email';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EmailModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const smtpHost = config.get<string>('SMTP_HOST');
        if (smtpHost) {
          return {
            providers: [
              new SmtpEmailProvider({
                host: smtpHost,
                port: config.get<number>('SMTP_PORT') || 587,
                secure: config.get<boolean>('SMTP_SECURE') || false,
                auth: {
                  user: config.get<string>('SMTP_USER') || '',
                  pass: config.get<string>('SMTP_PASS') || '',
                },
                defaultFrom:
                  config.get<string>('SMTP_FROM') ||
                  'noreply@optimistic-tanuki.dev',
              }),
            ],
          };
        }
        // Fall back to console logging in development
        return { providers: [new ConsoleEmailProvider()] };
      },
    }),
  ],
})
export class AppModule {}
```

### Sending an Email

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from '@optimistic-tanuki/email';

@Injectable()
export class NotificationService {
  constructor(private readonly emailService: EmailService) {}

  async sendWelcome(email: string, name: string) {
    const result = await this.emailService.sendEmail({
      to: email,
      subject: 'Welcome!',
      text: `Hello ${name}, welcome to Optimistic Tanuki!`,
      html: `<h1>Welcome!</h1><p>Hello ${name}, welcome to Optimistic Tanuki!</p>`,
    });

    if (!result.success) {
      console.error('Failed to send email:', result.error);
    }
  }
}
```

---

## SMTP Provider

The `SmtpEmailProvider` uses [nodemailer](https://nodemailer.com/) to send email through any SMTP-compatible server. It supports authentication, TLS, attachments, CC/BCC, and reply-to headers.

### Configuration Options

```typescript
interface SmtpConfig {
  host: string;        // SMTP server hostname
  port: number;        // SMTP server port (25, 465, 587)
  secure?: boolean;    // true for port 465, false for STARTTLS on 587
  auth?: {
    user: string;      // SMTP username
    pass: string;      // SMTP password or app password
  };
  defaultFrom?: string; // Default "from" address
}
```

### Local SMTP Server

For development with a local SMTP server (e.g., [MailHog](https://github.com/mailhog/MailHog), [Mailpit](https://github.com/axllent/mailpit), or Postfix):

```bash
# Environment variables
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=dev@localhost
```

```typescript
new SmtpEmailProvider({
  host: 'localhost',
  port: 1025,
  defaultFrom: 'dev@localhost',
})
```

**Docker Compose example** — add a MailHog service for local email testing:

```yaml
services:
  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI — view sent emails at http://localhost:8025
```

### Gmail SMTP

> **Note:** Gmail requires an [App Password](https://support.google.com/accounts/answer/185833) when 2-Step Verification is enabled.

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=you@gmail.com
```

```typescript
new SmtpEmailProvider({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,  // Uses STARTTLS
  auth: {
    user: 'you@gmail.com',
    pass: 'your-app-password',
  },
  defaultFrom: 'you@gmail.com',
})
```

### Outlook / Microsoft 365 SMTP

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@outlook.com
SMTP_PASS=your-password
SMTP_FROM=you@outlook.com
```

```typescript
new SmtpEmailProvider({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: 'you@outlook.com',
    pass: 'your-password',
  },
  defaultFrom: 'you@outlook.com',
})
```

### Amazon SES SMTP

```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-user
SMTP_PASS=your-ses-smtp-password
SMTP_FROM=verified-sender@yourdomain.com
```

```typescript
new SmtpEmailProvider({
  host: 'email-smtp.us-east-1.amazonaws.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SES_SMTP_USER,
    pass: process.env.SES_SMTP_PASS,
  },
  defaultFrom: 'verified-sender@yourdomain.com',
})
```

> Replace `us-east-1` with your SES region. The sender address must be verified in SES.

---

## HTTP API Provider

The `HttpApiEmailProvider` sends email via HTTP POST to any REST API endpoint. It works with third-party services like SendGrid, Mailgun, and Amazon SES.

### Configuration Options

```typescript
interface HttpApiEmailConfig {
  apiUrl: string;                      // API endpoint URL
  apiKey: string;                      // API key (sent as Bearer token)
  defaultFrom?: string;                // Default "from" address
  providerName?: string;               // Provider identifier (default: 'http-api')
  headers?: Record<string, string>;    // Additional HTTP headers
}
```

### SendGrid

1. Create a [SendGrid account](https://sendgrid.com/) and generate an API key under **Settings → API Keys**.
2. Verify a sender identity under **Settings → Sender Authentication**.

```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM=verified-sender@yourdomain.com
```

```typescript
new HttpApiEmailProvider({
  providerName: 'sendgrid',
  apiUrl: 'https://api.sendgrid.com/v3/mail/send',
  apiKey: process.env.SENDGRID_API_KEY,
  defaultFrom: process.env.SENDGRID_FROM || 'noreply@yourdomain.com',
})
```

### Mailgun

1. Create a [Mailgun account](https://www.mailgun.com/) and get your API key from **Settings → API Keys**.
2. Add and verify your domain under **Sending → Domains**.

```bash
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM=noreply@yourdomain.com
```

```typescript
new HttpApiEmailProvider({
  providerName: 'mailgun',
  apiUrl: `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`,
  apiKey: process.env.MAILGUN_API_KEY,
  defaultFrom: process.env.MAILGUN_FROM || 'noreply@yourdomain.com',
})
```

### Amazon SES API

1. Set up [Amazon SES](https://aws.amazon.com/ses/) in your AWS account.
2. Verify sender identities and request production access if in the sandbox.

```bash
SES_API_URL=https://email.us-east-1.amazonaws.com
SES_API_KEY=your-ses-api-key
SES_FROM=verified-sender@yourdomain.com
```

```typescript
new HttpApiEmailProvider({
  providerName: 'ses',
  apiUrl: process.env.SES_API_URL,
  apiKey: process.env.SES_API_KEY,
  defaultFrom: process.env.SES_FROM || 'noreply@yourdomain.com',
})
```

### Custom API Endpoint

The `HttpApiEmailProvider` can work with any API that accepts a JSON POST body:

```typescript
new HttpApiEmailProvider({
  providerName: 'my-service',
  apiUrl: 'https://api.my-email-service.com/v1/send',
  apiKey: process.env.MY_EMAIL_API_KEY,
  defaultFrom: 'noreply@yourdomain.com',
  headers: {
    'X-Custom-Header': 'custom-value',
  },
})
```

The provider sends a JSON body with this structure:

```json
{
  "from": "noreply@yourdomain.com",
  "to": ["recipient@example.com"],
  "subject": "Hello",
  "text": "Plain text body",
  "html": "<p>HTML body</p>",
  "cc": [],
  "bcc": [],
  "replyTo": "reply@example.com"
}
```

Authentication is sent as a `Bearer` token in the `Authorization` header.

---

## Console Provider

The `ConsoleEmailProvider` logs emails to stdout instead of sending them. It is useful for local development and testing.

```typescript
import { EmailModule, ConsoleEmailProvider } from '@optimistic-tanuki/email';

EmailModule.forRoot({
  providers: [new ConsoleEmailProvider()],
})
```

Output example:

```
[ConsoleEmailProvider] [Console Email] To: user@example.com | Subject: Welcome!
[ConsoleEmailProvider] [Console Email] Body: Hello, welcome to Optimistic Tanuki!
[ConsoleEmailProvider] [Console Email] HTML body length: 68
```

The console provider is the **automatic fallback** when no `SMTP_HOST` environment variable is set in the authentication service.

---

## Multiple Providers

You can register multiple providers and switch between them. The first provider registered becomes the default.

```typescript
EmailModule.forRoot({
  providers: [
    new SmtpEmailProvider({ host: 'smtp.gmail.com', port: 587, ... }),
    new HttpApiEmailProvider({ providerName: 'sendgrid', apiUrl: '...', apiKey: '...' }),
    new ConsoleEmailProvider(),
  ],
  activeProvider: 'sendgrid',  // Override the default (first registered)
})
```

### Switching Providers at Runtime

Inject `EmailPluginRegistry` to change the active provider dynamically:

```typescript
import { Injectable } from '@nestjs/common';
import { EmailPluginRegistry } from '@optimistic-tanuki/email';

@Injectable()
export class EmailAdminService {
  constructor(private readonly registry: EmailPluginRegistry) {}

  switchToSmtp() {
    this.registry.setActiveProvider('smtp');
  }

  switchToSendGrid() {
    this.registry.setActiveProvider('sendgrid');
  }

  listProviders(): string[] {
    return this.registry.getRegisteredProviders();
  }
}
```

---

## Creating a Custom Provider

To add a new email provider, implement the `EmailProvider` interface:

```typescript
import {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
} from '@optimistic-tanuki/email';

export class MyCustomProvider implements EmailProvider {
  readonly name = 'my-custom-provider';

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    try {
      // Your sending logic here
      const messageId = await myEmailSdk.send({
        to: message.to,
        from: message.from || 'default@example.com',
        subject: message.subject,
        body: message.html || message.text,
      });

      return { success: true, messageId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await myEmailSdk.ping();
      return true;
    } catch {
      return false;
    }
  }
}
```

Then register it:

```typescript
EmailModule.forRoot({
  providers: [new MyCustomProvider()],
})
```

---

## Environment Variable Reference

The authentication service uses these environment variables. Set them in your `.env` file or Docker Compose configuration:

| Variable | Description | Default |
|---|---|---|
| `SMTP_HOST` | SMTP server hostname. If set, activates SMTP provider. | *(none — falls back to console)* |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_SECURE` | Use direct TLS (`true` for port 465) | `false` |
| `SMTP_USER` | SMTP authentication username | `''` |
| `SMTP_PASS` | SMTP authentication password | `''` |
| `SMTP_FROM` | Default sender address | `noreply@optimistic-tanuki.dev` |

For HTTP API providers, define your own environment variables and reference them in `forRootAsync`:

| Variable | Description | Example |
|---|---|---|
| `SENDGRID_API_KEY` | SendGrid API key | `SG.xxxxx` |
| `MAILGUN_API_KEY` | Mailgun API key | `key-xxxxx` |
| `MAILGUN_DOMAIN` | Mailgun sending domain | `mg.yourdomain.com` |

---

## Troubleshooting

### No emails are being sent

1. Check that a provider is registered. If `SMTP_HOST` is not set and you haven't registered a provider manually, the console provider is used.
2. Check the application logs for `[EmailService]` messages:
   - `No email provider is active. Email not sent.` — no provider was registered.
   - `SMTP send failed: ...` — check SMTP credentials and connectivity.

### SMTP connection refused

- Verify the SMTP host and port are correct and reachable from the application container.
- For Docker environments, use the service name (e.g., `mailhog`) rather than `localhost`.
- Check that port 587 or 465 is not blocked by a firewall.

### Gmail "Less secure apps" error

Gmail requires an App Password when 2-Step Verification is enabled. Regular passwords will not work. See [Google's App Password guide](https://support.google.com/accounts/answer/185833).

### HTTP API provider returns 401/403

- Verify your API key is correct and has sufficient permissions.
- For SendGrid, ensure the API key has "Mail Send" permissions.
- For Mailgun, ensure you are using the correct domain-specific API key.

### Verifying the connection

Use `EmailService.verifyConnection()` at application startup to confirm the provider is reachable:

```typescript
import { OnModuleInit } from '@nestjs/common';
import { EmailService } from '@optimistic-tanuki/email';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private readonly emailService: EmailService) {}

  async onModuleInit() {
    const connected = await this.emailService.verifyConnection();
    if (!connected) {
      console.warn('Email provider is not reachable — emails will fail.');
    }
  }
}
```
