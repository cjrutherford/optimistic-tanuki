import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityEmailInvites1790348956751
  implements MigrationInterface
{
  name = 'AddCommunityEmailInvites1790348956751';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_invite" ADD "inviteeEmail" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" ADD "token" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" ADD CONSTRAINT "UQ_ea0f4086489e57e582ac5f24d87" UNIQUE ("token")`
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" ADD "expiresAt" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" DROP CONSTRAINT "UQ_780999b15c262cee88a617de1b7"`
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" ALTER COLUMN "inviteeId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" ADD CONSTRAINT "UQ_780999b15c262cee88a617de1b7" UNIQUE ("communityId", "inviteeId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community_invite" DROP CONSTRAINT "UQ_780999b15c262cee88a617de1b7"`
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" ALTER COLUMN "inviteeId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" ADD CONSTRAINT "UQ_780999b15c262cee88a617de1b7" UNIQUE ("communityId", "inviteeId")`
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" DROP COLUMN "expiresAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" DROP CONSTRAINT "UQ_ea0f4086489e57e582ac5f24d87"`
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" DROP COLUMN "token"`
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" DROP COLUMN "inviteeEmail"`
    );
  }
}
