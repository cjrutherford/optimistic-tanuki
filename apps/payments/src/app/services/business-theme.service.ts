import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessTheme } from '../../entities/business-theme.entity';
import { BusinessPage } from '../../entities/business-page.entity';

@Injectable()
export class BusinessThemeService {
  private readonly logger = new Logger(BusinessThemeService.name);

  constructor(
    @InjectRepository(BusinessTheme)
    private readonly themeRepository: Repository<BusinessTheme>,
    @InjectRepository(BusinessPage)
    private readonly businessPageRepository: Repository<BusinessPage>
  ) {}

  async createTheme(
    businessPageId: string,
    data: {
      personalityId?: string;
      primaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
      customCss?: string;
      customFontFamily?: string;
    }
  ): Promise<BusinessTheme> {
    const theme = this.themeRepository.create({
      businessPageId,
      ...data,
    });
    const savedTheme = await this.themeRepository.save(theme);

    await this.businessPageRepository.update(businessPageId, {
      businessThemeId: savedTheme.id,
    });

    return savedTheme;
  }

  async getThemeByBusinessPageId(
    businessPageId: string
  ): Promise<BusinessTheme | null> {
    return this.themeRepository.findOne({
      where: { businessPageId },
    });
  }

  async updateTheme(
    themeId: string,
    data: {
      personalityId?: string;
      primaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
      customCss?: string;
      customFontFamily?: string;
    }
  ): Promise<BusinessTheme | null> {
    await this.themeRepository.update(themeId, data);
    return this.themeRepository.findOne({ where: { id: themeId } });
  }

  async deleteTheme(themeId: string): Promise<void> {
    const theme = await this.themeRepository.findOne({
      where: { id: themeId },
    });
    if (theme) {
      await this.businessPageRepository.update(theme.businessPageId, {
        businessThemeId: null,
      });
    }
    await this.themeRepository.delete(themeId);
  }

  generateCssVariables(theme: BusinessTheme): Record<string, string> {
    const cssVars: Record<string, string> = {};

    if (theme.primaryColor) {
      cssVars['--business-primary'] = theme.primaryColor;
    }
    if (theme.accentColor) {
      cssVars['--business-accent'] = theme.accentColor;
    }
    if (theme.backgroundColor) {
      cssVars['--business-background'] = theme.backgroundColor;
    }
    if (theme.customFontFamily) {
      cssVars['--business-font-family'] = theme.customFontFamily;
    }

    return cssVars;
  }
}
