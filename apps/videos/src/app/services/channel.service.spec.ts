import { Repository } from 'typeorm';
import { ChannelService } from './channel.service';
import { Channel } from '../../entities/channel.entity';
import { ChannelFeed } from '../../entities/channel-feed.entity';

describe('ChannelService', () => {
  let service: ChannelService;
  let repository: jest.Mocked<Partial<Repository<Channel>>>;
  let feedRepository: jest.Mocked<Partial<Repository<ChannelFeed>>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    feedRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    service = new ChannelService(
      repository as Repository<Channel>,
      feedRepository as Repository<ChannelFeed>
    );
  });

  it('looks up a channel by community slug before falling back to id', async () => {
    const channel = {
      id: 'channel-1',
      communityId: 'community-1',
      communitySlug: 'ot-live',
      name: 'OT Live',
    } as unknown as Channel;

    repository.findOne!.mockResolvedValueOnce(channel);

    const result = await service.findBySlugOrId('ot-live');

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { communitySlug: 'ot-live' },
      relations: ['videos', 'subscriptions', 'feed'],
    });
    expect(result).toBe(channel);
  });

  it('falls back to channel id when no community slug matches', async () => {
    const channel = {
      id: 'channel-1',
      communityId: 'community-1',
      communitySlug: 'ot-live',
      name: 'OT Live',
    } as unknown as Channel;

    repository
      .findOne!.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(channel);

    const result = await service.findBySlugOrId('channel-1');

    expect(repository.findOne).toHaveBeenNthCalledWith(1, {
      where: { communitySlug: 'channel-1' },
      relations: ['videos', 'subscriptions', 'feed'],
    });
    expect(repository.findOne).toHaveBeenNthCalledWith(2, {
      where: { id: 'channel-1' },
      relations: ['videos', 'subscriptions', 'feed'],
    });
    expect(result).toBe(channel);
  });

  it('persists anchor coordinates when creating a channel', async () => {
    const savedChannel = {
      id: 'channel-1',
      communityId: '33333333-3333-4333-8333-333333333333',
      communitySlug: 'savannah-live',
      anchorLat: 32.08,
      anchorLng: -81.09,
      timezone: 'America/New_York',
    } as unknown as Channel;

    repository.create!.mockImplementation((input) => input as Channel);
    repository.save!.mockResolvedValue(savedChannel);
    repository.findOne!.mockResolvedValue(savedChannel);
    feedRepository.create!.mockImplementation((input) => input as ChannelFeed);
    feedRepository.save!.mockResolvedValue({} as ChannelFeed);

    const result = await service.create({
      name: 'Savannah Live',
      description: 'Street-level coverage.',
      profileId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      communityId: '33333333-3333-4333-8333-333333333333',
      communitySlug: 'savannah-live',
      timezone: 'America/New_York',
      anchorLat: 32.08,
      anchorLng: -81.09,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        communityId: '33333333-3333-4333-8333-333333333333',
        communitySlug: 'savannah-live',
        anchorLat: 32.08,
        anchorLng: -81.09,
      })
    );
    expect(result).toBe(savedChannel);
  });
});
