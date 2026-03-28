import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppScope1775000000000 implements MigrationInterface {
    name = 'AddAppScope1775000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "donations" ADD "appScope" character varying`
        );
        await queryRunner.query(
            `UPDATE "donations" SET "appScope" = 'local-hub' WHERE "appScope" IS NULL`
        );
        await queryRunner.query(
            `ALTER TABLE "donations" ALTER COLUMN "appScope" SET NOT NULL`
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_4ae6206c365fbec20854b616f7" ON "donations" ("appScope") `
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_1f934ab8d3865e16fa4e8704a0" ON "donations" ("appScope", "userId") `
        );

        await queryRunner.query(
            `ALTER TABLE "classified_payments" ADD "appScope" character varying`
        );
        await queryRunner.query(
            `UPDATE "classified_payments" SET "appScope" = 'local-hub' WHERE "appScope" IS NULL`
        );
        await queryRunner.query(
            `ALTER TABLE "classified_payments" ALTER COLUMN "appScope" SET NOT NULL`
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_a4ba13e1b4d006019d5986ca84" ON "classified_payments" ("appScope") `
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_0f468e39f21bc74d51e3d4798d" ON "classified_payments" ("appScope", "buyerId") `
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_d8d7e6298d35f19f18b62059ff" ON "classified_payments" ("appScope", "sellerId") `
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_8a542fd3cda7e433114ff36db4" ON "classified_payments" ("appScope", "classifiedId") `
        );

        await queryRunner.query(
            `ALTER TABLE "business_pages" ADD "appScope" character varying`
        );
        await queryRunner.query(
            `UPDATE "business_pages" SET "appScope" = 'local-hub' WHERE "appScope" IS NULL`
        );
        await queryRunner.query(
            `ALTER TABLE "business_pages" ALTER COLUMN "appScope" SET NOT NULL`
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_07785e8f8ca4404767d0855bd7"`
        );
        await queryRunner.query(
            `ALTER TABLE "business_pages" DROP CONSTRAINT "UQ_07785e8f8ca4404767d0855bd7b"`
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_9a95c3d3cc4f18d4dc0f4f91fd" ON "business_pages" ("appScope") `
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_7088f387c1c22aeb2ef6f07a27" ON "business_pages" ("appScope", "communityId") `
        );

        await queryRunner.query(
            `ALTER TABLE "community_sponsorships" ADD "appScope" character varying`
        );
        await queryRunner.query(
            `UPDATE "community_sponsorships" SET "appScope" = 'local-hub' WHERE "appScope" IS NULL`
        );
        await queryRunner.query(
            `ALTER TABLE "community_sponsorships" ALTER COLUMN "appScope" SET NOT NULL`
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_147cf91b95ff37388f8c2a8be6" ON "community_sponsorships" ("appScope") `
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_85159a12c5fe1a659d727ab9e8" ON "community_sponsorships" ("appScope", "communityId") `
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_a1218457fbd9f8e36c40f38f3c" ON "community_sponsorships" ("appScope", "userId") `
        );

        await queryRunner.query(
            `ALTER TABLE "transactions" ADD "appScope" character varying`
        );
        await queryRunner.query(
            `UPDATE "transactions" SET "appScope" = 'local-hub' WHERE "appScope" IS NULL`
        );
        await queryRunner.query(
            `ALTER TABLE "transactions" ALTER COLUMN "appScope" SET NOT NULL`
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_1e9fd9cb16ed4ba6ba0ef84f36" ON "transactions" ("appScope") `
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_2d1772bf0df499dab9d69c1490" ON "transactions" ("appScope", "userId") `
        );

        await queryRunner.query(
            `ALTER TABLE "seller_wallets" ADD "appScope" character varying`
        );
        await queryRunner.query(
            `UPDATE "seller_wallets" SET "appScope" = 'local-hub' WHERE "appScope" IS NULL`
        );
        await queryRunner.query(
            `ALTER TABLE "seller_wallets" ALTER COLUMN "appScope" SET NOT NULL`
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_5a3fb26ab29651bced9dab7a44"`
        );
        await queryRunner.query(
            `ALTER TABLE "seller_wallets" DROP CONSTRAINT "UQ_5a3fb26ab29651bced9dab7a445"`
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_2c253775ffaf7f637eb2d6e9bf" ON "seller_wallets" ("appScope", "sellerId") `
        );

        await queryRunner.query(
            `ALTER TABLE "payout_requests" ADD "appScope" character varying`
        );
        await queryRunner.query(
            `UPDATE "payout_requests" SET "appScope" = 'local-hub' WHERE "appScope" IS NULL`
        );
        await queryRunner.query(
            `ALTER TABLE "payout_requests" ALTER COLUMN "appScope" SET NOT NULL`
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_eb26d46a9b1aefce3f07bb669d" ON "payout_requests" ("appScope") `
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_e83fc7a97a74d6def595db152e" ON "payout_requests" ("appScope", "sellerId") `
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP INDEX "public"."IDX_e83fc7a97a74d6def595db152e"`
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_eb26d46a9b1aefce3f07bb669d"`
        );
        await queryRunner.query(
            `ALTER TABLE "payout_requests" DROP COLUMN "appScope"`
        );

        await queryRunner.query(
            `DROP INDEX "public"."IDX_2c253775ffaf7f637eb2d6e9bf"`
        );
        await queryRunner.query(
            `ALTER TABLE "seller_wallets" ADD CONSTRAINT "UQ_5a3fb26ab29651bced9dab7a445" UNIQUE ("sellerId")`
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_5a3fb26ab29651bced9dab7a44" ON "seller_wallets" ("sellerId") `
        );
        await queryRunner.query(
            `ALTER TABLE "seller_wallets" DROP COLUMN "appScope"`
        );

        await queryRunner.query(
            `DROP INDEX "public"."IDX_2d1772bf0df499dab9d69c1490"`
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_1e9fd9cb16ed4ba6ba0ef84f36"`
        );
        await queryRunner.query(
            `ALTER TABLE "transactions" DROP COLUMN "appScope"`
        );

        await queryRunner.query(
            `DROP INDEX "public"."IDX_a1218457fbd9f8e36c40f38f3c"`
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_85159a12c5fe1a659d727ab9e8"`
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_147cf91b95ff37388f8c2a8be6"`
        );
        await queryRunner.query(
            `ALTER TABLE "community_sponsorships" DROP COLUMN "appScope"`
        );

        await queryRunner.query(
            `DROP INDEX "public"."IDX_7088f387c1c22aeb2ef6f07a27"`
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_9a95c3d3cc4f18d4dc0f4f91fd"`
        );
        await queryRunner.query(
            `ALTER TABLE "business_pages" ADD CONSTRAINT "UQ_07785e8f8ca4404767d0855bd7b" UNIQUE ("communityId")`
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_07785e8f8ca4404767d0855bd7" ON "business_pages" ("communityId") `
        );
        await queryRunner.query(
            `ALTER TABLE "business_pages" DROP COLUMN "appScope"`
        );

        await queryRunner.query(
            `DROP INDEX "public"."IDX_8a542fd3cda7e433114ff36db4"`
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_d8d7e6298d35f19f18b62059ff"`
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_0f468e39f21bc74d51e3d4798d"`
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_a4ba13e1b4d006019d5986ca84"`
        );
        await queryRunner.query(
            `ALTER TABLE "classified_payments" DROP COLUMN "appScope"`
        );

        await queryRunner.query(
            `DROP INDEX "public"."IDX_1f934ab8d3865e16fa4e8704a0"`
        );
        await queryRunner.query(
            `DROP INDEX "public"."IDX_4ae6206c365fbec20854b616f7"`
        );
        await queryRunner.query(
            `ALTER TABLE "donations" DROP COLUMN "appScope"`
        );
    }
}