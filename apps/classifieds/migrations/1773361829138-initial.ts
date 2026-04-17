import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1773361829138 implements MigrationInterface {
    name = 'Initial1773361829138'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "classified_ad" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "description" text NOT NULL, "price" numeric(10,2) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'USD', "category" character varying(100), "condition" character varying(50), "imageUrls" text, "status" character varying(50) NOT NULL DEFAULT 'active', "communityId" uuid, "profileId" uuid NOT NULL, "userId" uuid NOT NULL, "appScope" character varying(100) NOT NULL DEFAULT 'local-hub', "isFeatured" boolean NOT NULL DEFAULT false, "featuredUntil" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_7c46badbfa2ce89d3be1e1fb24e" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "classified_ad"`);
    }

}
