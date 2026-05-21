import { Repository } from 'typeorm';
import { BroadcastService } from './broadcast.service';
import { ChannelFeed } from '../../entities/channel-feed.entity';
import { ProgramBlock } from '../../entities/program-block.entity';
import { LiveSession } from '../../entities/live-session.entity';

describe('BroadcastService', () => {
  let service: BroadcastService;
  let feedRepository: jest.Mocked<Partial<Repository<ChannelFeed>>>;
  let blockRepository: jest.Mocked<Partial<Repository<ProgramBlock>>>;
  let sessionRepository: jest.Mocked<Partial<Repository<LiveSession>>>;

  beforeEach(() => {
    feedRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    blockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    sessionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    service = new BroadcastService(
      feedRepository as Repository<ChannelFeed>,
      blockRepository as Repository<ProgramBlock>,
      sessionRepository as Repository<LiveSession>
    );
  });

  it('interrupts the current prerecorded block when live goes on air', async () => {
    const scheduledBlock = {
      id: 'block-1',
      communityId: 'community-1',
      blockType: 'prerecorded',
      title: 'Morning replay',
      startsAt: new Date('2026-04-17T13:00:00.000Z'),
      endsAt: new Date('2026-04-17T14:00:00.000Z'),
      status: 'live',
    } as ProgramBlock;
    const feed = {
      id: 'feed-1',
      communityId: 'community-1',
      timezone: 'America/New_York',
      currentMode: 'scheduled',
      activeProgramBlockId: 'block-1',
    } as ChannelFeed;

    feedRepository.findOne!.mockResolvedValue(feed);
    blockRepository.findOne!.mockResolvedValue(scheduledBlock);
    sessionRepository.create!.mockImplementation((input) => input as LiveSession);
    sessionRepository.save!.mockImplementation(async (input) => input as LiveSession);
    blockRepository.save!.mockImplementation(async (input) => input as ProgramBlock);
    feedRepository.save!.mockImplementation(async (input) => input as ChannelFeed);

    const result = await service.startLiveSession({
      communityId: 'community-1',
      title: 'Breaking live update',
      startedByUserId: 'user-1',
      startedByProfileId: 'profile-1',
    });

    expect(blockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'block-1',
        status: 'interrupted',
      })
    );
    expect(feedRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        communityId: 'community-1',
        currentMode: 'live',
        activeProgramBlockId: null,
        activeLiveSessionId: expect.any(String),
      })
    );
    expect(result.status).toBe('live');
  });
});
