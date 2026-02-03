import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1737000000000 implements MigrationInterface {
    name = 'Initial1737000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "account" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" character varying NOT NULL, "balance" numeric(15,2) NOT NULL DEFAULT '0', "currency" character varying NOT NULL, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, "description" text, CONSTRAINT "PK_54115ee388cdb6d86bb4bf5b2ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "transaction" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "amount" numeric(15,2) NOT NULL, "type" character varying NOT NULL, "category" character varying NOT NULL, "description" text, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "accountId" character varying NOT NULL, "transactionDate" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "reference" character varying, "isRecurring" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_89eadb93a89810556e1cbcd6ab9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "inventory_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "quantity" integer NOT NULL DEFAULT '0', "unitValue" numeric(15,2) NOT NULL DEFAULT '0', "totalValue" numeric(15,2) NOT NULL DEFAULT '0', "category" character varying NOT NULL, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "sku" character varying, "location" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_a1e8b0c0c18e4f4d8e0f4c0e1d5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "budget" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "category" character varying NOT NULL, "limit" numeric(15,2) NOT NULL, "spent" numeric(15,2) NOT NULL DEFAULT '0', "period" character varying NOT NULL, "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP NOT NULL, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, "alertOnExceed" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_9af87bcfd2de21bd9630dddaa0e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD CONSTRAINT "FK_3d6e89b14baa44a71870450d14d" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" DROP CONSTRAINT "FK_3d6e89b14baa44a71870450d14d"`);
        await queryRunner.query(`DROP TABLE "budget"`);
        await queryRunner.query(`DROP TABLE "inventory_item"`);
        await queryRunner.query(`DROP TABLE "transaction"`);
        await queryRunner.query(`DROP TABLE "account"`);
    }

}
