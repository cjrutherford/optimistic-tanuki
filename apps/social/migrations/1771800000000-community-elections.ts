import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityElections1771800000000 implements MigrationInterface {
  name = 'CommunityElections1771800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "community" ADD COLUMN "managerId" uuid;
      ALTER TABLE "community" ADD COLUMN "managerProfileId" uuid;
    `);

    await queryRunner.query(`
      CREATE TABLE "community_election" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "communityId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "startedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "endsAt" TIMESTAMP,
        "winnerId" uuid,
        "winnerProfileId" uuid,
        "initiatedBy" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "election_candidate" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "electionId" uuid NOT NULL REFERENCES "community_election"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL,
        "profileId" uuid NOT NULL,
        "voteCount" integer NOT NULL DEFAULT 0,
        "isWithdrawn" boolean NOT NULL DEFAULT false,
        "nominatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "election_vote" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "electionId" uuid NOT NULL REFERENCES "community_election"("id") ON DELETE CASCADE,
        "voterId" uuid NOT NULL,
        "voterProfileId" uuid NOT NULL,
        "candidateId" uuid NOT NULL REFERENCES "election_candidate"("id") ON DELETE CASCADE,
        "candidateUserId" uuid NOT NULL,
        "votedAt" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE("electionId", "voterId")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_election_communityId" ON "community_election"("communityId");
      CREATE INDEX "idx_election_status" ON "community_election"("status");
      CREATE INDEX "idx_candidate_electionId" ON "election_candidate"("electionId");
      CREATE INDEX "idx_vote_electionId" ON "election_vote"("electionId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "election_vote"`);
    await queryRunner.query(`DROP TABLE "election_candidate"`);
    await queryRunner.query(`DROP TABLE "community_election"`);
    await queryRunner.query(`ALTER TABLE "community" DROP COLUMN "managerId"`);
    await queryRunner.query(
      `ALTER TABLE "community" DROP COLUMN "managerProfileId"`
    );
  }
}
