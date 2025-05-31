import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileService } from './profile.service';
import { Profile } from '../profiles/entities/profile.entity';
import { CreateProfileDto } from '../profiles/dto/create-profile.dto';
import { UpdateProfileDto } from '../profiles/dto/update-profile.dto';

describe('ProfileService', () => {
    let service: ProfileService;
    let repository: Repository<Profile>;

    const mockProfileRepository = {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProfileService,
                {
                    provide: getRepositoryToken(Profile),
                    useValue: mockProfileRepository,
                },
            ],
        }).compile();

        service = module.get<ProfileService>(ProfileService);
        repository = module.get<Repository<Profile>>(getRepositoryToken(Profile));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findAll', () => {
        it('should return an array of profiles', async () => {
            const result = [new Profile()];
            jest.spyOn(repository, 'find').mockResolvedValue(result);

            expect(await service.findAll()).toBe(result);
        });
    });

    describe('findOne', () => {
        it('should return a single profile', async () => {
            const id = '1';
            const result = new Profile();
            jest.spyOn(repository, 'findOne').mockResolvedValue(result);

            expect(await service.findOne(id)).toBe(result);
        });
    });

    describe('create', () => {
        it('should create and return a profile', async () => {
            const createProfileDto: CreateProfileDto = {
                name: 'Test',
                description: '',
                userId: '',
                profilePic: '',
                coverPic: '',
                bio: '',
                location: '',
                occupation: '',
                interests: '',
                skills: ''
            };
            const result = new Profile();
            jest.spyOn(repository, 'save').mockResolvedValue(result);

            expect(await service.create(createProfileDto)).toBe(result);
        });
    });

    describe('update', () => {
        it('should update and return a profile', async () => {
            const id = '1';
            const updateProfileDto: UpdateProfileDto = {
                name: 'Updated Test',
                id: '1'
            };
            const result = new Profile();
            jest.spyOn(repository, 'update').mockResolvedValue(undefined);
            jest.spyOn(repository, 'findOne').mockResolvedValue(result);

            expect(await service.update(id, updateProfileDto)).toBe(result);
        });
    });
});