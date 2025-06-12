import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentService } from './attachment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Attachment, AttachmentType } from '../../entities/attachment.entity';
import { Repository } from 'typeorm';
import { CreateAttachmentDto, UpdateAttachmentDto } from '@optimistic-tanuki/models';
import { Post } from '../../entities/post.entity';

const mockAttachmentRepo = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
});

describe('AttachmentService', () => {
    let service: AttachmentService;
    let repo: jest.Mocked<Repository<Attachment>>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AttachmentService,
                { provide: getRepositoryToken(Attachment), useFactory: mockAttachmentRepo },
            ],
        }).compile();

        service = module.get<AttachmentService>(AttachmentService);
        repo = module.get(getRepositoryToken(Attachment));
    });

    describe('create', () => {
        it('should create and save an attachment', async () => {
            const dto: CreateAttachmentDto = {
                url: 'file.jpg', type: AttachmentType.IMAGE,
                post: ''
            };
            const post = { id: 'post1' } as Post;
            const created = { id: '1', filePath: 'file.jpg', type: AttachmentType.IMAGE, post } as Attachment;

            repo.create.mockReturnValue(created);
            repo.save.mockResolvedValue(created);

            const result = await service.create(dto, post);

            expect(repo.create).toHaveBeenCalledWith({ post, filePath: 'file.jpg', type: AttachmentType.IMAGE });
            expect(repo.save).toHaveBeenCalledWith(created);
            expect(result).toBe(created);
        });
    });

    describe('findAll', () => {
        it('should return all attachments', async () => {
            const attachments = [{ id: '1' }] as Attachment[];
            repo.find.mockResolvedValue(attachments);

            const result = await service.findAll();

            expect(repo.find).toHaveBeenCalled();
            expect(result).toBe(attachments);
        });
    });

    describe('findOne', () => {
        it('should return one attachment by id', async () => {
            const attachment = { id: '1' } as Attachment;
            repo.findOne.mockResolvedValue(attachment);

            const result = await service.findOne('1');

            expect(repo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
            expect(result).toBe(attachment);
        });
    });

    describe('update', () => {
        it('should update an attachment', async () => {
            const dto: UpdateAttachmentDto = { url: 'newfile.jpg' };
            repo.update.mockResolvedValue(undefined as any);

            await service.update('1', dto);

            expect(repo.update).toHaveBeenCalledWith('1', { filePath: 'newfile.jpg' });
        });
    });

    describe('remove', () => {
        it('should delete an attachment', async () => {
            repo.delete.mockResolvedValue(undefined as any);

            await service.remove('1');

            expect(repo.delete).toHaveBeenCalledWith('1');
        });
    });
});