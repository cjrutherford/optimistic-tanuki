import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from './products.service';
import { ProductEntity } from './entities/product.entity';
import { CreateProductDto, UpdateProductDto } from '@optimistic-tanuki/models';
import { CatalogEntity } from '../catalog/entities/catalog.entity';

const ownerScope = {
  ownerId: 'owner-profile',
  workspaceId: 'workspace-id',
  appScope: 'business-site',
};

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
        {
          provide: getRepositoryToken(CatalogEntity),
          useValue: {
            findOne: jest.fn(),
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
        priceCents: 9999,
        type: 'physical',
        stock: 10,
      };

      const mockProduct = { id: '1', ...dto };
      jest.spyOn(repository, 'create').mockReturnValue(mockProduct as any);
      jest.spyOn(repository, 'save').mockResolvedValue(mockProduct as any);

      jest
        .spyOn(repository as any, 'create')
        .mockReturnValue(mockProduct as any);
      const result = await service.create({
        createProductDto: dto,
        scope: ownerScope,
      });

      expect(repository.create).toHaveBeenCalledWith({
        ...dto,
        ownerId: ownerScope.ownerId,
      });
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

      const result = await service.findAll({ ...ownerScope, public: false });

      expect(repository.find).toHaveBeenCalledWith({
        where: { active: true, ownerId: ownerScope.ownerId },
      });
      expect(result).toEqual(mockProducts);
    });
  });

  it('filters active products by catalog when a catalog id is supplied', async () => {
    await service.findAll({ catalogId: 'catalog-1', public: true });

    expect(repository.find).toHaveBeenCalledWith({
      where: { active: true, catalogId: 'catalog-1' },
    });
  });

  describe('findOne', () => {
    it('should return a single product', async () => {
      const mockProduct = { id: '1', name: 'Product 1', active: true };

      jest.spyOn(repository, 'findOne').mockResolvedValue(mockProduct as any);

      const result = await service.findOne({ id: '1', ...ownerScope });

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: '1', ownerId: ownerScope.ownerId },
      });
      expect(result).toEqual(mockProduct);
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const dto: UpdateProductDto = {
        name: 'Updated Product',
        priceCents: 14999,
      };

      const mockProduct = { id: '1', ...dto };
      jest.spyOn(repository, 'update').mockResolvedValue(undefined);
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockProduct as any);

      const result = await service.update('1', dto, ownerScope);

      expect(repository.update).toHaveBeenCalledWith(
        { id: '1', ownerId: ownerScope.ownerId },
        dto
      );
      expect(result).toEqual(mockProduct);
    });
  });

  describe('remove', () => {
    it('should delete a product', async () => {
      jest.spyOn(repository, 'delete').mockResolvedValue(undefined);

      await service.remove('1', ownerScope);

      expect(repository.delete).toHaveBeenCalledWith({
        id: '1',
        ownerId: ownerScope.ownerId,
      });
    });
  });
});
