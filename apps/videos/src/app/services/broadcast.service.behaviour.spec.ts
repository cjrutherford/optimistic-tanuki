import { Repository } from 'typeorm';
import { BroadcastService } from './broadcast.service';
import { ChannelFeed } from '../../entities/channel-feed.entity';
import { ProgramBlock } from '../../entities/program-block.entity';
import { LiveSession } from '../../entities/live-session.entity';

/**
 * The spec beside this one covers the interrupt-on-air case. These drive the
 * rest: the two reads, block creation, stopping a session across its three
 * outcomes, and the ensureFeed branch that has to mint a feed because none
 * exists yet.
 */
describe('BroadcastService behaviour', () => {
  let service: BroadcastService;
  let feedRepository: jest.Mocked<Partial<Repository<ChannelFeed>>>;
  let blockRepository: jest.Mocked<Partial<Repository<ProgramBlock>>>;
  let sessionRepository: jest.Mocked<Partial<Repository<LiveSession>>>;

  const feed = (overrides: Partial<ChannelFeed> = {}) =>
    ({
      id: 'feed-1',
      communityId: 'community-1',
      channelId: 'channel-1',
      timezone: 'UTC',
      currentMode: 'offline',
      activeProgramBlockId: null,
      activeLiveSessionId: null,
      activeVideoId: null,
      lastTransitionAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    } as ChannelFeed);

  beforeEach(() => {
    feedRepository = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    blockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    sessionRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    // TypeORM's create/save are overloaded, so the implementations are attached
    // after construction rather than inline, where the mock's single-argument
    // signature would not satisfy them.
    for (const repo of [feedRepository, blockRepository, sessionRepository]) {
      (repo.create as jest.Mock).mockImplementation((input: unknown) => input);
      (repo.save as jest.Mock).mockImplementation(
        async (input: unknown) => input
      );
    }

    service = new BroadcastService(
      feedRepository as Repository<ChannelFeed>,
      blockRepository as Repository<ProgramBlock>,
      sessionRepository as Repository<LiveSession>
    );
  });

  describe('reads', () => {
    it('looks the feed up by community', async () => {
      const existing = feed();
      (feedRepository.findOne as jest.Mock).mockResolvedValue(existing);

      const found = await service.getFeedByCommunityId('community-1');

      expect(feedRepository.findOne).toHaveBeenCalledWith({
        where: { communityId: 'community-1' },
      });
      expect(found).toBe(existing);
    });

    it('returns the schedule oldest-first', async () => {
      (blockRepository.find as jest.Mock).mockResolvedValue([]);

      await service.getScheduleByCommunityId('community-1');

      expect(blockRepository.find).toHaveBeenCalledWith({
        where: { communityId: 'community-1' },
        order: { startsAt: 'ASC' },
      });
    });
  });

  describe('createProgramBlock', () => {
    const dto = {
      communityId: 'community-1',
      channelId: 'channel-1',
      title: 'Morning show',
      blockType: 'prerecorded' as const,
      startsAt: '2026-02-01T09:00:00.000Z',
      endsAt: '2026-02-01T10:00:00.000Z',
    };

    it('schedules the block with its dates parsed and nullable fields defaulted', async () => {
      (feedRepository.findOne as jest.Mock).mockResolvedValue(feed());

      await service.createProgramBlock({ ...dto });

      expect(blockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          communityId: 'community-1',
          videoId: null,
          description: null,
          startsAt: new Date(dto.startsAt),
          endsAt: new Date(dto.endsAt),
          status: 'scheduled',
          actualStartAt: null,
          actualEndAt: null,
        })
      );
      expect(blockRepository.save).toHaveBeenCalled();
    });

    it('keeps a supplied video id and description', async () => {
      (feedRepository.findOne as jest.Mock).mockResolvedValue(feed());

      await service.createProgramBlock({
        ...dto,
        videoId: 'video-9',
        description: 'A description',
      });

      expect(blockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'video-9',
          description: 'A description',
        })
      );
    });

    it('mints a feed first when the community has none', async () => {
      (feedRepository.findOne as jest.Mock).mockResolvedValue(null);

      await service.createProgramBlock({ ...dto });

      expect(feedRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          communityId: 'community-1',
          channelId: 'channel-1',
          timezone: 'UTC',
          currentMode: 'offline',
          activeProgramBlockId: null,
          activeLiveSessionId: null,
          activeVideoId: null,
        })
      );
      expect(feedRepository.save).toHaveBeenCalled();
    });
  });

  describe('stopLiveSession', () => {
    it('ends the session and takes the feed offline', async () => {
      const live = feed({ currentMode: 'live', activeLiveSessionId: 'sess-1' });
      (feedRepository.findOne as jest.Mock).mockResolvedValue(live);
      const session = { id: 'sess-1', status: 'live', endedAt: null };
      (sessionRepository.findOne as jest.Mock).mockResolvedValue(session);

      const stopped = await service.stopLiveSession('community-1');

      expect(sessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'sess-1' },
      });
      expect(stopped).toMatchObject({ status: 'ended' });
      expect(session.endedAt).toBeInstanceOf(Date);
      // The feed is released so the next session can claim it.
      expect(live.currentMode).toBe('offline');
      expect(live.activeLiveSessionId).toBeNull();
      expect(feedRepository.save).toHaveBeenCalledWith(live);
    });

    it.each([
      ['there is no feed at all', null, undefined],
      ['the feed has no active session', 'no-active', undefined],
      ['the referenced session cannot be found', 'missing-session', null],
    ])('returns null when %s', async (_case, feedState, sessionResult) => {
      (feedRepository.findOne as jest.Mock).mockResolvedValue(
        feedState === null
          ? null
          : feedState === 'no-active'
          ? feed({ activeLiveSessionId: null })
          : feed({ activeLiveSessionId: 'sess-1' })
      );
      if (sessionResult !== undefined) {
        (sessionRepository.findOne as jest.Mock).mockResolvedValue(
          sessionResult
        );
      }

      const stopped = await service.stopLiveSession('community-1');

      expect(stopped).toBeNull();
      expect(sessionRepository.save).not.toHaveBeenCalled();
      expect(feedRepository.save).not.toHaveBeenCalled();
    });
  });
});
