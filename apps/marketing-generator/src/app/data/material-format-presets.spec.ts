import { MATERIAL_FORMAT_PRESETS } from './material-format-presets';

describe('MATERIAL_FORMAT_PRESETS', () => {
  it('defines advertisement-oriented template families and layout variants', () => {
    expect(MATERIAL_FORMAT_PRESETS.flyer[0]).toEqual(
      expect.objectContaining({
        templateFamily: 'print-flyer',
      })
    );
    expect(MATERIAL_FORMAT_PRESETS.flyer[0].layoutVariants).toEqual(
      expect.arrayContaining([
        'issue-led',
        'community-bulletin',
        'offer-dominant',
      ])
    );

    expect(MATERIAL_FORMAT_PRESETS.brochure[0]).toEqual(
      expect.objectContaining({
        templateFamily: 'print-brochure',
      })
    );
    expect(MATERIAL_FORMAT_PRESETS['business-card'][0]).toEqual(
      expect.objectContaining({
        templateFamily: 'print-business-card',
      })
    );

    expect(MATERIAL_FORMAT_PRESETS['web-ad'][0]).toEqual(
      expect.objectContaining({
        templateFamily: 'web-display-ad',
      })
    );
    expect(MATERIAL_FORMAT_PRESETS['web-ad'][1].layoutVariants).toEqual(
      expect.arrayContaining(['announcement-strip'])
    );
  });
});
