import { MigrationInterface, QueryRunner } from "typeorm";

export class CommunitySlug1773361497548 implements MigrationInterface {
    name = 'CommunitySlug1773361497548'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community" ADD "slug" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "community" ADD CONSTRAINT "UQ_198f18552bc2c404cc62bf3b6f6" UNIQUE ("slug")`);
        await queryRunner.query(`ALTER TABLE "community" ADD "localityType" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "community" ADD "countryCode" character varying(3)`);
        await queryRunner.query(`ALTER TABLE "community" ADD "adminArea" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "community" ADD "city" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "community" ADD "lat" numeric(9,6)`);
        await queryRunner.query(`ALTER TABLE "community" ADD "lng" numeric(9,6)`);
        await queryRunner.query(`ALTER TABLE "community" ADD "population" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "population"`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "lng"`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "lat"`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "city"`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "adminArea"`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "countryCode"`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "localityType"`);
        await queryRunner.query(`ALTER TABLE "community" DROP CONSTRAINT "UQ_198f18552bc2c404cc62bf3b6f6"`);
        await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "slug"`);
    }

}
