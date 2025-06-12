import { Test, TestingModule } from '@nestjs/testing';
import { CommentService } from './comment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Comment } from '../../entities/comment.entity';
import { Post } from '../../entities/post.entity';
import { RpcException } from '@nestjs/microservices';

const mockCommentRepo = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
});

const mockPostRepo = () => ({
    findOne: jest.fn(),
});

describe('CommentService', () => {
    let service: CommentService;
    let commentRepo: ReturnType<typeof mockCommentRepo>;
    let postRepo: ReturnType<typeof mockPostRepo>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CommentService,
                { provide: getRepositoryToken(Comment), useFactory: mockCommentRepo },
                { provide: getRepositoryToken(Post), useFactory: mockPostRepo },
            ],
        }).compile();

        service = module.get<CommentService>(CommentService);
        commentRepo = module.get(getRepositoryToken(Comment));
        postRepo = module.get(getRepositoryToken(Post));
    });

    describe('create', () => {
        it('should create and save a comment if post exists', async () => {
            const dto = { postId: '1', content: 'test' } as any;
            const post = { id: '1' };
            const comment = { id: '2', ...dto, post };
            postRepo.findOne.mockResolvedValue(post);
            commentRepo.create.mockReturnValue(comment);
            commentRepo.save.mockResolvedValue(comment);

            const result = await service.create(dto);

            expect(postRepo.findOne).toHaveBeenCalledWith({ where: { id: dto.postId } });
            expect(commentRepo.create).toHaveBeenCalledWith({ ...dto, post });
            expect(commentRepo.save).toHaveBeenCalledWith(comment);
            expect(result).toEqual(comment);
        });

        it('should throw RpcException if post does not exist', async () => {
            postRepo.findOne.mockResolvedValue(null);
            const dto = { postId: '1', content: 'test' } as any;

            await expect(service.create(dto)).rejects.toThrow(RpcException);
        });

        it('should throw RpcException on error', async () => {
            postRepo.findOne.mockRejectedValue(new Error('fail'));
            const dto = { postId: '1', content: 'test' } as any;

            await expect(service.create(dto)).rejects.toThrow(RpcException);
        });
    });

    describe('findAll', () => {
        it('should return all comments', async () => {
            const comments = [{ id: '1' }, { id: '2' }];
            commentRepo.find.mockResolvedValue(comments);

            const result = await service.findAll();

            expect(commentRepo.find).toHaveBeenCalled();
            expect(result).toEqual(comments);
        });
    });

    describe('findOne', () => {
        it('should return a comment by id', async () => {
            const comment = { id: '1' };
            commentRepo.findOne.mockResolvedValue(comment);

            const result = await service.findOne('1');

            expect(commentRepo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
            expect(result).toEqual(comment);
        });
    });

    describe('update', () => {
        it('should update a comment', async () => {
            commentRepo.update.mockResolvedValue(undefined);

            await service.update('1', { content: 'updated' } as any);

            expect(commentRepo.update).toHaveBeenCalledWith('1', { content: 'updated' });
        });
    });

    describe('remove', () => {
        it('should delete a comment', async () => {
            commentRepo.delete.mockResolvedValue(undefined);

            await service.remove('1');

            expect(commentRepo.delete).toHaveBeenCalledWith('1');
        });
    });
});