import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1774396807253 implements MigrationInterface {
    name = 'Initial1774396807253'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "donations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "profileId" uuid, "amount" numeric(10,2) NOT NULL, "isRecurring" boolean NOT NULL DEFAULT false, "lemonSqueezyOrderId" character varying, "lemonSqueezySubscriptionId" character varying, "status" character varying NOT NULL DEFAULT 'pending', "currency" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "cancelledAt" TIMESTAMP, CONSTRAINT "PK_c01355d6f6f50fc6d1b4a946abf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fe29212b06774a67d6f693662e" ON "donations" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_cfd5edc39019b9001bd86e90f7" ON "donations" ("userId") `);
        await queryRunner.query(`CREATE TABLE "classified_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "classifiedId" uuid NOT NULL, "buyerId" uuid NOT NULL, "sellerId" uuid, "interestedBuyerId" uuid, "amount" numeric(10,2) NOT NULL, "platformFeeAmount" numeric(10,2) NOT NULL, "sellerReceivesAmount" numeric(10,2) NOT NULL, "offerId" uuid, "paymentIntentId" character varying, "paymentMethod" character varying NOT NULL DEFAULT 'card', "status" character varying NOT NULL DEFAULT 'pending', "proofImageUrl" character varying, "disputeReason" text, "LemonSqueezyOrderId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "confirmedAt" TIMESTAMP, "releasedAt" TIMESTAMP, CONSTRAINT "PK_1c0d672c39b9290de2248a162d0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_915364e7c63b446c464604a111" ON "classified_payments" ("interestedBuyerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e0f22c9d24085d55712862965a" ON "classified_payments" ("classifiedId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fcf4b3bab2a5824e3609bb095c" ON "classified_payments" ("sellerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ee0cb3c302733279a221ee4e16" ON "classified_payments" ("buyerId") `);
        await queryRunner.query(`CREATE TABLE "business_pages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "communityId" uuid NOT NULL, "ownerId" uuid NOT NULL, "name" character varying, "description" text, "logoUrl" character varying, "website" character varying, "phone" character varying, "email" character varying, "address" text, "tier" character varying NOT NULL DEFAULT 'basic', "lemonSqueezySubscriptionId" character varying, "subscriptionStatus" character varying NOT NULL DEFAULT 'inactive', "pinnedPostId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "subscriptionExpiresAt" TIMESTAMP, "isCommunity" boolean NOT NULL DEFAULT false, "isFeatured" boolean NOT NULL DEFAULT false, "featuredSpotType" character varying, "customSpotContent" text, "customSpotImageUrl" character varying, "customSpotGradient" character varying, "businessThemeId" uuid, CONSTRAINT "UQ_07785e8f8ca4404767d0855bd7b" UNIQUE ("communityId"), CONSTRAINT "PK_936f2bca8335146029314ab4295" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_872b81d3b1334bc1fedc74ffd8" ON "business_pages" ("ownerId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_07785e8f8ca4404767d0855bd7" ON "business_pages" ("communityId") `);
        await queryRunner.query(`CREATE TABLE "business_themes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessPageId" uuid NOT NULL, "personalityId" character varying, "primaryColor" character varying, "accentColor" character varying, "backgroundColor" character varying, "customCss" text, "customFontFamily" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_660d3d8a8f52a7aa1d6de8d0510" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "community_sponsorships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "communityId" uuid NOT NULL, "businessPageId" uuid, "userId" uuid NOT NULL, "type" character varying NOT NULL, "adContent" text, "amount" numeric(10,2) NOT NULL, "lemonSqueezyOrderId" character varying, "status" character varying NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "startsAt" TIMESTAMP NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "months" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_f1cf8b2a7824ae1baa1c4211428" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c2b2163d45968c12d67dd5233b" ON "community_sponsorships" ("businessPageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a5d9802113479c364684753727" ON "community_sponsorships" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7415760570c120829c72b4f5b8" ON "community_sponsorships" ("communityId") `);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" character varying NOT NULL, "direction" character varying NOT NULL, "amount" numeric(10,2) NOT NULL, "platformFee" numeric(10,2) NOT NULL, "netAmount" numeric(10,2) NOT NULL, "feePercentage" numeric(5,2) NOT NULL DEFAULT '5', "currency" character varying, "referenceId" uuid, "status" character varying NOT NULL DEFAULT 'completed', "description" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e744417ceb0b530285c08f3865" ON "transactions" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_6bb58f2b6e30cb51a6504599f4" ON "transactions" ("userId") `);
        await queryRunner.query(`CREATE TABLE "offers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "classifiedId" uuid NOT NULL, "buyerId" uuid NOT NULL, "sellerId" uuid NOT NULL, "offeredAmount" numeric(10,2) NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "message" text, "counterOfferAmount" numeric(10,2), "counterMessage" text, "expiresAt" TIMESTAMP NOT NULL, "acceptedPaymentId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4c88e956195bba85977da21b8f4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_434239966cb60e2dbc6178f993" ON "offers" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_92de52b4c607bdf9b4f64f4001" ON "offers" ("sellerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_31bca9f7753201479da158d51a" ON "offers" ("buyerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ab67a206c9cfc33206808dea33" ON "offers" ("classifiedId") `);
        await queryRunner.query(`CREATE TABLE "seller_wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sellerId" uuid NOT NULL, "availableBalance" numeric(10,2) NOT NULL DEFAULT '0', "pendingBalance" numeric(10,2) NOT NULL DEFAULT '0', "totalEarned" numeric(10,2) NOT NULL DEFAULT '0', "totalPaidOut" numeric(10,2) NOT NULL DEFAULT '0', "payoutMethod" character varying, "payoutEmail" character varying, "bankAccountLast4" character varying, "bankRoutingLast4" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "lastPayoutAt" TIMESTAMP, CONSTRAINT "UQ_5a3fb26ab29651bced9dab7a445" UNIQUE ("sellerId"), CONSTRAINT "PK_06e3a1ce0f678cc833cb90667ff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5a3fb26ab29651bced9dab7a44" ON "seller_wallets" ("sellerId") `);
        await queryRunner.query(`CREATE TABLE "payout_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sellerId" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "payoutMethod" character varying NOT NULL, "payoutEmail" character varying, "bankAccountLast4" character varying, "bankRoutingLast4" character varying, "transactionId" character varying, "rejectionReason" text, "processedBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "processedAt" TIMESTAMP, CONSTRAINT "PK_3a6acb302f56ad7dadda35c86b8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b37667129241edaa0b214cf439" ON "payout_requests" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_b44f529526989bf04785a6e310" ON "payout_requests" ("sellerId") `);
        await queryRunner.query(`CREATE TABLE "lemon_squeezy_products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "appScope" character varying NOT NULL, "tier" character varying NOT NULL, "lemonSqueezyProductId" character varying NOT NULL, "lemonSqueezyVariantId" character varying, "name" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_676048da91b1516260ab33ade8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e34aca5b27dcfa68780034901c" ON "lemon_squeezy_products" ("lemonSqueezyProductId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_36ddcb5b1323403a4d7637b062" ON "lemon_squeezy_products" ("appScope", "tier") `);
        await queryRunner.query(`ALTER TABLE "business_themes" ADD CONSTRAINT "FK_bb4faefcea416c92611f911e362" FOREIGN KEY ("businessPageId") REFERENCES "business_pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "business_themes" DROP CONSTRAINT "FK_bb4faefcea416c92611f911e362"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_36ddcb5b1323403a4d7637b062"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e34aca5b27dcfa68780034901c"`);
        await queryRunner.query(`DROP TABLE "lemon_squeezy_products"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b44f529526989bf04785a6e310"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b37667129241edaa0b214cf439"`);
        await queryRunner.query(`DROP TABLE "payout_requests"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5a3fb26ab29651bced9dab7a44"`);
        await queryRunner.query(`DROP TABLE "seller_wallets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ab67a206c9cfc33206808dea33"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_31bca9f7753201479da158d51a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_92de52b4c607bdf9b4f64f4001"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_434239966cb60e2dbc6178f993"`);
        await queryRunner.query(`DROP TABLE "offers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6bb58f2b6e30cb51a6504599f4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e744417ceb0b530285c08f3865"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7415760570c120829c72b4f5b8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a5d9802113479c364684753727"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c2b2163d45968c12d67dd5233b"`);
        await queryRunner.query(`DROP TABLE "community_sponsorships"`);
        await queryRunner.query(`DROP TABLE "business_themes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_07785e8f8ca4404767d0855bd7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_872b81d3b1334bc1fedc74ffd8"`);
        await queryRunner.query(`DROP TABLE "business_pages"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ee0cb3c302733279a221ee4e16"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fcf4b3bab2a5824e3609bb095c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e0f22c9d24085d55712862965a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_915364e7c63b446c464604a111"`);
        await queryRunner.query(`DROP TABLE "classified_payments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cfd5edc39019b9001bd86e90f7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe29212b06774a67d6f693662e"`);
        await queryRunner.query(`DROP TABLE "donations"`);
    }

}
