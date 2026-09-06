import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { PropertyEditorComponent } from './property-editor.component';
import {
  InjectedComponentInstance,
  PropertyDefinition,
} from '../interfaces/component-injection.interface';

/**
 * The spec alongside this one asserts inputs and defaults. These drive the
 * methods: edited-data initialisation, placeholder derivation, the JSON
 * round-trip for array/object properties, and the save/close outputs.
 */
describe('PropertyEditorComponent behaviour', () => {
  let component: PropertyEditorComponent;
  let fixture: ComponentFixture<PropertyEditorComponent>;

  const instanceWith = (
    data: Record<string, unknown>
  ): InjectedComponentInstance =>
    ({
      instanceId: 'instance-1',
      componentDef: {
        id: 'widget',
        name: 'Widget',
        component: PropertyEditorComponent,
      },
      componentRef: null as never,
      data,
    } as InjectedComponentInstance);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertyEditorComponent, FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertyEditorComponent);
    component = fixture.componentInstance;
  });

  describe('edited data initialisation', () => {
    it('copies the instance data on init', () => {
      component.componentInstance = instanceWith({ title: 'hello', size: 3 });
      component.propertyDefinitions = [
        { key: 'title', type: 'string', label: 'Title' },
      ];

      component.ngOnInit();

      expect(component.editedData).toMatchObject({ title: 'hello', size: 3 });
    });

    it('copies rather than aliases the instance data', () => {
      const instance = instanceWith({ title: 'original' });
      component.componentInstance = instance;
      component.propertyDefinitions = [
        { key: 'title', type: 'string', label: 'Title' },
      ];

      component.ngOnInit();
      component.editedData['title'] = 'edited';

      expect(instance.data).toMatchObject({ title: 'original' });
    });

    it('does nothing without a component instance', () => {
      component.propertyDefinitions = [
        { key: 'title', type: 'string', label: 'Title' },
      ];

      component.ngOnInit();

      expect(component.editedData).toEqual({});
    });

    it('does nothing without property definitions', () => {
      component.componentInstance = instanceWith({ title: 'hello' });

      component.ngOnInit();

      expect(component.editedData).toEqual({});
    });

    it('tolerates an instance carrying no data', () => {
      component.componentInstance = instanceWith(
        undefined as unknown as Record<string, unknown>
      );
      component.propertyDefinitions = [
        { key: 'title', type: 'string', label: 'Title' },
      ];

      component.ngOnInit();

      expect(component.editedData).toEqual({});
    });

    it('serialises array and object properties into companion _json keys', () => {
      component.componentInstance = instanceWith({
        tags: ['a', 'b'],
        config: { mode: 'dark' },
      });
      component.propertyDefinitions = [
        { key: 'tags', type: 'array', label: 'Tags' },
        { key: 'config', type: 'object', label: 'Config' },
      ];

      component.ngOnInit();

      expect(component.editedData['tags_json']).toBe(
        JSON.stringify(['a', 'b'], null, 2)
      );
      expect(component.editedData['config_json']).toBe(
        JSON.stringify({ mode: 'dark' }, null, 2)
      );
    });

    it('uses an empty string when a complex property has no value', () => {
      component.componentInstance = instanceWith({});
      component.propertyDefinitions = [
        { key: 'tags', type: 'array', label: 'Tags' },
      ];

      component.ngOnInit();

      expect(component.editedData['tags_json']).toBe('');
    });

    it('re-initialises on input changes', () => {
      component.componentInstance = instanceWith({ title: 'first' });
      component.propertyDefinitions = [
        { key: 'title', type: 'string', label: 'Title' },
      ];
      component.ngOnInit();

      component.componentInstance = instanceWith({ title: 'second' });
      component.ngOnChanges();

      expect(component.editedData).toMatchObject({ title: 'second' });
    });
  });

  describe('getPlaceholder', () => {
    it('prefers the default value when one is defined', () => {
      const prop: PropertyDefinition = {
        key: 'title',
        type: 'string',
        label: 'Title',
        defaultValue: 'A default',
      };

      expect(component.getPlaceholder(prop)).toBe('A default');
    });

    it('stringifies a non-string default value', () => {
      const prop: PropertyDefinition = {
        key: 'count',
        type: 'number',
        label: 'Count',
        defaultValue: 42,
      };

      expect(component.getPlaceholder(prop)).toBe('42');
    });

    it('falls back to a per-type hint', () => {
      expect(
        component.getPlaceholder({ key: 's', type: 'string', label: 'S' })
      ).toBe('Enter text...');
      expect(
        component.getPlaceholder({ key: 'n', type: 'number', label: 'N' })
      ).toBe('0');
      expect(
        component.getPlaceholder({ key: 'u', type: 'url', label: 'U' })
      ).toBe('https://example.com');
    });

    it('returns an empty hint for types without one', () => {
      expect(
        component.getPlaceholder({ key: 'b', type: 'boolean', label: 'B' })
      ).toBe('');
    });
  });

  describe('complex-type placeholders', () => {
    it('shows the array default when present, else a sample', () => {
      expect(
        component.getArrayPlaceholder({
          key: 'tags',
          type: 'array',
          label: 'Tags',
          defaultValue: ['x'],
        })
      ).toBe(JSON.stringify(['x'], null, 2));

      expect(
        component.getArrayPlaceholder({
          key: 'tags',
          type: 'array',
          label: 'Tags',
        })
      ).toBe(JSON.stringify(['item1', 'item2'], null, 2));
    });

    it('shows the object default when present, else a sample', () => {
      expect(
        component.getObjectPlaceholder({
          key: 'config',
          type: 'object',
          label: 'Config',
          defaultValue: { a: 1 },
        })
      ).toBe(JSON.stringify({ a: 1 }, null, 2));

      expect(
        component.getObjectPlaceholder({
          key: 'config',
          type: 'object',
          label: 'Config',
        })
      ).toBe(JSON.stringify({ key: 'value' }, null, 2));
    });
  });

  describe('updateArrayFromJson', () => {
    it('stores parsed arrays', () => {
      component.updateArrayFromJson('tags', '["a","b"]');
      expect(component.editedData['tags']).toEqual(['a', 'b']);
    });

    it('ignores valid JSON that is not an array', () => {
      component.editedData['tags'] = ['original'];
      component.updateArrayFromJson('tags', '{"not":"an array"}');
      expect(component.editedData['tags']).toEqual(['original']);
    });

    it('keeps the previous value on malformed JSON', () => {
      component.editedData['tags'] = ['original'];
      component.updateArrayFromJson('tags', '[oops');
      expect(component.editedData['tags']).toEqual(['original']);
    });
  });

  describe('updateObjectFromJson', () => {
    it('stores parsed objects', () => {
      component.updateObjectFromJson('config', '{"mode":"dark"}');
      expect(component.editedData['config']).toEqual({ mode: 'dark' });
    });

    it('ignores a parsed null', () => {
      component.editedData['config'] = { mode: 'light' };
      component.updateObjectFromJson('config', 'null');
      expect(component.editedData['config']).toEqual({ mode: 'light' });
    });

    it('ignores valid JSON that is not an object', () => {
      component.editedData['config'] = { mode: 'light' };
      component.updateObjectFromJson('config', '"a string"');
      expect(component.editedData['config']).toEqual({ mode: 'light' });
    });

    it('keeps the previous value on malformed JSON', () => {
      component.editedData['config'] = { mode: 'light' };
      component.updateObjectFromJson('config', '{oops');
      expect(component.editedData['config']).toEqual({ mode: 'light' });
    });
  });

  describe('onSave', () => {
    it('emits the edited data without the companion _json keys', () => {
      const emitted: Record<string, unknown>[] = [];
      component.propertiesUpdated.subscribe((d) => emitted.push(d));

      component.propertyDefinitions = [
        { key: 'title', type: 'string', label: 'Title' },
        { key: 'tags', type: 'array', label: 'Tags' },
        { key: 'config', type: 'object', label: 'Config' },
      ];
      component.editedData = {
        title: 'hello',
        tags: ['a'],
        tags_json: '["a"]',
        config: { mode: 'dark' },
        config_json: '{"mode":"dark"}',
      };

      component.onSave();

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({
        title: 'hello',
        tags: ['a'],
        config: { mode: 'dark' },
      });
      expect(emitted[0]).not.toHaveProperty('tags_json');
      expect(emitted[0]).not.toHaveProperty('config_json');
    });

    it('leaves the working copy untouched', () => {
      component.propertyDefinitions = [
        { key: 'tags', type: 'array', label: 'Tags' },
      ];
      component.editedData = { tags: ['a'], tags_json: '["a"]' };

      component.onSave();

      expect(component.editedData['tags_json']).toBe('["a"]');
    });
  });

  describe('onClose', () => {
    it('emits the closed output', () => {
      const closed = jest.fn();
      component.closed.subscribe(closed);

      component.onClose();

      expect(closed).toHaveBeenCalled();
    });
  });
});
