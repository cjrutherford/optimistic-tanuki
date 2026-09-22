import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O14 cutover: drop `store.donations`.
 *
 * Preconditions (all verified): callers migrated (store-client/video-client
 * → POST /api/payments/donations; owner-console reads → GET /api/donations),
 * gateway shims removed, every row carries a `paymentDonationId` backref, and
 * presentation fields (`message`) were backfilled onto the canonical payments
 * rows with NULL-guarded UPDATEs before this drop. No unreferenced rows may
 * exist — enforced below by failing if any row lacks a backref.
 */
export class DropStoreDonationsTable1789996488389
  implements MigrationInterface
{
  name = 'DropStoreDonationsTable1789996488389';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const orphans: Array<{ count: string }> = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM "donations" WHERE "paymentDonationId" IS NULL`
    );
    if (Number(orphans[0]?.count ?? 0) > 0) {
      throw new Error(
        `Refusing to drop store.donations with ${orphans[0].count} unreferenced rows`
      );
    }
    await queryRunner.query(`DROP TABLE "donations"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "donations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "currency" character varying(3) NOT NULL DEFAULT 'USD', "message" text, "anonymous" boolean NOT NULL DEFAULT false, "status" character varying(50) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "amountCents" integer NOT NULL, "paymentDonationId" uuid, CONSTRAINT "PK_c01355d6f6f50fc6d1b4a946abf" PRIMARY KEY ("id"))`
    );
  }
}
