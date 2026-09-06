import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PollService } from './poll.service';
import { Poll } from '../../entities/poll.entity';

const vote = (userId: string, optionIndices: number[]) =>
  JSON.stringify({ userId, optionIndices });

describe('PollService', () => {
  let service: PollService;
  let pollRepo: jest.Mocked<Repository<Poll>>;

  const mockPollRepo = () => ({
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
        PollService,
        { provide: getRepositoryToken(Poll), useFactory: mockPollRepo },
      ],
    }).compile();

    service = module.get<PollService>(PollService);
    pollRepo = module.get(getRepositoryToken(Poll));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('applies defaults when optional fields are omitted', async () => {
      const created = { id: 'p1' } as Poll;
      pollRepo.create.mockReturnValue(created);
      pollRepo.save.mockResolvedValue(created);

      const result = await service.create({
        question: 'Best colour?',
        options: ['red', 'blue'],
        profileId: 'prof-1',
        userId: 'user-1',
      });

      expect(pollRepo.create).toHaveBeenCalledWith({
        question: 'Best colour?',
        options: ['red', 'blue'],
        isMultipleChoice: false,
        endsAt: null,
        showResultsBeforeVote: true,
        isAnonymous: false,
        profileId: 'prof-1',
        userId: 'user-1',
        isActive: true,
        votes: [],
      });
      expect(pollRepo.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });

    it('honours provided optional fields', async () => {
      const created = { id: 'p2' } as Poll;
      pollRepo.create.mockReturnValue(created);
      pollRepo.save.mockResolvedValue(created);

      await service.create({
        question: 'Multi?',
        options: ['a', 'b', 'c'],
        isMultipleChoice: true,
        endsAt: '2030-01-01T00:00:00.000Z',
        showResultsBeforeVote: false,
        isAnonymous: true,
        profileId: 'prof-2',
        userId: 'user-2',
      });

      expect(pollRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isMultipleChoice: true,
          endsAt: new Date('2030-01-01T00:00:00.000Z'),
          showResultsBeforeVote: false,
          isAnonymous: true,
        })
      );
    });
  });

  describe('findOne / findMany', () => {
    it('finds one by id', async () => {
      const poll = { id: 'p1' } as Poll;
      pollRepo.findOne.mockResolvedValue(poll);

      expect(await service.findOne('p1')).toBe(poll);
      expect(pollRepo.findOne).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });

    it('finds many without a profile filter', async () => {
      pollRepo.find.mockResolvedValue([]);

      await service.findMany();

      expect(pollRepo.find).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
      });
    });

    it('finds many filtered by profileId', async () => {
      const polls = [{ id: 'p1' }] as Poll[];
      pollRepo.find.mockResolvedValue(polls);

      expect(await service.findMany('prof-1')).toBe(polls);
      expect(pollRepo.find).toHaveBeenCalledWith({
        where: { profileId: 'prof-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('update', () => {
    it('throws when the poll does not exist', async () => {
      pollRepo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', {})).rejects.toThrow(
        'Poll not found'
      );
      expect(pollRepo.update).not.toHaveBeenCalled();
    });

    it('only sends the fields that were provided', async () => {
      const poll = { id: 'p1' } as Poll;
      pollRepo.findOne.mockResolvedValue(poll);
      pollRepo.update.mockResolvedValue({} as any);

      const result = await service.update('p1', { question: 'New question?' });

      expect(pollRepo.update).toHaveBeenCalledWith('p1', {
        question: 'New question?',
      });
      expect(result).toBe(poll);
    });

    it('maps every updatable field', async () => {
      pollRepo.findOne.mockResolvedValue({ id: 'p1' } as Poll);
      pollRepo.update.mockResolvedValue({} as any);

      await service.update('p1', {
        question: 'q',
        options: ['x', 'y'],
        isMultipleChoice: true,
        endsAt: '2031-05-05T00:00:00.000Z',
        showResultsBeforeVote: false,
        isAnonymous: true,
        isActive: false,
      });

      expect(pollRepo.update).toHaveBeenCalledWith('p1', {
        question: 'q',
        options: ['x', 'y'],
        isMultipleChoice: true,
        endsAt: new Date('2031-05-05T00:00:00.000Z'),
        showResultsBeforeVote: false,
        isAnonymous: true,
        isActive: false,
      });
    });

    it('clears endsAt when passed an empty value', async () => {
      pollRepo.findOne.mockResolvedValue({ id: 'p1' } as Poll);
      pollRepo.update.mockResolvedValue({} as any);

      await service.update('p1', { endsAt: null as unknown as string });

      expect(pollRepo.update).toHaveBeenCalledWith('p1', { endsAt: null });
    });
  });

  describe('remove', () => {
    it('deletes the poll', async () => {
      pollRepo.delete.mockResolvedValue({} as any);

      await service.remove('p1');

      expect(pollRepo.delete).toHaveBeenCalledWith('p1');
    });
  });

  describe('vote', () => {
    it('throws when the poll is missing', async () => {
      pollRepo.findOne.mockResolvedValue(null);

      await expect(
        service.vote({ pollId: 'p1', userId: 'u1', optionIndices: [0] })
      ).rejects.toThrow('Poll not found');
    });

    it('throws when the poll is inactive', async () => {
      pollRepo.findOne.mockResolvedValue({
        id: 'p1',
        isActive: false,
      } as Poll);

      await expect(
        service.vote({ pollId: 'p1', userId: 'u1', optionIndices: [0] })
      ).rejects.toThrow('Poll is no longer active');
    });

    it('throws when the poll has ended', async () => {
      pollRepo.findOne.mockResolvedValue({
        id: 'p1',
        isActive: true,
        endsAt: new Date('2000-01-01T00:00:00.000Z'),
      } as Poll);

      await expect(
        service.vote({ pollId: 'p1', userId: 'u1', optionIndices: [0] })
      ).rejects.toThrow('Poll has ended');
    });

    it('records a single-choice vote, replacing any previous vote', async () => {
      const poll = {
        id: 'p1',
        isActive: true,
        endsAt: null,
        isMultipleChoice: false,
        votes: [vote('u1', [0]), vote('u2', [1])],
      } as unknown as Poll;
      pollRepo.findOne.mockResolvedValue(poll);
      pollRepo.update.mockResolvedValue({} as any);

      await service.vote({ pollId: 'p1', userId: 'u1', optionIndices: [2, 3] });

      expect(pollRepo.update).toHaveBeenCalledWith('p1', {
        votes: [vote('u2', [1]), vote('u1', [2])],
      });
    });

    it('merges option indices for multiple-choice polls', async () => {
      const poll = {
        id: 'p1',
        isActive: true,
        endsAt: null,
        isMultipleChoice: true,
        votes: [vote('u1', [0])],
      } as unknown as Poll;
      pollRepo.findOne.mockResolvedValue(poll);
      pollRepo.update.mockResolvedValue({} as any);

      await service.vote({ pollId: 'p1', userId: 'u1', optionIndices: [0, 2] });

      expect(pollRepo.update).toHaveBeenCalledWith('p1', {
        votes: [vote('u1', [0, 2])],
      });
    });

    it('treats a missing votes array as empty and keeps unparseable entries', async () => {
      const poll = {
        id: 'p1',
        isActive: true,
        endsAt: null,
        isMultipleChoice: true,
        votes: ['not-json'],
      } as unknown as Poll;
      pollRepo.findOne.mockResolvedValue(poll);
      pollRepo.update.mockResolvedValue({} as any);

      await service.vote({ pollId: 'p1', userId: 'u1', optionIndices: [1] });

      expect(pollRepo.update).toHaveBeenCalledWith('p1', {
        votes: ['not-json', vote('u1', [1])],
      });
    });
  });

  describe('removeVote', () => {
    it('throws when the poll is missing', async () => {
      pollRepo.findOne.mockResolvedValue(null);

      await expect(service.removeVote('p1', 'u1')).rejects.toThrow(
        'Poll not found'
      );
    });

    it('drops only the requested user votes', async () => {
      pollRepo.findOne.mockResolvedValue({
        id: 'p1',
        votes: [vote('u1', [0]), vote('u2', [1]), 'garbage'],
      } as unknown as Poll);
      pollRepo.update.mockResolvedValue({} as any);

      await service.removeVote('p1', 'u1');

      expect(pollRepo.update).toHaveBeenCalledWith('p1', {
        votes: [vote('u2', [1]), 'garbage'],
      });
    });

    it('handles a null votes column', async () => {
      pollRepo.findOne.mockResolvedValue({
        id: 'p1',
        votes: null,
      } as unknown as Poll);
      pollRepo.update.mockResolvedValue({} as any);

      await service.removeVote('p1', 'u1');

      expect(pollRepo.update).toHaveBeenCalledWith('p1', { votes: [] });
    });
  });

  describe('getPollWithResults', () => {
    it('returns null when the poll is missing', async () => {
      pollRepo.findOne.mockResolvedValue(null);

      expect(await service.getPollWithResults('p1')).toBeNull();
    });

    it('tallies counts and percentages per option', async () => {
      pollRepo.findOne.mockResolvedValue({
        id: 'p1',
        options: ['a', 'b', 'c'],
        votes: [vote('u1', [0]), vote('u2', [0, 1]), 'bad'],
      } as unknown as Poll);

      const result = await service.getPollWithResults('p1');

      expect(result.totalVotes).toBe(3);
      expect(result.optionResults).toEqual([
        { option: 'a', count: 2, percentage: 67 },
        { option: 'b', count: 1, percentage: 33 },
        { option: 'c', count: 0, percentage: 0 },
      ]);
      expect(result.userVoted).toBe(false);
      expect(result.userVoteOptions).toEqual([]);
    });

    it('reports zero percentages when there are no votes', async () => {
      pollRepo.findOne.mockResolvedValue({
        id: 'p1',
        options: ['a'],
        votes: null,
      } as unknown as Poll);

      const result = await service.getPollWithResults('p1');

      expect(result.totalVotes).toBe(0);
      expect(result.optionResults).toEqual([
        { option: 'a', count: 0, percentage: 0 },
      ]);
    });

    it('includes the requesting user own selections', async () => {
      pollRepo.findOne.mockResolvedValue({
        id: 'p1',
        options: ['a', 'b'],
        votes: [vote('u1', [1])],
      } as unknown as Poll);

      const result = await service.getPollWithResults('p1', 'u1');

      expect(result.userVoted).toBe(true);
      expect(result.userVoteOptions).toEqual([1]);
    });

    it('reports userVoted false for a user who has not voted', async () => {
      pollRepo.findOne.mockResolvedValue({
        id: 'p1',
        options: ['a'],
        votes: [vote('u2', [0])],
      } as unknown as Poll);

      const result = await service.getPollWithResults('p1', 'u1');

      expect(result.userVoted).toBe(false);
    });

    it('treats a vote entry without optionIndices as an empty selection', async () => {
      pollRepo.findOne.mockResolvedValue({
        id: 'p1',
        options: ['a'],
        votes: [JSON.stringify({ userId: 'u1' })],
      } as unknown as Poll);

      const result = await service.getPollWithResults('p1', 'u1');

      expect(result.totalVotes).toBe(0);
      expect(result.userVoted).toBe(false);
      expect(result.userVoteOptions).toEqual([]);
    });
  });
});
