import { BlockInstance } from '@optimistic-tanuki/app-config-models';

import { SchemaBlockInspectorComponent } from './schema-block-inspector.component';

/**
 * The spec beside this one covers rendering. These drive the value readers,
 * which walk a dotted path into the block's data and have to coerce whatever
 * they find into something the template can bind.
 */
describe('SchemaBlockInspectorComponent value reading', () => {
  let component: SchemaBlockInspectorComponent;

  const block = (data: Record<string, unknown>): BlockInstance =>
    ({ id: 'block-1', type: 'gallery', data } as BlockInstance);

  beforeEach(() => {
    component = new SchemaBlockInspectorComponent();
  });

  describe('fieldValue', () => {
    it('returns an empty string when no block is selected', () => {
      expect(component.fieldValue('title')).toBe('');
    });

    it.each<[string, unknown, string]>([
      ['a string through unchanged', 'Hello', 'Hello'],
      ['a number as its string form', 42, '42'],
      ['zero rather than treating it as empty', 0, '0'],
      ['a boolean as its string form', true, 'true'],
      ['false rather than treating it as empty', false, 'false'],
      ['an object as empty', { nested: 1 }, ''],
      ['null as empty', null, ''],
      ['a missing key as empty', undefined, ''],
    ])('renders %s', (_case, value, expected) => {
      component.block = block({ title: value });

      expect(component.fieldValue('title')).toBe(expected);
    });

    it('walks a dotted path into nested data', () => {
      component.block = block({ gallery: { style: 'grid' } });

      expect(component.fieldValue('gallery.style')).toBe('grid');
    });

    it('stops walking when the path runs into a non-object', () => {
      component.block = block({ gallery: 'not-an-object' });

      expect(component.fieldValue('gallery.style')).toBe('');
    });
  });

  describe('booleanFieldValue', () => {
    it.each<[string, unknown, boolean]>([
      ['true', true, true],
      ['false', false, false],
      ['a non-boolean, defaulting to false', 'yes', false],
      ['a missing key, defaulting to false', undefined, false],
    ])('reads %s', (_case, value, expected) => {
      component.block = block({ featured: value });

      expect(component.booleanFieldValue('featured')).toBe(expected);
    });
  });

  describe('fieldOptions', () => {
    it('normalises option values to strings', () => {
      const options = component.fieldOptions({
        key: 'columns',
        type: 'select',
        label: 'Columns',
        editor: 'select',
        options: [
          { label: 'Two', value: 2 },
          { label: 'Three', value: 3 },
        ],
      } as never);

      expect(options).toEqual([
        { value: '2', label: 'Two' },
        { value: '3', label: 'Three' },
      ]);
    });

    it('treats a field with no options as an empty list', () => {
      expect(
        component.fieldOptions({
          key: 'plain',
          type: 'string',
          label: 'Plain',
          editor: 'text',
        } as never)
      ).toEqual([]);
    });

    it('serves the same array on a second read', () => {
      const field = {
        key: 'columns',
        type: 'select',
        label: 'Columns',
        editor: 'select',
        options: [{ label: 'Two', value: 2 }],
      } as never;

      const first = component.fieldOptions(field);
      const second = component.fieldOptions(field);

      // Cached by key, so the template can bind it without re-creating the
      // array on every change-detection pass.
      expect(second).toBe(first);
    });
  });
});
