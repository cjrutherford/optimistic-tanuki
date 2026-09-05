import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BusinessThemeService } from './business-theme.service';
import { BusinessTheme } from '../../entities/business-theme.entity';
import { BusinessPage } from '../../entities/business-page.entity';

/**
 * Explicitly named mock surfaces rather than index-signature records, so the
 * doubles stay type-checked under `noPropertyAccessFromIndexSignature`.
 */
interface MockThemeRepository {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
}

interface MockBusinessPageRepository {
  update: jest.Mock;
}

function buildTheme(overrides: Partial<BusinessTheme> = {}): BusinessTheme {
  return {
    id: 'theme-1',
    businessPageId: 'business-page-1',
    personalityId: null,
    primaryColor: null,
    accentColor: null,
    backgroundColor: null,
    customCss: null,
    customFontFamily: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as BusinessTheme;
}

async function createHarness() {
  const themeRepository: MockThemeRepository = {
    create: jest.fn((input: object) => input),
    save: jest.fn(async (input: object) => ({ id: 'theme-1', ...input })),
    findOne: jest.fn(async () => null),
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
  const businessPageRepository: MockBusinessPageRepository = {
    update: jest.fn(async () => ({ affected: 1 })),
  };

  // Both repositories are injected by entity token, so they must be
  // overridden by the same tokens rather than by class.
  const moduleRef = await Test.createTestingModule({
    providers: [
      BusinessThemeService,
      { provide: getRepositoryToken(BusinessTheme), useValue: themeRepository },
      {
        provide: getRepositoryToken(BusinessPage),
        useValue: businessPageRepository,
      },
    ],
  }).compile();

  return {
    service: moduleRef.get(BusinessThemeService),
    themeRepository,
    businessPageRepository,
  };
}

describe('BusinessThemeService.createTheme', () => {
  it('persists the theme and links it back onto the owning business page', async () => {
    const { service, themeRepository, businessPageRepository } =
      await createHarness();

    const saved = await service.createTheme('business-page-1', {
      personalityId: 'playful',
      primaryColor: '#ff8800',
    });

    expect(themeRepository.create).toHaveBeenCalledWith({
      businessPageId: 'business-page-1',
      personalityId: 'playful',
      primaryColor: '#ff8800',
    });
    expect(saved.id).toBe('theme-1');
    // The back-reference is what lets a page resolve its theme without a
    // reverse lookup, so it must be written with the saved theme's id.
    expect(businessPageRepository.update).toHaveBeenCalledWith(
      'business-page-1',
      { businessThemeId: 'theme-1' }
    );
  });
});

describe('BusinessThemeService reads and writes', () => {
  it('reads a theme by its owning business page', async () => {
    const theme = buildTheme();
    const { service, themeRepository } = await createHarness();
    themeRepository.findOne.mockResolvedValue(theme);

    await expect(
      service.getThemeByBusinessPageId('business-page-1')
    ).resolves.toBe(theme);
    expect(themeRepository.findOne).toHaveBeenCalledWith({
      where: { businessPageId: 'business-page-1' },
    });
  });

  it('applies an update then returns the re-read row', async () => {
    const updated = buildTheme({ accentColor: '#00aaff' });
    const { service, themeRepository } = await createHarness();
    themeRepository.findOne.mockResolvedValue(updated);

    await expect(
      service.updateTheme('theme-1', { accentColor: '#00aaff' })
    ).resolves.toBe(updated);

    expect(themeRepository.update).toHaveBeenCalledWith('theme-1', {
      accentColor: '#00aaff',
    });
    // Re-read by primary key, not by business page, so the caller sees the
    // persisted row rather than the patch it sent.
    expect(themeRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'theme-1' },
    });
  });
});

describe('BusinessThemeService.deleteTheme', () => {
  it('clears the business page back-reference before deleting the theme', async () => {
    const theme = buildTheme();
    const { service, themeRepository, businessPageRepository } =
      await createHarness();
    themeRepository.findOne.mockResolvedValue(theme);

    await service.deleteTheme('theme-1');

    expect(businessPageRepository.update).toHaveBeenCalledWith(
      'business-page-1',
      { businessThemeId: null }
    );
    expect(themeRepository.delete).toHaveBeenCalledWith('theme-1');
  });

  it('still issues the delete when the theme row is already gone', async () => {
    const { service, themeRepository, businessPageRepository } =
      await createHarness();

    await service.deleteTheme('theme-1');

    expect(businessPageRepository.update).not.toHaveBeenCalled();
    expect(themeRepository.delete).toHaveBeenCalledWith('theme-1');
  });
});

describe('BusinessThemeService.generateCssVariables', () => {
  it('emits a custom property for every colour and font the theme sets', () => {
    const cssVars = new BusinessThemeService(
      null as never,
      null as never
    ).generateCssVariables(
      buildTheme({
        primaryColor: '#111111',
        accentColor: '#222222',
        backgroundColor: '#333333',
        customFontFamily: 'Inter',
      })
    );

    expect(cssVars).toEqual({
      '--business-primary': '#111111',
      '--business-accent': '#222222',
      '--business-background': '#333333',
      '--business-font-family': 'Inter',
    });
  });

  it.each([
    ['primaryColor', '--business-primary'],
    ['accentColor', '--business-accent'],
    ['backgroundColor', '--business-background'],
    ['customFontFamily', '--business-font-family'],
  ])(
    'emits only %s when it is the sole value set',
    (field, expectedCssVariable) => {
      const cssVars = new BusinessThemeService(
        null as never,
        null as never
      ).generateCssVariables(
        buildTheme({ [field]: 'value' } as Partial<BusinessTheme>)
      );

      expect(Object.keys(cssVars)).toEqual([expectedCssVariable]);
    }
  );

  it('emits nothing for a theme with no styling set, and never a css-only variable', () => {
    const cssVars = new BusinessThemeService(
      null as never,
      null as never
      // customCss is stored but is not surfaced as a custom property.
    ).generateCssVariables(buildTheme({ customCss: '.a { color: red; }' }));

    expect(cssVars).toEqual({});
  });
});
