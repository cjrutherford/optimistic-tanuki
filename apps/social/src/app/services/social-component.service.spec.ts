import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { SocialComponentService } from './social-component.service';
import { SocialComponent } from '../../entities/social-component.entity';
import { Post } from '../../entities/post.entity';

describe('SocialComponentService', () => {
  let service: SocialComponentService;
  let componentRepo: jest.Mocked<Repository<SocialComponent>>;
  let postRepo: jest.Mocked<Repository<Post>>;

  const makeComponent = (
    overrides: Partial<SocialComponent> = {}
  ): SocialComponent =>
    ({
      id: 'sc-1',
      postId: 'post-1',
      instanceId: 'inst-1',
      componentType: 'poll',
      componentData: { foo: 'bar' },
      position: 0,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      ...overrides,
    } as SocialComponent);

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialComponentService,
        {
          provide: getRepositoryToken(SocialComponent),
          useFactory: () => ({
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            delete: jest.fn(),
          }),
        },
        {
          provide: getRepositoryToken(Post),
          useFactory: () => ({ findOne: jest.fn() }),
        },
      ],
    }).compile();

    service = module.get<SocialComponentService>(SocialComponentService);
    componentRepo = module.get(getRepositoryToken(SocialComponent));
    postRepo = module.get(getRepositoryToken(Post));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = {
      postId: 'post-1',
      instanceId: 'inst-1',
      componentType: 'poll',
      componentData: { foo: 'bar' },
      position: 0,
    };

    it('creates and maps the component to a DTO', async () => {
      const component = makeComponent();
      postRepo.findOne.mockResolvedValue({ id: 'post-1' } as Post);
      componentRepo.findOne.mockResolvedValue(null);
      componentRepo.create.mockReturnValue(component);
      componentRepo.save.mockResolvedValue(component);

      const result = await service.create(dto);

      expect(postRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'post-1' },
      });
      expect(componentRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        id: 'sc-1',
        postId: 'post-1',
        instanceId: 'inst-1',
        componentType: 'poll',
        componentData: { foo: 'bar' },
        position: 0,
        createdAt: component.createdAt,
        updatedAt: component.updatedAt,
      });
    });

    it('throws NotFoundException when the post does not exist', async () => {
      postRepo.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(componentRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException on a duplicate instance id', async () => {
      postRepo.findOne.mockResolvedValue({ id: 'post-1' } as Post);
      componentRepo.findOne.mockResolvedValue(makeComponent());

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        BadRequestException
      );
    });

    it('wraps unexpected failures in an RpcException', async () => {
      postRepo.findOne.mockRejectedValue(new Error('db down'));

      await expect(service.create(dto)).rejects.toBeInstanceOf(RpcException);
    });

    it('reports "Unknown error" when the failure carries no message', async () => {
      postRepo.findOne.mockRejectedValue({});

      await expect(service.create(dto)).rejects.toMatchObject({
        error: { details: 'Unknown error' },
      });
    });
  });

  describe('findByPostId', () => {
    it('returns mapped components ordered by position', async () => {
      componentRepo.find.mockResolvedValue([makeComponent()]);

      const result = await service.findByPostId('post-1');

      expect(componentRepo.find).toHaveBeenCalledWith({
        where: { postId: 'post-1' },
        order: { position: 'ASC', createdAt: 'ASC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sc-1');
    });

    it('wraps repository failures in an RpcException', async () => {
      componentRepo.find.mockRejectedValue(new Error('boom'));

      await expect(service.findByPostId('post-1')).rejects.toBeInstanceOf(
        RpcException
      );
    });
  });

  describe('findOne', () => {
    it('returns the mapped component', async () => {
      componentRepo.findOne.mockResolvedValue(makeComponent());

      const result = await service.findOne('sc-1');

      expect(result.id).toBe('sc-1');
    });

    it('throws NotFoundException when absent', async () => {
      componentRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('sc-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('wraps repository failures in an RpcException', async () => {
      componentRepo.findOne.mockRejectedValue(new Error('boom'));

      await expect(service.findOne('sc-1')).rejects.toBeInstanceOf(
        RpcException
      );
    });
  });

  describe('update', () => {
    it('merges the update onto the loaded entity and saves it', async () => {
      const component = makeComponent();
      componentRepo.findOne.mockResolvedValue(component);
      componentRepo.save.mockImplementation(async (c: any) => c);

      const result = await service.update('sc-1', { position: 4 });

      expect(componentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sc-1', position: 4 })
      );
      expect(result.position).toBe(4);
    });

    it('throws NotFoundException when absent', async () => {
      componentRepo.findOne.mockResolvedValue(null);

      await expect(service.update('sc-1', {})).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('wraps save failures in an RpcException', async () => {
      componentRepo.findOne.mockResolvedValue(makeComponent());
      componentRepo.save.mockRejectedValue(new Error('boom'));

      await expect(service.update('sc-1', {})).rejects.toBeInstanceOf(
        RpcException
      );
    });
  });

  describe('remove', () => {
    it('removes the loaded entity', async () => {
      const component = makeComponent();
      componentRepo.findOne.mockResolvedValue(component);
      componentRepo.remove.mockResolvedValue(component);

      await service.remove('sc-1');

      expect(componentRepo.remove).toHaveBeenCalledWith(component);
    });

    it('throws NotFoundException when absent', async () => {
      componentRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('sc-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('wraps repository failures in an RpcException', async () => {
      componentRepo.findOne.mockResolvedValue(makeComponent());
      componentRepo.remove.mockRejectedValue(new Error('boom'));

      await expect(service.remove('sc-1')).rejects.toBeInstanceOf(RpcException);
    });
  });

  describe('removeByPostId', () => {
    it('deletes every component for the post', async () => {
      componentRepo.delete.mockResolvedValue({} as any);

      await service.removeByPostId('post-1');

      expect(componentRepo.delete).toHaveBeenCalledWith({ postId: 'post-1' });
    });

    it('wraps repository failures in an RpcException', async () => {
      componentRepo.delete.mockRejectedValue(new Error('boom'));

      await expect(service.removeByPostId('post-1')).rejects.toBeInstanceOf(
        RpcException
      );
    });
  });

  describe('findByQuery', () => {
    it('builds where conditions from the supplied filters only', async () => {
      componentRepo.find.mockResolvedValue([]);

      await service.findByQuery({
        id: 'sc-1',
        postId: 'post-1',
        instanceId: 'inst-1',
        componentType: 'poll',
      });

      expect(componentRepo.find).toHaveBeenCalledWith({
        where: {
          id: 'sc-1',
          postId: 'post-1',
          instanceId: 'inst-1',
          componentType: 'poll',
        },
        order: { position: 'ASC', createdAt: 'ASC' },
      });
    });

    it('uses an empty where clause when no filters are given', async () => {
      componentRepo.find.mockResolvedValue([makeComponent()]);

      const result = await service.findByQuery({});

      expect(componentRepo.find).toHaveBeenCalledWith({
        where: {},
        order: { position: 'ASC', createdAt: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });

    it('wraps repository failures in an RpcException', async () => {
      componentRepo.find.mockRejectedValue(new Error('boom'));

      await expect(service.findByQuery({})).rejects.toBeInstanceOf(
        RpcException
      );
    });
  });
});
