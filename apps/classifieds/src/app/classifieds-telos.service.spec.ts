import { Repository } from 'typeorm';
import { ClassifiedsTelosService } from './classifieds-telos.service';
import { ClassifiedAdEntity } from './entities/classified-ad.entity';

describe('ClassifiedsTelosService', () => {
  let repository: jest.Mocked<Partial<Repository<ClassifiedAdEntity>>>;
  let service: ClassifiedsTelosService;

  beforeEach(() => {
    repository = {
      find: jest.fn(),
    };
    service = new ClassifiedsTelosService(
      repository as Repository<ClassifiedAdEntity>
    );
  });

  it('summarizes listing activity for a profile', async () => {
    (repository.find as jest.Mock).mockResolvedValue([
      {
        id: 'ad-1',
        profileId: 'profile-1',
        title: 'Vintage Synth Keyboard',
        description: 'Restored keyboard with travel case',
        price: 450,
        currency: 'USD',
        category: 'music',
        condition: 'used',
        status: 'active',
        isFeatured: true,
        createdAt: new Date('2026-06-01T00:00:00Z'),
      },
      {
        id: 'ad-2',
        profileId: 'profile-1',
        title: 'Studio Monitor Pair',
        description: 'Nearfield monitors for production work',
        price: 700,
        currency: 'USD',
        category: 'music',
        condition: 'used',
        status: 'sold',
        isFeatured: false,
        createdAt: new Date('2026-05-20T00:00:00Z'),
      },
      {
        id: 'ad-3',
        profileId: 'profile-1',
        title: 'Workstation Desk',
        description: 'Adjustable desk for editing and design',
        price: 300,
        currency: 'USD',
        category: 'furniture',
        condition: 'good',
        status: 'active',
        isFeatured: false,
        createdAt: new Date('2026-05-10T00:00:00Z'),
      },
    ] as ClassifiedAdEntity[]);

    const facts = await service.getProfileFacts('profile-1');

    expect(repository.find).toHaveBeenCalledWith({
      where: { profileId: 'profile-1' },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'classifieds:summary',
          metadata: {
            counts: {
              listings: 3,
              activeListings: 2,
              soldListings: 1,
              featuredListings: 1,
            },
            averagePrice: 483.33,
            currencies: ['USD'],
          },
        }),
        expect.objectContaining({
          sourceType: 'classifieds:inventory',
          metadata: expect.objectContaining({
            categories: ['music', 'furniture'],
            conditions: ['used', 'good'],
          }),
        }),
        expect.objectContaining({
          sourceType: 'classifieds:topics',
          metadata: expect.objectContaining({
            topics: expect.arrayContaining(['design', 'desk', 'keyboard']),
          }),
        }),
        expect.objectContaining({
          sourceType: 'classifieds:listings',
          metadata: {
            recentTitles: [
              'Vintage Synth Keyboard',
              'Studio Monitor Pair',
              'Workstation Desk',
            ],
          },
        }),
      ])
    );
  });

  it('returns only a summary fact when no listings exist', async () => {
    (repository.find as jest.Mock).mockResolvedValue([]);

    const facts = await service.getProfileFacts('profile-1');

    expect(facts).toEqual([
      expect.objectContaining({
        sourceType: 'classifieds:summary',
        metadata: {
          counts: {
            listings: 0,
            activeListings: 0,
            soldListings: 0,
            featuredListings: 0,
          },
          averagePrice: 0,
          currencies: [],
        },
      }),
    ]);
  });
});
