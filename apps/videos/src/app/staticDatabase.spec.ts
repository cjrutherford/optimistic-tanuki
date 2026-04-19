import staticSource from './staticDatabase';
import {
  ChannelFeed,
  ChannelSubscription,
  LiveSession,
  ProgramBlock,
  Video,
  VideoView,
} from '../entities';
import { CommunityBroadcast20260417143000 } from '../../migrations/20260417143000-community-broadcast';

const createQueryRunnerMock = () => {
  const executed: string[] = [];

  return {
    executed,
    query: jest.fn(async (sql: string) => {
      executed.push(sql);
      return undefined;
    }),
    hasTable: jest.fn(async () => false),
  };
};

describe('videos static datasource', () => {
  it('registers ChannelFeed metadata used by Channel relations', () => {
    const entities = (staticSource.options.entities ?? []) as Function[];

    expect(entities).toContain(ChannelFeed);
    expect(entities).toContain(ProgramBlock);
    expect(entities).toContain(LiveSession);
  });

  it('initializes migrations in baseline-first order', async () => {
    await staticSource.initialize();

    try {
      expect(
        staticSource.migrations.map((migration) => migration.name),
      ).toEqual([
        'Initial1770152975983',
        'CommunityBroadcast20260417143000',
        'VideoProcessingPipeline20260418170000',
      ]);
    } finally {
      await staticSource.destroy();
    }
  });

  it('declares uuid foreign key columns to match the baseline migration schema', async () => {
    await staticSource.initialize();

    try {
      expect(
        staticSource.getMetadata(Video).findColumnWithPropertyName('channelId')
          ?.type,
      ).toBe('uuid');
      expect(
        staticSource
          .getMetadata(VideoView)
          .findColumnWithPropertyName('videoId')?.type,
      ).toBe('uuid');
      expect(
        staticSource
          .getMetadata(ChannelSubscription)
          .findColumnWithPropertyName('channelId')?.type,
      ).toBe('uuid');
    } finally {
      await staticSource.destroy();
    }
  });

  it('bootstraps baseline tables when community broadcast runs first', async () => {
    const queryRunner = createQueryRunnerMock();

    await new CommunityBroadcast20260417143000().up(queryRunner as never);

    expect(queryRunner.hasTable).toHaveBeenCalledWith('channel');
    expect(queryRunner.executed[0]).toContain(
      'CREATE TABLE IF NOT EXISTS "video_view"',
    );
    expect(queryRunner.executed).toContain(
      'ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "communityId" character varying',
    );
  });

  it('backfills collision-safe community slugs before adding the unique constraint', async () => {
    const queryRunner = createQueryRunnerMock();

    await new CommunityBroadcast20260417143000().up(queryRunner as never);

    const slugBackfill = queryRunner.executed.find(
      (sql) =>
        sql.includes('UPDATE "channel"') && sql.includes('communitySlug'),
    );

    expect(slugBackfill).toContain('row_number() OVER');
    expect(slugBackfill).toContain('normalized."slug_rank" = 1');
    expect(slugBackfill).toContain(
      "COALESCE(NULLIF(trim(both '-' from regexp_replace",
    );
  });
});
