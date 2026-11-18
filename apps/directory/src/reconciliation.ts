import { DataSource } from 'typeorm';
import { ReceiptV2Identity, canonicalReceiptV2 } from './receipt-v2-identity';
import { readRecoveryEpochs } from './recovery-authority';
import {
  isEligibleCommunity,
  SocialCommunitySnapshot,
} from './social-eligibility';

/** Initialize once. Changing capacity requires a deliberate offline procedure. */
export async function configureReceiptPool(
  db: DataSource,
  capacity: number
): Promise<void> {
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1000000)
    throw new Error('Invalid receipt capacity');
  await db.transaction(async (manager) => {
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('directory-receipt-pool-v1', 0))"
    );
    const [{ n }] = await manager.query(
      'SELECT count(*)::int AS n FROM directory_receipt_slot'
    );
    if (n === 0) {
      await manager.query(
        'INSERT INTO directory_receipt_slot (id) SELECT generate_series(1, $1::integer)',
        [capacity]
      );
    } else if (n !== capacity)
      throw new Error('Receipt pool capacity differs from configured capacity');
  });
}

/** A single consumer delivery. The event ID is an identity, not an ordering cursor. */
export class DirectoryReconciler {
  constructor(
    private readonly db: DataSource,
    private readonly readCurrent: (
      id: string
    ) => Promise<SocialCommunitySnapshot | null>,
    private readonly membership: (
      eventId: string,
      communityId: string,
      sourceEpoch: string,
      eventNonce: string
    ) => Promise<
      | { status: 'absent' }
      | {
          status: 'pending';
          eventNonce: string;
          sourceEpoch: string;
          snapshot: SocialCommunitySnapshot | null;
        }
    >
  ) {}

  async apply(identity: ReceiptV2Identity): Promise<'applied' | 'retired'> {
    canonicalReceiptV2(identity);
    return this.reconcile(identity.communityId, identity);
  }

  async census(communityId: string): Promise<void> {
    await this.reconcile(communityId);
  }

  async cleanup(identity: ReceiptV2Identity): Promise<'retired' | 'pending'> {
    canonicalReceiptV2(identity);
    const {
      revision: eventId,
      communityId,
      sourceEpoch,
      eventNonce,
    } = identity;
    return this.db.transaction(async (manager) => {
      await manager.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))"
      );
      const epochs = await readRecoveryEpochs(manager);
      if (
        epochs.sourceEpoch !== sourceEpoch ||
        epochs.recoveryEpoch !== identity.recoveryEpoch
      )
        throw new Error('Recovery epoch mismatch');
      await manager.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('directory-event-v1:' || $1, 0))",
        [eventId]
      );
      const rows = await manager.query(
        'SELECT "communityId", "eventNonce", "sourceEpoch", "recoveryEpoch" FROM directory_reconciliation_receipt WHERE "eventId"=$1',
        [eventId]
      );
      if (!rows.length) throw new Error('Receipt missing');
      if (
        rows[0].communityId !== communityId ||
        rows[0].eventNonce !== eventNonce ||
        rows[0].sourceEpoch !== sourceEpoch ||
        rows[0].recoveryEpoch !== identity.recoveryEpoch
      )
        throw new Error('Event identity collision');
      const member = await this.membership(
        eventId,
        communityId,
        sourceEpoch,
        eventNonce
      );
      if (
        !member ||
        (member.status !== 'absent' && member.status !== 'pending')
      )
        throw new Error('Invalid membership response');
      if (member.status === 'pending') {
        if (
          member.eventNonce !== eventNonce ||
          member.sourceEpoch !== sourceEpoch
        )
          throw new Error('Event identity collision');
        return 'pending';
      }
      await manager.query(
        'DELETE FROM directory_reconciliation_receipt WHERE "eventId"=$1',
        [eventId]
      );
      return 'retired';
    });
  }

  private async reconcile(
    communityId: string,
    identity?: ReceiptV2Identity
  ): Promise<'applied' | 'retired'> {
    const eventId = identity?.revision;
    return this.db.transaction(async (manager) => {
      if (identity) {
        await manager.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))"
        );
        const epochs = await readRecoveryEpochs(manager);
        if (
          epochs.sourceEpoch !== identity.sourceEpoch ||
          epochs.recoveryEpoch !== identity.recoveryEpoch
        )
          throw new Error('Recovery epoch mismatch');
      }
      // All event operations, including any future receipt retirement, must
      // take this lock before the community lock. Use a distinct input
      // namespace; advisory-lock hash collisions can still serialize work.
      if (eventId)
        await manager.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('directory-event-v1:' || $1, 0))",
          [eventId]
        );
      // Serialize both the authoritative read and the write for this community.
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [communityId]
      );
      if (eventId) {
        const receipt = await manager.query(
          'SELECT "communityId", "eventNonce", "sourceEpoch", "recoveryEpoch" FROM directory_reconciliation_receipt WHERE "eventId" = $1',
          [eventId]
        );
        if (receipt.length) {
          if (
            receipt[0].communityId !== communityId ||
            receipt[0].eventNonce !== identity!.eventNonce ||
            receipt[0].sourceEpoch !== identity!.sourceEpoch ||
            receipt[0].recoveryEpoch !== identity!.recoveryEpoch
          )
            throw new Error('Event identity collision');
          return 'applied';
        }
      }
      const member = eventId
        ? await this.membership(
            eventId,
            communityId,
            identity!.sourceEpoch,
            identity!.eventNonce
          )
        : null;
      if (member && member.status === 'absent') return 'retired';
      if (
        eventId &&
        member?.status === 'pending' &&
        (member.eventNonce !== identity!.eventNonce ||
          member.sourceEpoch !== identity!.sourceEpoch)
      )
        throw new Error('Event identity collision');
      if (
        eventId &&
        (!member || member.status !== 'pending' || !('snapshot' in member))
      )
        throw new Error('Invalid membership response');
      if (eventId) {
        await manager.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('directory-receipt-pool-v1', 0))"
        );
        const slots = await manager.query(
          'SELECT s.id FROM directory_receipt_slot s LEFT JOIN directory_reconciliation_receipt r ON r."slotId"=s.id WHERE r."eventId" IS NULL ORDER BY s.id LIMIT 1'
        );
        if (!slots.length)
          throw new Error('Directory receipt pool at capacity');
        await manager.query(
          'INSERT INTO directory_reconciliation_receipt ("eventId", "communityId", "slotId", "eventNonce", "sourceEpoch", "recoveryEpoch") VALUES ($1,$2,$3,$4,$5,$6)',
          [
            eventId,
            communityId,
            slots[0].id,
            identity!.eventNonce,
            identity!.sourceEpoch,
            identity!.recoveryEpoch,
          ]
        );
      }
      const current =
        member && member.status === 'pending'
          ? member.snapshot
          : await this.readCurrent(communityId);
      if (current && current.id !== communityId)
        throw new Error('Mismatched community identity');
      if (current && isEligibleCommunity(current)) {
        await manager.query(
          `INSERT INTO directory_town ("communityId", name, slug, "administrativeArea", eligible, "geometryStatus")
          VALUES ($1,$2,$3,$4,true,'pending') ON CONFLICT ("communityId") DO UPDATE SET
          name=EXCLUDED.name, slug=EXCLUDED.slug, "administrativeArea"=EXCLUDED."administrativeArea",
          eligible=true, "mergedIntoCommunityId"=NULL, "geometryStatus"=CASE WHEN EXISTS (SELECT 1 FROM directory_boundary_lock l WHERE l."communityId"=directory_town."communityId") THEN directory_town."geometryStatus" ELSE 'pending' END`,
          [communityId, current.name, current.slug, current.adminArea]
        );
        await manager.query(
          `INSERT INTO directory_provider_work ("communityId", status) VALUES ($1,'blocked')
          ON CONFLICT ("communityId") DO UPDATE SET status='blocked', "updatedAt"=CURRENT_TIMESTAMP`,
          [communityId]
        );
      } else {
        await manager.query(
          `UPDATE directory_town SET eligible=false, "geometryStatus"=CASE WHEN EXISTS (SELECT 1 FROM directory_boundary_lock l WHERE l."communityId"=directory_town."communityId") THEN "geometryStatus" ELSE 'pending' END WHERE "communityId"=$1`,
          [communityId]
        );
        await manager.query(
          'DELETE FROM directory_provider_work WHERE "communityId"=$1',
          [communityId]
        );
      }
      return 'applied';
    });
  }
}
