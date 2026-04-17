import { MigrationInterface, QueryRunner } from 'typeorm';

export class Communities1771700000000 implements MigrationInterface {
    name = 'Communities1771700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create community table
        await queryRunner.query(`
            CREATE TABLE "community" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" character varying NOT NULL UNIQUE,
                "description" text NOT NULL DEFAULT '',
                "ownerId" character varying NOT NULL,
                "ownerProfileId" character varying NOT NULL,
                "appScope" character varying NOT NULL DEFAULT 'social',
                "isPrivate" boolean NOT NULL DEFAULT false,
                "joinPolicy" character varying NOT NULL DEFAULT 'public',
                "tags" jsonb NOT NULL DEFAULT '[]',
                "memberCount" integer NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        // Create community_member table
        await queryRunner.query(`
            CREATE TABLE "community_member" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "communityId" uuid NOT NULL REFERENCES "community"("id") ON DELETE CASCADE,
                "userId" character varying NOT NULL,
                "profileId" character varying NOT NULL,
                "role" character varying NOT NULL DEFAULT 'member',
                "status" character varying NOT NULL DEFAULT 'approved',
                "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE("communityId", "userId")
            )
        `);

        // Create community_invite table
        await queryRunner.query(`
            CREATE TABLE "community_invite" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "communityId" uuid NOT NULL,
                "inviterId" character varying NOT NULL,
                "inviteeId" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'pending',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                UNIQUE("communityId", "inviteeId")
            )
        `);

        // Add foreign key for community_invite.communityId
        await queryRunner.query(`
            ALTER TABLE "community_invite" 
            ADD CONSTRAINT "FK_community_invite_community" 
            FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE CASCADE
        `);

        // Add communityId to post table
        await queryRunner.query(`
            ALTER TABLE "post" ADD "communityId" uuid
        `);

        // Add index for community posts
        await queryRunner.query(`
            CREATE INDEX "IDX_post_communityId" ON "post" ("communityId")
        `);

        // Add index for community members
        await queryRunner.query(`
            CREATE INDEX "IDX_community_member_userId" ON "community_member" ("userId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove communityId from post
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "communityId"`);

        // Drop community_invite table
        await queryRunner.query(`DROP TABLE "community_invite"`);

        // Drop community_member table
        await queryRunner.query(`DROP TABLE "community_member"`);

        // Drop community table
        await queryRunner.query(`DROP TABLE "community"`);
    }
}
