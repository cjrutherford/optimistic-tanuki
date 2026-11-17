export interface Delivery { revision: string; communityId: string; eventNonce: string; sourceEpoch: string | null }
export interface DeliverySource {
  unread(after?: string): Promise<Delivery[]>;
}

/** The forward traversal reaches the tail; a second bounded traversal revisits
 * the beginning even when the forward traversal never sees an empty page. */
export class DeliveryScan {
  private forward?: string;
  private revisit?: string;
  private revisitPages = 0;
  private nextRevisit = false;
  private revisitLimit: number;
  constructor(private readonly maxRevisitPages = 100) {
    if (!Number.isSafeInteger(maxRevisitPages) || maxRevisitPages < 1) throw new Error('Invalid scan page limit');
    this.revisitLimit = maxRevisitPages;
  }
  async deliverBatch(source: DeliverySource, reconciler: { apply(event: Delivery): Promise<void> }): Promise<number> {
    const revisit = this.nextRevisit;
    const events = await source.unread(revisit ? this.revisit : this.forward);
    for (const event of events) await reconciler.apply(event);
    const after = events.length ? events[events.length - 1].revision : undefined;
    if (revisit) {
      this.revisitPages++;
      if (!events.length || this.revisitPages >= this.revisitLimit) {
        // Grow the next pass so a late commit anywhere in a finite backlog is
        // eventually revisited, even if the tail is continuously advancing.
        this.revisitLimit = events.length ? Math.min(this.revisitLimit * 2, Number.MAX_SAFE_INTEGER) : this.maxRevisitPages;
        this.revisit = undefined;
        this.revisitPages = 0;
      } else this.revisit = after;
    } else this.forward = after;
    this.nextRevisit = !revisit;
    return events.length;
  }
}
