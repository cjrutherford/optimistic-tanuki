import { Test, TestingModule } from '@nestjs/testing';
import { BlogComponentController } from './blog-component.controller';
import { ClientProxy } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { CreateBlogComponentDto, UpdateBlogComponentDto } from '@optimistic-tanuki/models';
import { of } from 'rxjs';

describe('BlogComponentController', () => {
  let controller: BlogComponentController;
  let clientProxy: jest.Mocked<ClientProxy>;
  let logger: jest.Mocked<Logger>;

  const mockUser = {
    userId: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
  };

  const mockComponent = {
    id: 'component-1',
    blogPostId: 'post-1',
    instanceId: 'instance-1',
    componentType: 'author-profile',
    componentData: { name: 'John Doe', bio: 'Test bio' },
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockClientProxy = {
      connect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlogComponentController],
      providers: [
        {
          provide: ServiceTokens.BLOG_SERVICE,
          useValue: mockClientProxy,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<BlogComponentController>(BlogComponentController);
    clientProxy = module.get<ClientProxy>(ServiceTokens.BLOG_SERVICE) as jest.Mocked<ClientProxy>;
    logger = module.get<Logger>(Logger) as jest.Mocked<Logger>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createBlogComponent', () => {
    it('should create a blog component', async () => {
      const createDto: CreateBlogComponentDto = {
        blogPostId: 'post-1',
        instanceId: 'instance-1',
        componentType: 'author-profile',
        componentData: { name: 'John Doe', bio: 'Test bio' },
        position: 0,
      };

      clientProxy.send.mockReturnValue(of(mockComponent));

      const result = await controller.createBlogComponent(createDto, mockUser);

      expect(result).toEqual(mockComponent);
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: 'blog-component.create' },
        createDto
      );
    });
  });

  describe('getBlogComponents', () => {
    it('should get components for a post', async () => {
      clientProxy.send.mockReturnValue(of([mockComponent]));

      const result = await controller.getBlogComponents('post-1');

      expect(result).toEqual([mockComponent]);
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: 'blog-component.findByPost' },
        { postId: 'post-1' }
      );
    });
  });

  describe('getBlogComponent', () => {
    it('should get a single blog component', async () => {
      clientProxy.send.mockReturnValue(of(mockComponent));

      const result = await controller.getBlogComponent('component-1');

      expect(result).toEqual(mockComponent);
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: 'blog-component.find' },
        { id: 'component-1' }
      );
    });
  });

  describe('updateBlogComponent', () => {
    it('should update a blog component', async () => {
      const updateDto: UpdateBlogComponentDto = {
        componentData: { name: 'Jane Doe', bio: 'Updated bio' },
        position: 1,
      };

      const updatedComponent = { ...mockComponent, ...updateDto };
      clientProxy.send.mockReturnValue(of(updatedComponent));

      const result = await controller.updateBlogComponent(
        'component-1',
        updateDto,
        mockUser
      );

      expect(result).toEqual(updatedComponent);
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: 'blog-component.update' },
        { id: 'component-1', dto: updateDto }
      );
    });
  });

  describe('deleteBlogComponent', () => {
    it('should delete a blog component', async () => {
      clientProxy.send.mockReturnValue(of(undefined));

      const result = await controller.deleteBlogComponent('component-1', mockUser);

      expect(result).toBeUndefined();
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: 'blog-component.delete' },
        { id: 'component-1' }
      );
    });
  });

  describe('deleteComponentsByPost', () => {
    it('should delete all components for a post', async () => {
      clientProxy.send.mockReturnValue(of(undefined));

      const result = await controller.deleteComponentsByPost('post-1', mockUser);

      expect(result).toBeUndefined();
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: 'blog-component.deleteByPost' },
        { postId: 'post-1' }
      );
    });
  });

  describe('findComponentsByQuery', () => {
    it('should find components by query', async () => {
      const query = {
        blogPostId: 'post-1',
        componentType: 'author-profile',
      };

      clientProxy.send.mockReturnValue(of([mockComponent]));

      const result = await controller.findComponentsByQuery(query);

      expect(result).toEqual([mockComponent]);
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: 'blog-component.findByQuery' },
        query
      );
    });
  });
});