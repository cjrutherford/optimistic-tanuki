import { Test, TestingModule } from '@nestjs/testing';
import { PalettesController } from './palettes.controller';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

describe('PalettesController', () => {
  let controller: PalettesController;
  const mockPalettes = [
    {
      name: 'Test Palette 1',
      description: 'A test palette',
      accent: '#ff0000',
      complementary: '#00ff00',
      tertiary: '#0000ff',
    },
    {
      name: 'Test Palette 2',
      description: 'Another test palette',
      accent: '#00ff00',
      complementary: '#ff0000',
      tertiary: '#0000ff',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PalettesController],
    }).compile();

    controller = module.get<PalettesController>(PalettesController);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all palettes', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(mockPalettes)
      );

      const result = await controller.getAll();
      expect(result).toEqual(mockPalettes);
    });

    it('should return empty array if file does not exist', async () => {
      const error: NodeJS.ErrnoException = new Error('ENOENT');
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const result = await controller.getAll();
      expect(result).toEqual([]);
    });

    it('should throw HttpException on read error', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Read error'));

      await expect(controller.getAll()).rejects.toThrow(HttpException);
    });
  });

  describe('getByName', () => {
    it('should return palette by name', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(mockPalettes)
      );

      const result = await controller.getByName('Test Palette 1');
      expect(result).toEqual(mockPalettes[0]);
    });

    it('should return null if palette not found', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(mockPalettes)
      );

      const result = await controller.getByName('Non-existent');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new palette', async () => {
      const newPalette = {
        name: 'New Palette',
        description: 'A new palette',
        accent: '#ff00ff',
        complementary: '#00ffff',
        tertiary: '#ffff00',
      };

      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(mockPalettes)
      );
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.create(newPalette);
      expect(result).toEqual(newPalette);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw conflict error if palette already exists', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(mockPalettes)
      );

      await expect(
        controller.create({ ...mockPalettes[0] })
      ).rejects.toThrow(
        new HttpException('Palette already exists', HttpStatus.CONFLICT)
      );
    });
  });

  describe('replaceAll', () => {
    it('should replace all palettes', async () => {
      const newPalettes = [
        {
          name: 'Replacement Palette',
          description: 'A replacement',
          accent: '#ffffff',
          complementary: '#000000',
          tertiary: '#888888',
        },
      ];

      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.replaceAll(newPalettes);
      expect(result).toEqual(newPalettes);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw bad request if payload is not an array', async () => {
      await expect(controller.replaceAll({} as any)).rejects.toThrow(
        new HttpException('Invalid payload', HttpStatus.BAD_REQUEST)
      );
    });
  });

  describe('delete', () => {
    it('should delete a palette by name', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(mockPalettes)
      );
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.delete('Test Palette 1');
      expect(result).toEqual({ deleted: 'Test Palette 1' });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw not found error if palette does not exist', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(mockPalettes)
      );

      await expect(controller.delete('Non-existent')).rejects.toThrow(
        new HttpException('Palette not found', HttpStatus.NOT_FOUND)
      );
    });
  });
});
