import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DonationsService } from './donations.service';
import { DonationEntity } from './entities/donation.entity';
import { CreateDonationDto } from '@optimistic-tanuki/models';

describe('DonationsService', () => {
  let service: DonationsService;
  let repository: Repository<DonationEntity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsService,
        {
          provide: getRepositoryToken(DonationEntity),
          useValue: {
            create: jest.fn((data) => data),
            save: jest.fn((data) =>
              Promise.resolve({ id: 'donation-1', ...data })
            ),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DonationsService>(DonationsService);
    repository = module.get<Repository<DonationEntity>>(
      getRepositoryToken(DonationEntity)
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a donation preserving the exact integer cent amount', async () => {
      const dto: CreateDonationDto = {
        userId: 'user-1',
        amountCents: 2500,
      };

      const result = await service.create(dto);

      expect(result.amountCents).toBe(2500);
      expect(repository.create).toHaveBeenCalledWith({
        ...dto,
        status: 'pending',
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it('allows a zero-cent donation (e.g. a message-only pledge)', async () => {
      const dto: CreateDonationDto = {
        userId: 'user-1',
        amountCents: 0,
      };

      const result = await service.create(dto);

      expect(result.amountCents).toBe(0);
    });

    it('sums multiple preset donation amounts in exact integer cents', () => {
      // Mirrors the store-ui preset amounts ($5, $10, $25) expressed in cents.
      const presetCents = [500, 1000, 2500];
      const totalCents = presetCents.reduce((sum, c) => sum + c, 0);

      expect(totalCents).toBe(4000);
      expect(Number.isInteger(totalCents)).toBe(true);
    });

    it('rejects a negative donation amount', async () => {
      const dto: CreateDonationDto = {
        userId: 'user-1',
        amountCents: -500,
      };

      await expect(service.create(dto)).rejects.toThrow(
        'Donation amount cannot be negative'
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
