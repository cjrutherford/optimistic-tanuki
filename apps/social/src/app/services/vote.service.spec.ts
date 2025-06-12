import { Test, TestingModule } from '@nestjs/testing';
import { VoteService } from './vote.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Vote } from '../../entities/vote.entity';
import { Repository } from 'typeorm';
import { CreateVoteDto, UpdateVoteDto } from '@optimistic-tanuki/models';

describe('VoteService', () => {
    let service: VoteService;
    let repo: Repository<Vote>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VoteService,
                {
                    provide: getRepositoryToken(Vote),
                    useValue: {
                        create: jest.fn(),
                        save: jest.fn(),
                        find: jest.fn(),
                        findOne: jest.fn(),
                        update: jest.fn(),
                        delete: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<VoteService>(VoteService);
        repo = module.get<Repository<Vote>>(getRepositoryToken(Vote));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create and save a vote', async () => {
            const dto: CreateVoteDto = {} as any;
            const vote = { id: 1 } as Vote;
            (repo.create as jest.Mock).mockReturnValue(vote);
            (repo.save as jest.Mock).mockResolvedValue(vote);

            const result = await service.create(dto);

            expect(repo.create).toHaveBeenCalledWith(dto);
            expect(repo.save).toHaveBeenCalledWith(vote);
            expect(result).toBe(vote);
        });
    });

    describe('findAll', () => {
        it('should return all votes', async () => {
            const votes = [{ id: 1 }] as Vote[];
            (repo.find as jest.Mock).mockResolvedValue(votes);

            const result = await service.findAll();

            expect(repo.find).toHaveBeenCalled();
            expect(result).toBe(votes);
        });
    });

    describe('findOne', () => {
        it('should return a vote by id', async () => {
            const vote = { id: 1 } as Vote;
            (repo.findOne as jest.Mock).mockResolvedValue(vote);

            const result = await service.findOne(1);

            expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(result).toBe(vote);
        });
    });

    describe('update', () => {
        it('should update a vote', async () => {
            (repo.update as jest.Mock).mockResolvedValue(undefined);
            const dto: UpdateVoteDto = {} as any;

            await service.update(1, dto);

            expect(repo.update).toHaveBeenCalledWith(1, dto);
        });
    });

    describe('remove', () => {
        it('should delete a vote', async () => {
            (repo.delete as jest.Mock).mockResolvedValue(undefined);

            await service.remove(1);

            expect(repo.delete).toHaveBeenCalledWith(1);
        });
    });
});