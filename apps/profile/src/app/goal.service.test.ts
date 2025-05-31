import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoalService } from './goal.service';
import { Goal } from '../goals/entities/goal.entity';
import { Repository } from 'typeorm';

describe('GoalService', () => {
    let service: GoalService;
    let repository: Repository<Goal>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoalService,
                {
                    provide: getRepositoryToken(Goal),
                    useClass: Repository,
                },
            ],
        }).compile();

        service = module.get<GoalService>(GoalService);
        repository = module.get<Repository<Goal>>(getRepositoryToken(Goal));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findOne', () => {
        it('should return a goal when it exists', async () => {
            const goalId = '1';
            const goal = new Goal();
            goal.id = goalId;

            jest.spyOn(repository, 'findOne').mockResolvedValue(goal);

            expect(await service.findOne(goalId)).toEqual(goal);
        });

        it('should return null when the goal does not exist', async () => {
            const goalId = '1';

            jest.spyOn(repository, 'findOne').mockResolvedValue(null);

            expect(await service.findOne(goalId)).toBeNull();
        });
    });
});