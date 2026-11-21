import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityDirectoryRegister1793903477715
  implements MigrationInterface
{
  name = 'CommunityDirectoryRegister1793903477715';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "community_directory_register" ("communityId" uuid NOT NULL, "changeToken" uuid NOT NULL, "operation" character varying(16) NOT NULL, "dirty" boolean NOT NULL DEFAULT true, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6f197029f17f9a91f2b622e274c" PRIMARY KEY ("communityId"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "community_directory_register"`);
  }
}
