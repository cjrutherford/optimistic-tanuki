import { Repository, UpdateResult } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';

import { Goal } from '../goals/entities/goal.entity';
import { GoalService } from './goal.service';
import { getRepositoryToken } from '@nestjs/typeorm';

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

    describe('findAll', () => {
        it('should return an array of goals', async () => {
            const goals = [new Goal(), new Goal()];
            jest.spyOn(repository, 'find').mockResolvedValue(goals);
            expect(await service.findAll()).toEqual(goals);
        });
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

    describe('create', () => {
        it('should save and return the created goal', async () => {
            const createGoalDto: import('../goals/dto/create-goal.dto').CreateGoalDto = {
                name: 'Test Goal',
                description: 'desc',
                userId: 'user1',
                timelineId: 'timeline1',
                projectId: 'project1',
                profileId: 'profile1',
            };
            const savedGoal: Goal = {
                id: '1',
                name: createGoalDto.name,
                description: createGoalDto.description,
                target: 100,
                progress: 0,
                userId: createGoalDto.userId,
                startDate: new Date(),
                endDate: null,
                completed: false,
                timeLineEvents: [],
                related_profile: null,
                related_project: null,
                created_at: new Date(),
            };
            jest.spyOn(repository, 'save').mockResolvedValue(savedGoal);
            expect(await service.create(createGoalDto)).toEqual(savedGoal);
        });
    });

    describe('update', () => {
        it('should update and return the updated goal', async () => {
            const goalId = '1';
            const updateGoalDto: import('../goals/dto/update-goal.dto').UpdateGoalDto = {
                id: goalId,
                name: 'Updated Goal',
                description: 'desc',
                completed: true,
                userId: 'user1',
                timelineId: 'timeline1',
                projectId: 'project1',
                profileId: 'profile1',
            };
            const updatedGoal: Goal = {
                id: goalId,
                name: updateGoalDto.name,
                description: updateGoalDto.description,
                target: 100,
                progress: 100,
                userId: updateGoalDto.userId,
                startDate: new Date(),
                endDate: null,
                completed: true,
                timeLineEvents: [],
                related_profile: null,
                related_project: null,
                created_at: new Date(),
            };
            jest.spyOn(repository, 'update').mockResolvedValue({} as UpdateResult);
            jest.spyOn(repository, 'findOne').mockResolvedValue(updatedGoal);
            expect(await service.update(goalId, updateGoalDto)).toEqual(updatedGoal);
        });
    });
});