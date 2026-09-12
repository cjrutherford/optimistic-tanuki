import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityMembershipAudit1787511616787
  implements MigrationInterface
{
  name = 'AddCommunityMembershipAudit1787511616787';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "community_membership_audit" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" character varying NOT NULL, "subjectId" character varying NOT NULL, "actorId" character varying NOT NULL, "actor" character varying NOT NULL, "action" character varying NOT NULL, "from" character varying NOT NULL, "to" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d1220f2286648befd940f349aa6" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5a4a7118a4155726fdae3fc84d" ON "community_membership_audit" ("workspaceId", "subjectId", "createdAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5a4a7118a4155726fdae3fc84d"`
    );
    await queryRunner.query(`DROP TABLE "community_membership_audit"`);
  }
}
