import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import { DataSource } from 'typeorm';
import { of } from 'rxjs';
import loadDatabase from './loadDatabase';
import { Post } from '../entities/post.entity';
import { Link } from '../entities/link.entity';
import { Attachment, AttachmentType } from '../entities/attachment.entity';
import { Comment } from '../entities/comment.entity';
import { Reaction } from '../entities/reaction.entity';
import { Vote } from '../entities/vote.entity';
import { Poll } from '../entities/poll.entity';
import { SavedItem } from '../entities/saved-item.entity';
import { SearchHistory } from '../entities/search-history.entity';
import FollowEntity from '../entities/Follow.entity';
import { UserBlock } from '../entities/user-block.entity';
import { UserMute } from '../entities/user-mute.entity';
import { LinkService } from './services/link.service';
import { SocialAccountExportService } from './account-export.service';

const marker = 'private-social-post-link-j22-v1';
const optedIn = process.env.SOCIAL_ASSOCIATIONS_J22_MARKER;
if (optedIn !== undefined && optedIn !== marker)
  throw new Error('Invalid J22 fixture marker');
const fixture = {
  host: '127.0.0.1',
  port: 15553,
  username: 'post_link_fixture',
  password: 'synthetic-j22-only',
  database: 'post_link_j22_fixture',
};
const describePrivate = optedIn === marker ? describe : describe.skip;

describePrivate('J22 migrated Post/Link ownership and projections', () => {
  let source: DataSource;
  it('persists both relation directions, enforces actor writes and exports only owned associations', async () => {
    if (
      process.env.POSTGRES_HOST !== fixture.host ||
      process.env.POSTGRES_DB !== fixture.database
    )
      throw new Error('Wrong J22 database overrides');
    const options = loadDatabase({ get: () => fixture } as any);
    source = new DataSource({
      ...options,
      type: 'postgres',
      host: fixture.host,
      port: fixture.port,
      username: fixture.username,
      password: fixture.password,
      database: fixture.database,
      migrations: [],
      migrationsRun: false,
      synchronize: false,
    });
    await source.initialize();
    expect(
      (await source.query('SELECT current_database() AS name'))[0].name
    ).toBe(fixture.database);
    expect(
      Number((await source.query('SELECT count(*) FROM migrations'))[0].count)
    ).toBe(27);
    const table = await source.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='post_link'"
    );
    expect(table).toHaveLength(1);
    const postRepo = source.getRepository(Post);
    const linkRepo = source.getRepository(Link);
    const accountId = randomUUID(),
      profileId = randomUUID(),
      foreignAccount = randomUUID(),
      foreignProfile = randomUUID();
    const postId = randomUUID(),
      foreignPostId = randomUUID(),
      assetId = randomUUID(),
      attachmentId = randomUUID();
    const foreignMarker = 'J22-counterpart-private';
    const storageMarker = '/private/storage/J22-raw-path';
    try {
      await postRepo.save(
        postRepo.create({
          id: postId,
          userId: accountId,
          profileId,
          title: 'Own post',
          content: 'Own content',
          appScope: 'social',
          visibility: 'public',
        })
      );
      await postRepo.save(
        postRepo.create({
          id: foreignPostId,
          userId: foreignAccount,
          profileId: foreignProfile,
          title: foreignMarker,
          content: foreignMarker,
          appScope: 'social',
          visibility: 'followers',
        })
      );
      const links = new LinkService(linkRepo);
      const actor = { accountId, profileId };
      const web = await links.create(
        { postId, url: 'https://example.test/own' },
        actor
      );
      const asset = await links.create(
        { postId, url: `https://example.test/api/asset/${assetId}` },
        actor
      );
      await links.create(
        { postId: foreignPostId, url: `https://example.test/${foreignMarker}` },
        { accountId: foreignAccount, profileId: foreignProfile }
      );
      await linkRepo.save(
        linkRepo.create({
          url: 'https://example.test/J22-standalone',
          appScope: 'social',
        })
      );
      const countBefore = await linkRepo.count();
      await expect(
        links.create(
          { postId: foreignPostId, url: 'https://example.test/forged' },
          actor
        )
      ).rejects.toBeDefined();
      await expect(
        links.create(
          { postId: undefined, url: 'https://example.test/ambiguous' } as any,
          actor
        )
      ).rejects.toBeDefined();
      expect(await linkRepo.count()).toBe(countBefore);
      await expect(
        links.update(web.id, { url: 'https://example.test/overwrite' })
      ).rejects.toBeDefined();
      await expect(links.remove(web.id)).rejects.toBeDefined();
      const own = await postRepo.findOneOrFail({
        where: { id: postId },
        relations: { links: true },
      });
      expect(own.links.map((l) => l.id).sort()).toEqual(
        [web.id, asset.id].sort()
      );
      const reverse = await linkRepo.findOneOrFail({
        where: { id: web.id },
        relations: { posts: true },
      });
      expect(reverse.posts.map((p) => p.id)).toEqual([postId]);
      await source.getRepository(Attachment).save({
        id: attachmentId,
        name: 'own attachment',
        filePath: storageMarker,
        type: AttachmentType.IMAGE,
        appScope: 'social',
        post: own,
      });
      const auth = {
        send: jest.fn(() => of({ isValid: true, data: { userId: accountId } })),
      };
      const profiles = {
        send: jest.fn(() =>
          of({
            accountId,
            profileIds: [profileId],
            hasMore: false,
            nextCursor: null,
            unfenced: true,
          })
        ),
      };
      const exporter = new SocialAccountExportService(
        postRepo,
        source.getRepository(Comment),
        source.getRepository(Reaction),
        source.getRepository(Vote),
        source.getRepository(Attachment),
        source.getRepository(Poll),
        source.getRepository(SavedItem),
        source.getRepository(SearchHistory),
        source.getRepository(FollowEntity),
        source.getRepository(UserBlock),
        source.getRepository(UserMute),
        auth as never,
        profiles as never
      );
      const snapshot = await exporter.getAccountExportSnapshot(accountId, {
        token: 'private-j22-proof',
        appId: 'social',
      });
      expect(snapshot.status).toBe('partial');
      expect(snapshot.data.posts.map((p: any) => p.id)).toEqual([postId]);
      expect(snapshot.data.postLinks).toHaveLength(2);
      expect(snapshot.data.postLinks).toEqual(
        expect.arrayContaining([
          {
            postId,
            linkId: web.id,
            url: 'https://example.test/own',
            appScope: 'social',
          },
          {
            postId,
            linkId: asset.id,
            assetId,
            referenceOnly: true,
            appScope: 'social',
          },
        ])
      );
      expect(snapshot.data.attachments).toHaveLength(1);
      const serialized = JSON.stringify(snapshot);
      for (const excluded of [
        foreignMarker,
        foreignPostId,
        'J22-standalone',
        storageMarker,
        'filePath',
        'storagePath',
      ])
        expect(serialized).not.toContain(excluded);
      expect(snapshot.uncovered).not.toContain('post-link-urls-omitted');
      expect(snapshot.data.portableMediaBytesIncluded).toBe(false);
      const report = {
        result: 'PASS',
        migrationCount: 27,
        relationTable: 'post_link',
        directions: ['Post.links', 'Link.posts'],
        ownedAssociations: 2,
        foreignAndStandaloneExcluded: true,
        rawStorageExcluded: true,
        assetReferenceOnly: true,
        identityProof:
          'controlled Auth/Profile replies; no live Auth/Profile services in this PostgreSQL-only fixture',
      };
      if (!process.env.SOCIAL_PARITY_REPORT_PATH)
        throw new Error('Missing private report path');
      fs.writeFileSync(
        process.env.SOCIAL_PARITY_REPORT_PATH!.replace(
          '.json',
          '-metadata.json'
        ),
        JSON.stringify(
          source.entityMetadatas.map((m) => ({
            name: m.name,
            table: m.tableName,
            tableType: m.tableType,
            columns: m.columns.map((c) => ({
              property: c.propertyName,
              database: c.databaseName,
              nullable: c.isNullable,
              primary: c.isPrimary,
            })),
            relations: m.relations.map((r) => ({
              property: r.propertyName,
              kind: r.relationType,
              target: r.inverseEntityMetadata.name,
              owning: r.isOwning,
              junction: r.junctionEntityMetadata?.tableName ?? null,
            })),
          })),
          null,
          2
        ) + '\n'
      );
      fs.writeFileSync(
        process.env.SOCIAL_PARITY_REPORT_PATH,
        JSON.stringify(report, null, 2) + '\n'
      );
    } finally {
      await source.getRepository(Attachment).delete(attachmentId);
      await postRepo.delete([postId, foreignPostId]);
      // Every Link row belongs to this fresh disposable fixture; Post deletion
      // has already removed the junction rows through its generated FK.
      await source.createQueryBuilder().delete().from(Link).execute();
    }
  });
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
  });
});
