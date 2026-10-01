import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { senderMatches, type MailMessage, type Mailbox } from './mailbox.js';

export interface ImapMailboxOptions {
  /** imaps://user:pass@host:993 — credentials come from here and nowhere else. */
  url: string;
  /** Folder to read. Default INBOX. */
  mailbox?: string;
}

/**
 * Reads a dedicated inbox over IMAP. Read-only: the folder is opened with a
 * read-only lock and bodies are fetched with BODY.PEEK, so no message is
 * flagged \Seen, moved or deleted. A connection is opened per call.
 */
export class ImapMailbox implements Mailbox {
  private readonly url: URL;
  private readonly folder: string;

  constructor(options: ImapMailboxOptions) {
    this.url = new URL(options.url);
    this.folder = options.mailbox ?? 'INBOX';
  }

  async messagesSince(
    since: Date,
    options: { from: readonly string[] }
  ): Promise<MailMessage[]> {
    const client = new ImapFlow({
      host: this.url.hostname,
      port: this.url.port ? Number(this.url.port) : 993,
      secure: this.url.protocol !== 'imap:',
      auth: {
        user: decodeURIComponent(this.url.username),
        pass: decodeURIComponent(this.url.password),
      },
      logger: false,
    });
    const messages: MailMessage[] = [];
    await client.connect();
    try {
      const lock = await client.getMailboxLock(this.folder, {
        readOnly: true,
      });
      try {
        // SINCE is date-granular; the precise cut is applied below.
        const uids = await client.search({ since }, { uid: true });
        if (!uids || uids.length === 0) return messages;
        for await (const fetched of client.fetch(
          uids,
          { source: true },
          { uid: true }
        )) {
          if (!fetched.source) continue;
          const parsed = await simpleParser(fetched.source);
          const from = parsed.from?.value[0]?.address?.toLowerCase() ?? '';
          const date = parsed.date;
          if (!parsed.messageId || !from || !date || date < since) continue;
          if (!senderMatches(from, options.from)) continue;
          messages.push({
            id: parsed.messageId,
            from,
            subject: parsed.subject ?? '',
            date: date.toISOString(),
            text: parsed.text ?? '',
            ...(typeof parsed.html === 'string' ? { html: parsed.html } : {}),
            attachments: parsed.attachments.map((attachment) => ({
              filename: attachment.filename ?? 'attachment',
              contentType: attachment.contentType,
              content: new Uint8Array(attachment.content),
            })),
          });
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => undefined);
    }
    return messages;
  }
}
