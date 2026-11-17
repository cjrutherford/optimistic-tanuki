import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectoryFoundation1793810630534 implements MigrationInterface {
    name = 'DirectoryFoundation1793810630534'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "directory_installation" ("id" character varying(64) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ad865dc48866598adaf261e8f68" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "directory_installation"`);
    }

}
