import staticSource from './staticDatabase';
import {
  ChannelFeed,
  ChannelSubscription,
  LiveSession,
  ProgramBlock,
  Video,
  VideoView,
} from '../entities';
import { CommunityBroadcast1786715103205 } from '../../migrations/1786715103205-community-broadcast';
import { VideoProcessingPipeline1786715106275 } from '../../migrations/1786715106275-video-processing-pipeline';

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
    const migrations = staticSource.options.migrations as Function[];

    expect(migrations.map((migration) => migration.name)).toEqual([
      'Initial1770152975983',
      'CommunityBroadcast1786715103205',
      'VideoProcessingPipeline1786715106275',
    ]);
  });

  it('declares uuid foreign key columns to match the baseline migration schema', async () => {
    await (
      staticSource as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();

    expect(
      staticSource.getMetadata(Video).findColumnWithPropertyName('channelId')
        ?.type
    ).toBe('uuid');
    expect(
      staticSource.getMetadata(VideoView).findColumnWithPropertyName('videoId')
        ?.type
    ).toBe('uuid');
    expect(
      staticSource
        .getMetadata(ChannelSubscription)
        .findColumnWithPropertyName('channelId')?.type
    ).toBe('uuid');
  });

  it('backfills collision-safe community slugs before adding the unique constraint', async () => {
    const queryRunner = createQueryRunnerMock();

    await new CommunityBroadcast1786715103205().up(queryRunner as never);

    const slugBackfill = queryRunner.executed.find(
      (sql) => sql.includes('UPDATE "channel"') && sql.includes('communitySlug')
    );

    expect(slugBackfill).toContain('row_number() OVER');
    expect(slugBackfill).toContain('normalized."slug_rank" = 1');
    expect(slugBackfill).toContain(
      "COALESCE(NULLIF(trim(both '-' from regexp_replace"
    );
  });

  it('does not reapply retired migrations recorded in an existing database', async () => {
    const queryRunner = {
      query: jest.fn(async () => [{ exists: true }]),
    };

    await new CommunityBroadcast1786715103205().up(queryRunner as never);
    await new VideoProcessingPipeline1786715106275().up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledTimes(2);
  });

  it('does not revert resources owned by retired migrations', async () => {
    const queryRunner = {
      query: jest.fn(async () => [{ exists: true }]),
    };

    await new CommunityBroadcast1786715103205().down(queryRunner as never);
    await new VideoProcessingPipeline1786715106275().down(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledTimes(2);
  });
});
