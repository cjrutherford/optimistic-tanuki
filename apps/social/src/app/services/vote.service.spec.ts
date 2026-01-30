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
    const vote = {
      id: 1,
      profileId: 'p1',
      post: { id: 'some uuid' },
      userId: 'u1',
      value: 1,
    } as Vote;
    voteRepo.create.mockReturnValue(vote);
    voteRepo.save.mockResolvedValue(vote);
    const result = await service.create(dto);
    expect(voteRepo.create).toHaveBeenCalledWith({
      userId: 'u1',
      value: 1,
      post: { id: 'some uuid' },
    });
    expect(voteRepo.save).toHaveBeenCalledWith(vote);
    expect(result).toBe(vote);
  });

  it('should create a vote without postId', async () => {
    const dto: CreateVoteDto = { userId: 'u1', value: 1 };
    const vote = {
      id: 1,
      userId: 'u1',
      value: 1,
    } as Vote;
    voteRepo.create.mockReturnValue(vote);
    voteRepo.save.mockResolvedValue(vote);
    const result = await service.create(dto);
    expect(voteRepo.create).toHaveBeenCalledWith({
      userId: 'u1',
      value: 1,
      post: undefined,
    });
    expect(result).toBe(vote);
  });

  it('should find all votes with options', async () => {
    const votes = [{ id: 1 } as Vote];
    voteRepo.find.mockResolvedValue(votes);
    await service.findAll({ where: { value: 1 } });
    expect(voteRepo.find).toHaveBeenCalledWith({ where: { value: 1 } });
  });

  it('should find one vote', async () => {
    const vote = { id: '1' } as unknown as Vote;
    voteRepo.findOne.mockResolvedValue(vote);
    const result = await service.findOne('1');
    expect(voteRepo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(result).toBe(vote);
  });

  it('should find one vote with options', async () => {
    const vote = { id: '1' } as unknown as Vote;
    voteRepo.findOne.mockResolvedValue(vote);
    await service.findOne('1', { relations: ['post'] });
    expect(voteRepo.findOne).toHaveBeenCalledWith({ where: { id: '1' }, relations: ['post'] });
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
