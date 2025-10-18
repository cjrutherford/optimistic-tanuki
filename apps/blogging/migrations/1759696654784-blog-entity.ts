import { MigrationInterface, QueryRunner } from "typeorm";

export class BlogEntity1759696654784 implements MigrationInterface {
    name = 'BlogEntity1759696654784'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "blog" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "ownerId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_85c6532ad065a448e9de7638571" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "contact" ADD "blogId" uuid`);
        await queryRunner.query(`ALTER TABLE "event" ADD "blogId" uuid`);
        await queryRunner.query(`ALTER TABLE "post" ADD "blogId" uuid`);
        await queryRunner.query(`ALTER TABLE "contact" ADD CONSTRAINT "FK_d99edaae05074f19fd932717beb" FOREIGN KEY ("blogId") REFERENCES "blog"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "event" ADD CONSTRAINT "FK_10fdd44e2357db4e9a662256ce0" FOREIGN KEY ("blogId") REFERENCES "blog"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post" ADD CONSTRAINT "FK_d0418ddc42c5707dbc37b05bef9" FOREIGN KEY ("blogId") REFERENCES "blog"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" DROP CONSTRAINT "FK_d0418ddc42c5707dbc37b05bef9"`);
        await queryRunner.query(`ALTER TABLE "event" DROP CONSTRAINT "FK_10fdd44e2357db4e9a662256ce0"`);
        await queryRunner.query(`ALTER TABLE "contact" DROP CONSTRAINT "FK_d99edaae05074f19fd932717beb"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "blogId"`);
        await queryRunner.query(`ALTER TABLE "event" DROP COLUMN "blogId"`);
        await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "blogId"`);
        await queryRunner.query(`DROP TABLE "blog"`);
    }

}
