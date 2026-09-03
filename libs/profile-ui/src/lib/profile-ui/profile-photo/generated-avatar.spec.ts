import { avatarFor, hueOf, initialsOf } from './generated-avatar';

/**
 * A picture for somebody who has not got one.
 *
 * The fallback used to be a link to placehold.co: an external round trip for a
 * grey rectangle, which in a container with no route out does not resolve at
 * all. Every persona hit it, because a persona telos has no field to hold a
 * photograph.
 */
describe('generated avatar', () => {
  describe('initialsOf', () => {
    it('takes the first letter of the first two words', () => {
      expect(initialsOf('Patricia P. Project')).toBe('PP');
    });

    it('takes one when there is only one', () => {
      expect(initialsOf('Assistant')).toBe('A');
    });

    it('ignores punctuation between names', () => {
      expect(initialsOf('Dr. Ada Scholar')).toBe('DA');
    });

    it('says something rather than nothing for an empty name', () => {
      expect(initialsOf('')).toBe('?');
      expect(initialsOf('   ')).toBe('?');
      expect(initialsOf('!!!')).toBe('?');
    });
  });

  describe('hueOf', () => {
    it('gives the same name the same colour every time', () => {
      // Across a reload and across the server render, because a colour that
      // changes between the two is a visible flash.
      expect(hueOf('Patricia P. Project')).toBe(hueOf('Patricia P. Project'));
    });

    it('gives different names different colours', () => {
      expect(hueOf('Patricia P. Project')).not.toBe(hueOf('Percy Verse'));
    });

    it('stays inside the wheel', () => {
      for (const name of ['', 'a', 'Percy Verse', 'x'.repeat(500)]) {
        const hue = hueOf(name);
        expect(hue).toBeGreaterThanOrEqual(0);
        expect(hue).toBeLessThan(360);
      }
    });
  });

  describe('avatarFor', () => {
    it('needs nothing fetched to show it', () => {
      expect(avatarFor('Percy Verse')).toMatch(/^data:image\/svg\+xml/);
    });

    it('draws the initials', () => {
      expect(decodeURIComponent(avatarFor('Percy Verse'))).toContain('>PV<');
    });

    it('is the same picture for the same person', () => {
      expect(avatarFor('Percy Verse')).toBe(avatarFor('Percy Verse'));
    });

    it('is a different picture for a different person', () => {
      expect(avatarFor('Percy Verse')).not.toBe(avatarFor('Sam Codewell'));
    });

    it('produces something for a name it cannot read', () => {
      expect(avatarFor('')).toMatch(/^data:image\/svg\+xml/);
    });

    it('does not let a name break the drawing it is written into', () => {
      const drawn = decodeURIComponent(avatarFor('<script>x</script>'));

      expect(drawn).not.toContain('<script>');
    });
  });
});
