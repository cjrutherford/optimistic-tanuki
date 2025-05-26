import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1729455565251 implements MigrationInterface {
    name = 'Initial1729455565251'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tokenData" text NOT NULL, "revoked" boolean NOT NULL DEFAULT false, "userId" uuid, CONSTRAINT "PK_82fae97f905930df5d62a702fc9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "password" character varying NOT NULL, "bio" text NOT NULL, "keyDataId" uuid, CONSTRAINT "REL_7dacf0369b6ec1b52d24ecc9aa" UNIQUE ("keyDataId"), CONSTRAINT "PK_b54f8ea623b17094db7667d8206" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "key_datum" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "public" bytea NOT NULL, "salt" character varying NOT NULL, "userId" uuid, CONSTRAINT "REL_7777c4399b78030453438faf05" UNIQUE ("userId"), CONSTRAINT "PK_f02a4571b1bf301fa82d1c9a664" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "token" ADD CONSTRAINT "FK_94f168faad896c0786646fa3d4a" FOREIGN KEY ("userId") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_entity" ADD CONSTRAINT "FK_7dacf0369b6ec1b52d24ecc9aa9" FOREIGN KEY ("keyDataId") REFERENCES "key_datum"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "key_datum" ADD CONSTRAINT "FK_7777c4399b78030453438faf058" FOREIGN KEY ("userId") REFERENCES "user_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "key_datum" DROP CONSTRAINT "FK_7777c4399b78030453438faf058"`);
        await queryRunner.query(`ALTER TABLE "user_entity" DROP CONSTRAINT "FK_7dacf0369b6ec1b52d24ecc9aa9"`);
        await queryRunner.query(`ALTER TABLE "token" DROP CONSTRAINT "FK_94f168faad896c0786646fa3d4a"`);
        await queryRunner.query(`DROP TABLE "key_datum"`);
        await queryRunner.query(`DROP TABLE "user_entity"`);
        await queryRunner.query(`DROP TABLE "token"`);
    }

}
