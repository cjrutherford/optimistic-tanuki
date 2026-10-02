import { buildLocalities } from './localities';

describe('buildLocalities', () => {
  it('is empty-safe, and says so, when no directory is configured', () => {
    const warn = jest.fn();
    const localities = buildLocalities(null, { warn });
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/CIVIC_LOCALITIES_DIR/u)
    );
    expect(localities.find('town-ga')).toBeUndefined();
    expect(localities.editions()).toEqual([]);
    expect(() => localities.get('town-ga')).toThrow(/unknown locality/u);
  });
});
