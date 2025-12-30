import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from './products.service';
import { ProductEntity } from './entities/product.entity';
import { CreateProductDto, UpdateProductDto } from '@optimistic-tanuki/models';

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: Repository<ProductEntity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(ProductEntity),
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

    service = module.get<ProductsService>(ProductsService);
    repository = module.get<Repository<ProductEntity>>(
      getRepositoryToken(ProductEntity)
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product', async () => {
      const dto: CreateProductDto = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        type: 'physical',
        stock: 10,
      };

      const mockProduct = { id: '1', ...dto };
      jest.spyOn(repository, 'create').mockReturnValue(mockProduct as any);
      jest.spyOn(repository, 'save').mockResolvedValue(mockProduct as any);

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(repository.save).toHaveBeenCalledWith(mockProduct);
      expect(result).toEqual(mockProduct);
    });
  });

  describe('findAll', () => {
    it('should return an array of active products', async () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', active: true },
        { id: '2', name: 'Product 2', active: true },
      ];

      jest.spyOn(repository, 'find').mockResolvedValue(mockProducts as any);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({ where: { active: true } });
      expect(result).toEqual(mockProducts);
    });
  });

  describe('findOne', () => {
    it('should return a single product', async () => {
      const mockProduct = { id: '1', name: 'Product 1', active: true };

      jest.spyOn(repository, 'findOne').mockResolvedValue(mockProduct as any);

      const result = await service.findOne('1');

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(mockProduct);
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const dto: UpdateProductDto = {
        name: 'Updated Product',
        price: 149.99,
      };

      const mockProduct = { id: '1', ...dto };
      jest.spyOn(repository, 'update').mockResolvedValue(undefined);
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockProduct as any);

      const result = await service.update('1', dto);

      expect(repository.update).toHaveBeenCalledWith('1', dto);
      expect(result).toEqual(mockProduct);
    });
  });

  describe('remove', () => {
    it('should delete a product', async () => {
      jest.spyOn(repository, 'delete').mockResolvedValue(undefined);

      await service.remove('1');

      expect(repository.delete).toHaveBeenCalledWith('1');
    });
  });
});
