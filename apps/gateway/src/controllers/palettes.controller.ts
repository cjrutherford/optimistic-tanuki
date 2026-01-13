import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

// Resolve relative to workspace root. Do NOT use a leading slash in the second arg
// because that makes the path absolute from the filesystem root.
const PALETTES_PATH = path.resolve(__dirname, './assets/palettes.json');


@Controller('palettes')
export class PalettesController {
  private async readFile(): Promise<any[]> {
    try {
      console.log('Reading palettes from', PALETTES_PATH);
      const raw = await fs.readFile(PALETTES_PATH, 'utf-8');
      console.log('Palettes data:', raw);
      return JSON.parse(raw || '[]');
    } catch (err: any) {
      if (err.code === 'ENOENT') return [];
      throw new HttpException(
        'Failed to read palettes',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async writeFile(data: any[]) {
    try {
      await fs.writeFile(PALETTES_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      throw new HttpException(
        'Failed to write palettes',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  async getAll() {
    return await this.readFile();
  }

  @Get(':name')
  async getByName(@Param('name') name: string) {
    const all = await this.readFile();
    return all.find((p: any) => p.name === name) || null;
  }

  @Post()
  async create(@Body() palette: any) {
    const all = await this.readFile();
    if (all.some((p) => p.name === palette.name)) {
      throw new HttpException('Palette already exists', HttpStatus.CONFLICT);
    }
    all.push(palette);
    await this.writeFile(all);
    return palette;
  }

  @Put()
  async replaceAll(@Body() palettes: any[]) {
    if (!Array.isArray(palettes)) {
      throw new HttpException('Invalid payload', HttpStatus.BAD_REQUEST);
    }
    await this.writeFile(palettes);
    return palettes;
  }

  @Delete(':name')
  async delete(@Param('name') name: string) {
    const all = await this.readFile();
    const filtered = all.filter((p) => p.name !== name);
    if (filtered.length === all.length) {
      throw new HttpException('Palette not found', HttpStatus.NOT_FOUND);
    }
    await this.writeFile(filtered);
    return { deleted: name };
  }
}
