import { Attachment, AttachmentType } from '../../entities/attachment.entity';
import { CreateAttachmentDto, UpdateAttachmentDto } from '@optimistic-tanuki/models';

import { AttachmentService } from './attachment.service';
import { Post } from '../../entities/post.entity';
import { Repository } from 'typeorm';

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
  let repo: ReturnType<typeof mockAttachmentRepo>;

  beforeEach(() => {
    repo = mockAttachmentRepo();
    service = new AttachmentService(repo as unknown as Repository<Attachment>);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save an attachment', async () => {
      const dto: CreateAttachmentDto = { url: 'file.png', type: AttachmentType.IMAGE, post: '1' };
      const post = { id: '1' } as Post;
      const created = { id: '2', name: 'test', filePath: 'file.png', type: AttachmentType.IMAGE, post } as Attachment;
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);
      const result = await service.create(dto, post);
      expect(repo.create).toHaveBeenCalledWith({ post, filePath: 'file.png', type: AttachmentType.IMAGE });
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
      repo.update.mockResolvedValue(undefined);
      const dto: UpdateAttachmentDto = { url: 'new.png' };
      await service.update('1', dto);
      expect(repo.update).toHaveBeenCalledWith('1', { filePath: 'new.png' });
    });
  });

  describe('remove', () => {
    it('should delete an attachment', async () => {
      repo.delete.mockResolvedValue(undefined);
      await service.remove('1');
      expect(repo.delete).toHaveBeenCalledWith('1');
    });
  });
});
