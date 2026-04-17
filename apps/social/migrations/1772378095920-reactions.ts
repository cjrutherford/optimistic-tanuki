import { MigrationInterface, QueryRunner } from "typeorm";

export class Reactions1772378095920 implements MigrationInterface {
    name = 'Reactions1772378095920'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "reaction" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "value" integer NOT NULL, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'social', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "postId" uuid, "commentId" uuid, CONSTRAINT "PK_41fbb346da22da4df129f14b11e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "reaction" ADD CONSTRAINT "FK_dc3aeb83dc815f9f22ebfa7785f" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reaction" ADD CONSTRAINT "FK_4584f851fc6471f517d9dad8966" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_4584f851fc6471f517d9dad8966"`);
        await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_dc3aeb83dc815f9f22ebfa7785f"`);
        await queryRunner.query(`DROP TABLE "reaction"`);
    }

}
