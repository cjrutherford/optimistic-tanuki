/**
 * Personalities Controller
 * Serves personality configurations via API
 */

import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  PREDEFINED_PERSONALITIES,
  getPersonalityById,
  getDefaultPersonality,
} from '@optimistic-tanuki/theme-models';

@Controller('personalities')
export class PersonalitiesController {
  /**
   * Get all personalities
   */
  @Get()
  async getAll() {
    return {
      personalities: PREDEFINED_PERSONALITIES,
      defaultPersonalityId: getDefaultPersonality().id,
      version: '1.0.0',
    };
  }

  /**
   * Get a specific personality by ID
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    const personality = getPersonalityById(id);

    if (!personality) {
      throw new HttpException(
        `Personality with ID "${id}" not found`,
        HttpStatus.NOT_FOUND
      );
    }

    return personality;
  }

  /**
   * Get default personality
   */
  @Get('default')
  async getDefault() {
    return getDefaultPersonality();
  }

  /**
   * Get personalities by category
   */
  @Get('category/:category')
  async getByCategory(@Param('category') category: string) {
    const validCategories = ['professional', 'creative', 'casual', 'technical'];

    if (!validCategories.includes(category)) {
      throw new HttpException(
        `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }

    const personalities = PREDEFINED_PERSONALITIES.filter(
      (p) => p.category === category
    );

    return {
      category,
      personalities,
      count: personalities.length,
    };
  }

  /**
   * Get classic personality (original design system)
   */
  @Get('classic')
  async getClassic() {
    const classic = getPersonalityById('classic');
    if (!classic) {
      throw new HttpException(
        'Classic personality not found',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return classic;
  }
}
