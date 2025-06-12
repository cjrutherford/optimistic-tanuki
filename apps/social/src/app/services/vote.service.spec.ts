import { CreateVoteDto, UpdateVoteDto } from '@optimistic-tanuki/models';
import { Test, TestingModule } from '@nestjs/testing';

import { Repository } from 'typeorm';
import { Vote } from '../../entities/vote.entity';
import { VoteService } from './vote.service';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('VoteService', () => {
  let service: VoteService;
  let voteRepo: jest.Mocked<Repository<Vote>>;

  const mockVoteRepo = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoteService,
        {
          provide: getRepositoryToken(Vote),
          useFactory: mockVoteRepo,
        },
      ],
    }).compile();

    service = module.get<VoteService>(VoteService);
    voteRepo = module.get(getRepositoryToken(Vote));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a vote', async () => {
    const dto: CreateVoteDto = { postId: 'some uuid', userId: 'u1', value: 1 };
    const vote = { id: 1, profileId: 'p1', ...dto } as Vote;
    voteRepo.create.mockReturnValue(vote);
    voteRepo.save.mockResolvedValue(vote);
    const result = await service.create(dto);
    expect(voteRepo.create).toHaveBeenCalledWith(dto);
    expect(voteRepo.save).toHaveBeenCalledWith(vote);
    expect(result).toBe(vote);
  });

  it('should find all votes', async () => {
    const votes = [{ id: 1 } as Vote, { id: 2 } as Vote];
    voteRepo.find.mockResolvedValue(votes);
    const result = await service.findAll();
    expect(voteRepo.find).toHaveBeenCalled();
    expect(result).toBe(votes);
  });

  it('should find one vote', async () => {
    const vote = { id: 1 } as Vote;
    voteRepo.findOne.mockResolvedValue(vote);
    const result = await service.findOne(1);
    expect(voteRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toBe(vote);
  });

  it('should update a vote', async () => {
    voteRepo.update.mockResolvedValue(undefined);
    const dto: UpdateVoteDto = { value: -1 };
    await service.update(1, dto);
    expect(voteRepo.update).toHaveBeenCalledWith(1, dto);
  });

  it('should remove a vote', async () => {
    voteRepo.delete.mockResolvedValue(undefined);
    await service.remove(1);
    expect(voteRepo.delete).toHaveBeenCalledWith(1);
  });
});
