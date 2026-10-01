/** One message read from the subscribed inbox. */
export interface MailMessage {
  /** The RFC 5322 Message-ID: stable across reads, so it keys the record. */
  id: string;
  /** Sender address, lower-case. */
  from: string;
  subject: string;
  /** ISO 8601 send time. */
  date: string;
  /** Plain text: the text part, or the HTML part converted. */
  text: string;
  html?: string;
  attachments: { filename: string; contentType: string; content: Uint8Array }[];
}

/**
 * The inbox an email source reads. A port, so the adapter's logic is tested
 * without a mail server; `ImapMailbox` is the production implementation.
 */
export interface Mailbox {
  /**
   * Messages sent at or after `since` whose sender matches `options.from`.
   * Each entry is a full address ("clerk@cityofadelga.gov") or a domain
   * ("cityofadelga.gov" or "@cityofadelga.gov"). A domain entry matches that
   * exact domain only, never its subdomains.
   */
  messagesSince(
    since: Date,
    options: { from: readonly string[] }
  ): Promise<MailMessage[]>;
}

/** Whether a sender address is matched by one `from` entry (see `Mailbox`). */
export function senderMatches(
  address: string,
  entries: readonly string[]
): boolean {
  const sender = address.trim().toLowerCase();
  const domain = sender.slice(sender.lastIndexOf('@') + 1);
  return entries.some((entry) => {
    const wanted = entry.trim().toLowerCase();
    if (!wanted) return false;
    if (wanted.startsWith('@')) return domain === wanted.slice(1);
    if (wanted.includes('@')) return sender === wanted;
    return domain === wanted;
  });
}
