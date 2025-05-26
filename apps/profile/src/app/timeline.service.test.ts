import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimelineService } from './timeline.service';
import { Timeline } from '../timelines/entities/timeline.entity';

describe('TimelineService', () => {
    let service: TimelineService;
    let repository: Repository<Timeline>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TimelineService,
                {
                    provide: getRepositoryToken(Timeline),
                    useClass: Repository,
                },
            ],
        }).compile();

        service = module.get<TimelineService>(TimelineService);
        repository = module.get<Repository<Timeline>>(getRepositoryToken(Timeline));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findAll', () => {
        it('should return an array of timelines', async () => {
            const timelines = [new Timeline(), new Timeline()];
            jest.spyOn(repository, 'find').mockResolvedValue(timelines);

            expect(await service.findAll()).toBe(timelines);
        });
    });
});