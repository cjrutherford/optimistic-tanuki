import { MigrationInterface, QueryRunner } from "typeorm";

export class Advanced1772574255443 implements MigrationInterface {
    name = 'Advanced1772574255443'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "poll" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "question" character varying NOT NULL, "options" text NOT NULL, "votes" text, "isMultipleChoice" boolean NOT NULL DEFAULT false, "endsAt" TIMESTAMP, "showResultsBeforeVote" boolean NOT NULL DEFAULT true, "isAnonymous" boolean NOT NULL DEFAULT false, "profileId" character varying NOT NULL, "userId" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_03b5cf19a7f562b231c3458527e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."activity_type_enum" AS ENUM('post', 'comment', 'like', 'share', 'follow', 'mention')`);
        await queryRunner.query(`CREATE TABLE "activity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profileId" character varying NOT NULL, "type" "public"."activity_type_enum" NOT NULL, "description" character varying NOT NULL, "resourceId" character varying, "resourceType" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_24625a1d6b1b089c8ae206fe467" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dca8e368c8036ec68982af9bad" ON "activity" ("profileId", "createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."saved_item_itemtype_enum" AS ENUM('post', 'comment')`);
        await queryRunner.query(`CREATE TABLE "saved_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profileId" character varying NOT NULL, "itemType" "public"."saved_item_itemtype_enum" NOT NULL, "itemId" character varying NOT NULL, "itemTitle" character varying, "savedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ab7d7bc4b190d619ea11562f04a" UNIQUE ("profileId", "itemType", "itemId"), CONSTRAINT "PK_caa9a4e273f8940a00dc3eb713f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_block" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "blockerId" character varying NOT NULL, "blockedId" character varying NOT NULL, "reason" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d6b2a9c90a8c5f0997c6548c725" UNIQUE ("blockerId", "blockedId"), CONSTRAINT "PK_4ccc8015091b2f9054ce0e40db5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_mute" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "muterId" character varying NOT NULL, "mutedId" character varying NOT NULL, "duration" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d3ac2d990086814549e498445b4" UNIQUE ("muterId", "mutedId"), CONSTRAINT "PK_d88bf605daee4889286a8048351" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."user_presence_status_enum" AS ENUM('online', 'offline', 'away', 'busy')`);
        await queryRunner.query(`CREATE TABLE "user_presence" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "status" "public"."user_presence_status_enum" NOT NULL DEFAULT 'offline', "lastSeen" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "isExplicit" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_b06e00b58bf86a3772b1251ac02" UNIQUE ("userId"), CONSTRAINT "PK_562d693ca2ee27d96b75ff78eda" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b06e00b58bf86a3772b1251ac0" ON "user_presence" ("userId") `);
        await queryRunner.query(`CREATE TABLE "profile_view" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profileId" character varying NOT NULL, "viewerId" character varying NOT NULL, "source" character varying NOT NULL, "viewedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a333641775d7d72e678b84046a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ceb630c1ee379f10c94ebf9178" ON "profile_view" ("profileId", "viewedAt") `);
        await queryRunner.query(`CREATE TYPE "public"."content_report_reason_enum" AS ENUM('spam', 'harassment', 'hate_speech', 'violence', 'misinformation', 'inappropriate', 'other')`);
        await queryRunner.query(`CREATE TABLE "content_report" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reporterId" character varying NOT NULL, "contentType" character varying NOT NULL, "contentId" character varying NOT NULL, "reason" "public"."content_report_reason_enum" NOT NULL, "description" character varying, "status" character varying NOT NULL DEFAULT 'pending', "adminNotes" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1effd709157e94e02959826f51e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."search_history_searchtype_enum" AS ENUM('all', 'users', 'posts', 'communities')`);
        await queryRunner.query(`CREATE TABLE "search_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profileId" character varying NOT NULL, "query" character varying NOT NULL, "searchType" "public"."search_history_searchtype_enum" NOT NULL DEFAULT 'all', "resultCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cb93c8f85dbdca85943ca494812" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_53debe423b26554a3df7349128" ON "search_history" ("profileId", "query") `);
        await queryRunner.query(`CREATE TYPE "public"."chat_message_type_enum" AS ENUM('chat', 'info', 'warning', 'system')`);
        await queryRunner.query(`CREATE TABLE "chat_message" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" character varying NOT NULL, "senderId" character varying NOT NULL, "content" text NOT NULL, "reactions" text, "isEdited" boolean NOT NULL DEFAULT false, "isDeleted" boolean NOT NULL DEFAULT false, "readBy" text, "type" "public"."chat_message_type_enum" NOT NULL DEFAULT 'chat', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3cc0d85193aade457d3077dd06b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."event_privacy_enum" AS ENUM('public', 'private', 'community')`);
        await queryRunner.query(`CREATE TYPE "public"."event_status_enum" AS ENUM('draft', 'published', 'cancelled', 'completed')`);
        await queryRunner.query(`CREATE TABLE "event" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text, "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP, "location" character varying, "locationUrl" character varying, "privacy" "public"."event_privacy_enum" NOT NULL DEFAULT 'public', "communityId" character varying, "profileId" character varying NOT NULL, "userId" character varying NOT NULL, "status" "public"."event_status_enum" NOT NULL DEFAULT 'draft', "attendeeCount" integer NOT NULL DEFAULT '0', "attendeeIds" text, "coverImageUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_30c2f3bbaf6d34a55f8ae6e4614" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "post_share" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "originalPostId" character varying NOT NULL, "sharedById" character varying NOT NULL, "comment" character varying, "visibility" character varying NOT NULL DEFAULT 'public', "communityId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_77619741bae0a19103e9af87f46" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "post" ADD "scheduledAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "post" ADD "isScheduled" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "isScheduled"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "scheduledAt"`);
        await queryRunner.query(`DROP TABLE "post_share"`);
        await queryRunner.query(`DROP TABLE "event"`);
        await queryRunner.query(`DROP TYPE "public"."event_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."event_privacy_enum"`);
        await queryRunner.query(`DROP TABLE "chat_message"`);
        await queryRunner.query(`DROP TYPE "public"."chat_message_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_53debe423b26554a3df7349128"`);
        await queryRunner.query(`DROP TABLE "search_history"`);
        await queryRunner.query(`DROP TYPE "public"."search_history_searchtype_enum"`);
        await queryRunner.query(`DROP TABLE "content_report"`);
        await queryRunner.query(`DROP TYPE "public"."content_report_reason_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ceb630c1ee379f10c94ebf9178"`);
        await queryRunner.query(`DROP TABLE "profile_view"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b06e00b58bf86a3772b1251ac0"`);
        await queryRunner.query(`DROP TABLE "user_presence"`);
        await queryRunner.query(`DROP TYPE "public"."user_presence_status_enum"`);
        await queryRunner.query(`DROP TABLE "user_mute"`);
        await queryRunner.query(`DROP TABLE "user_block"`);
        await queryRunner.query(`DROP TABLE "saved_item"`);
        await queryRunner.query(`DROP TYPE "public"."saved_item_itemtype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dca8e368c8036ec68982af9bad"`);
        await queryRunner.query(`DROP TABLE "activity"`);
        await queryRunner.query(`DROP TYPE "public"."activity_type_enum"`);
        await queryRunner.query(`DROP TABLE "poll"`);
    }

}
