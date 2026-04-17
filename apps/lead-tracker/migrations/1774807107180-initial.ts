import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1774807107180 implements MigrationInterface {
    name = 'Initial1774807107180'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."lead_flags_reasons_enum" AS ENUM('irrelevant', 'duplicate', 'bad_contact_info', 'wrong_industry', 'spam', 'not_decision_maker', 'company_too_small', 'company_too_large', 'other')`);
        await queryRunner.query(`CREATE TABLE "lead_flags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "leadId" uuid NOT NULL, "reasons" "public"."lead_flags_reasons_enum" array NOT NULL, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6fdc1b208c0fc16e4ed36748989" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."leads_source_enum" AS ENUM('upwork', 'linkedin', 'referral', 'cold', 'local', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."leads_status_enum" AS ENUM('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')`);
        await queryRunner.query(`CREATE TABLE "leads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "company" character varying, "email" character varying, "phone" character varying, "source" "public"."leads_source_enum" NOT NULL, "status" "public"."leads_status_enum" NOT NULL DEFAULT 'new', "value" numeric(10,2) NOT NULL DEFAULT '0', "notes" text NOT NULL DEFAULT '', "nextFollowUp" date, "isAutoDiscovered" boolean NOT NULL DEFAULT false, "searchKeywords" text, "assignedTo" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cd102ed7a9a4ca7d4d8bfeba406" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "lead_topics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text NOT NULL DEFAULT '', "keywords" text array NOT NULL DEFAULT '{}', "enabled" boolean NOT NULL DEFAULT true, "lastRun" TIMESTAMP, "leadCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6796718b143bd41eb0df9aa3d9a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "lead_flags" ADD CONSTRAINT "FK_64d0a574aaac669556b6210566e" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lead_flags" DROP CONSTRAINT "FK_64d0a574aaac669556b6210566e"`);
        await queryRunner.query(`DROP TABLE "lead_topics"`);
        await queryRunner.query(`DROP TABLE "leads"`);
        await queryRunner.query(`DROP TYPE "public"."leads_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."leads_source_enum"`);
        await queryRunner.query(`DROP TABLE "lead_flags"`);
        await queryRunner.query(`DROP TYPE "public"."lead_flags_reasons_enum"`);
    }

}
