import { MigrationInterface, QueryRunner } from "typeorm";

export class CommunityBanner1771889243002 implements MigrationInterface {
    name = 'CommunityBanner1771889243002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "social_components" DROP CONSTRAINT "FK_social_components_postId"`);
        await queryRunner.query(`ALTER TABLE "community_member" DROP CONSTRAINT "community_member_communityId_fkey"`);
        await queryRunner.query(`ALTER TABLE "community_invite" DROP CONSTRAINT "FK_community_invite_community"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_social_components_post_instance"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_communityId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_community_member_userId"`);
        await queryRunner.query(`ALTER TABLE "community_member" DROP CONSTRAINT "community_member_communityId_userId_key"`);
        await queryRunner.query(`ALTER TABLE "community_invite" DROP CONSTRAINT "community_invite_communityId_inviteeId_key"`);
        await queryRunner.query(`ALTER TABLE "community" ADD "bannerAssetId" character varying`);
        await queryRunner.query(`ALTER TABLE "community" ADD "logoAssetId" character varying`);
        await queryRunner.query(`ALTER TABLE "community" ADD "chatRoomId" character varying`);
        await queryRunner.query(`ALTER TABLE "community_invite" DROP COLUMN "communityId"`);
        await queryRunner.query(`ALTER TABLE "community_invite" ADD "communityId" character varying NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a04bc32b2660bdd51ce2763d54" ON "social_components" ("postId", "instanceId") `);
        await queryRunner.query(`ALTER TABLE "community_member" ADD CONSTRAINT "UQ_48777696f39fa15d444ab3bb435" UNIQUE ("communityId", "userId")`);
        await queryRunner.query(`ALTER TABLE "community_invite" ADD CONSTRAINT "UQ_780999b15c262cee88a617de1b7" UNIQUE ("communityId", "inviteeId")`);
        await queryRunner.query(`ALTER TABLE "social_components" ADD CONSTRAINT "FK_872089fc2c33ee26ff66c220552" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_member" ADD CONSTRAINT "FK_2951a66589069ef105a6784b494" FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community_member" DROP CONSTRAINT "FK_2951a66589069ef105a6784b494"`);
        await queryRunner.query(`ALTER TABLE "social_components" DROP CONSTRAINT "FK_872089fc2c33ee26ff66c220552"`);
        await queryRunner.query(`ALTER TABLE "community_invite" DROP CONSTRAINT "UQ_780999b15c262cee88a617de1b7"`);
        await queryRunner.query(`ALTER TABLE "community_member" DROP CONSTRAINT "UQ_48777696f39fa15d444ab3bb435"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a04bc32b2660bdd51ce2763d54"`);
        await queryRunner.query(`ALTER TABLE "community_invite" DROP COLUMN "communityId"`);
        await queryRunner.query(`ALTER TABLE "community_invite" ADD "communityId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "chatRoomId"`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "logoAssetId"`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "bannerAssetId"`);
        await queryRunner.query(`ALTER TABLE "community_invite" ADD CONSTRAINT "community_invite_communityId_inviteeId_key" UNIQUE ("communityId", "inviteeId")`);
        await queryRunner.query(`ALTER TABLE "community_member" ADD CONSTRAINT "community_member_communityId_userId_key" UNIQUE ("communityId", "userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_community_member_userId" ON "community_member" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_post_communityId" ON "post" ("communityId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_social_components_post_instance" ON "social_components" ("instanceId", "postId") `);
        await queryRunner.query(`ALTER TABLE "community_invite" ADD CONSTRAINT "FK_community_invite_community" FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_member" ADD CONSTRAINT "community_member_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "community"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "social_components" ADD CONSTRAINT "FK_social_components_postId" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
