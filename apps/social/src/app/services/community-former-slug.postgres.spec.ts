import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import staticDatabase from '../staticDatabase';
import { Community } from '../../entities/community.entity';
import { CommunityMember } from '../../entities/community-member.entity';
import { CommunityInvite } from '../../entities/community-invite.entity';
import { CommunityElection } from '../../entities/community-election.entity';
import { ElectionCandidate } from '../../entities/election-candidate.entity';
import { ElectionVote } from '../../entities/election-vote.entity';
import { CommunityMembershipAudit } from '../../entities/community-membership-audit.entity';
import { CommunityService } from './community.service';

const marker = process.env.SOCIAL_FORMER_SLUG_TEST;
if (marker !== undefined && marker !== 'disposable-s3social')
  throw new Error('Invalid disposable former slug marker');
(marker === 'disposable-s3social' ? describe : describe.skip)(
  'former slug lookup on migrated Social database',
  () => {
    let db: DataSource;
    beforeAll(async () => {
      if (
        process.env.POSTGRES_HOST !== '127.0.0.1' ||
        process.env.POSTGRES_DB !== 's3social'
      )
        throw new Error('Disposable database required');
      db = await staticDatabase.initialize();
    });
    afterAll(async () => {
      if (db?.isInitialized) await db.destroy();
    });

    it('finds a renamed community by a former slug and keeps that slug reserved', async () => {
      const repo = db.getRepository(Community);
      const suffix = randomUUID();
      const row = await repo.save(
        repo.create({
          name: `Palm Valley ${suffix}`,
          slug: `palm-valley-${suffix}`,
          formerSlugs: [`ponte-vedra-${suffix}`],
          ownerId: 'fixture',
          ownerProfileId: 'fixture',
          appScope: 'local-hub',
          localityType: 'town',
          isPrivate: false,
        })
      );
      const service = new CommunityService(
        repo,
        db.getRepository(CommunityMember),
        db.getRepository(CommunityInvite),
        db.getRepository(CommunityElection),
        db.getRepository(ElectionCandidate),
        db.getRepository(ElectionVote),
        db.getRepository(CommunityMembershipAudit)
      );
      const found = await service.findBySlug(`ponte-vedra-${suffix}`);
      expect((found as any).redirectToSlug).toBe(`palm-valley-${suffix}`);
      expect(found?.id).toBe(row.id);
      expect(await service.findBySlug(`nobody-${suffix}`)).toBeNull();
      await expect(
        (service as any).generateUniqueSlug(`ponte-vedra-${suffix}`)
      ).resolves.not.toBe(`ponte-vedra-${suffix}`);
      await repo.delete(row.id);
    });
  }
);
