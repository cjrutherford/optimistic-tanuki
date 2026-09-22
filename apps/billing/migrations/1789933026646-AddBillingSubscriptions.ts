import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingSubscriptions1789933026646
  implements MigrationInterface
{
  name = 'AddBillingSubscriptions1789933026646';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "billing_subscription_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'billing', "accountId" uuid NOT NULL, "planId" character varying NOT NULL, "priceId" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'trialing', "currentPeriodStart" TIMESTAMP, "currentPeriodEnd" TIMESTAMP, "canceledAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_20190fa9585e0d0dd5e80788d9a" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "store_product_plan_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" uuid NOT NULL, "planId" character varying NOT NULL, "priceId" character varying NOT NULL, "amountCents" integer NOT NULL, "interval" character varying(20) NOT NULL DEFAULT 'month', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_202ab23fccd055bd91baafec9a2" UNIQUE ("productId"), CONSTRAINT "PK_b1334bbed33071338aae97c7ae8" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "store_product_plan_entity"`);
    await queryRunner.query(`DROP TABLE "billing_subscription_entity"`);
  }
}
