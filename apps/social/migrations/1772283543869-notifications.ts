import { MigrationInterface, QueryRunner } from "typeorm";

export class Notifications1772283543869 implements MigrationInterface {
    name = 'Notifications1772283543869'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notification_type_enum" AS ENUM('like', 'comment', 'follow', 'mention', 'message', 'community_invite', 'system')`);
        await queryRunner.query(`CREATE TABLE "notification" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "recipientId" character varying NOT NULL, "type" "public"."notification_type_enum" NOT NULL, "title" character varying NOT NULL, "body" character varying NOT NULL, "senderId" character varying, "resourceType" character varying, "resourceId" character varying, "isRead" boolean NOT NULL DEFAULT false, "actionUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "notification"`);
        await queryRunner.query(`DROP TYPE "public"."notification_type_enum"`);
    }

}
