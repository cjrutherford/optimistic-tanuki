import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentRegistryService } from './component-registry.service';
import { ComponentEventBusService } from './component-event-bus.service';
import { ComponentMetadata } from '../../interfaces/component-metadata.interface';

@Component({
  selector: 'test-component',
  template: '<div>Test</div>',
  standalone: true,
})
class TestComponent {}

@Component({
  selector: 'another-component',
  template: '<div>Another</div>',
  standalone: true,
})
class AnotherComponent {}

describe('ComponentRegistryService', () => {
  let service: ComponentRegistryService;
  let eventBus: ComponentEventBusService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ComponentRegistryService, ComponentEventBusService],
    });
    service = TestBed.inject(ComponentRegistryService);
    eventBus = TestBed.inject(ComponentEventBusService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    eventBus.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('register', () => {
    it('should register a component', () => {
      const metadata: ComponentMetadata = {
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
        description: 'A test component',
        category: 'Test',
      };

      const entry = service.register(metadata);

      expect(entry).toBeDefined();
      expect(entry.metadata).toEqual(metadata);
      expect(entry.usageCount).toBe(0);
      expect(entry.registeredAt).toBeDefined();
    });

    it('should emit component-registered event', (done) => {
      eventBus.subscribeToType('component:registered', (event) => {
        expect(event.componentId).toBe('test-component');
        done();
      });

      service.register({
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
      });
    });

    it('should track registration source', () => {
      const entry = service.register(
        {
          id: 'test-component',
          name: 'Test Component',
          component: TestComponent,
        },
        'test-source'
      );

      expect(entry.source).toBe('test-source');
    });

    it('should update existing component if already registered', () => {
      const metadata1: ComponentMetadata = {
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
        description: 'Original description',
      };

      const metadata2: ComponentMetadata = {
        id: 'test-component',
        name: 'Updated Test Component',
        component: TestComponent,
        description: 'Updated description',
      };

      service.register(metadata1);
      const entry = service.register(metadata2);

      expect(entry.metadata.name).toBe('Updated Test Component');
      expect(entry.metadata.description).toBe('Updated description');
    });
  });

  describe('unregister', () => {
    it('should unregister a component', () => {
      service.register({
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
      });

      const result = service.unregister('test-component');
      expect(result).toBe(true);
      expect(service.get('test-component')).toBeUndefined();
    });

    it('should emit component-unregistered event', (done) => {
      service.register({
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
      });

      eventBus.subscribeToType('component:unregistered', (event) => {
        expect(event.componentId).toBe('test-component');
        done();
      });

      service.unregister('test-component');
    });

    it('should return false when unregistering non-existent component', () => {
      const result = service.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should remove from all indices', () => {
      service.register({
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
        category: 'Test',
        tags: ['tag1', 'tag2'],
      }, 'test-source');

      service.unregister('test-component');

      expect(service.getByCategory('Test').length).toBe(0);
      expect(service.getBySource('test-source').length).toBe(0);
      expect(service.getByTags(['tag1']).length).toBe(0);
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent component', () => {
      expect(service.get('non-existent')).toBeUndefined();
    });

    it('should return registered component metadata', () => {
      const metadata: ComponentMetadata = {
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
      };

      service.register(metadata);
      const result = service.get('test-component');

      expect(result).toEqual(metadata);
    });
  });

  describe('getEntry', () => {
    it('should return full registry entry', () => {
      service.register({
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
      }, 'test-source');

      const entry = service.getEntry('test-component');

      expect(entry).toBeDefined();
      expect(entry?.metadata.id).toBe('test-component');
      expect(entry?.source).toBe('test-source');
      expect(entry?.usageCount).toBe(0);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no components registered', () => {
      expect(service.getAll()).toEqual([]);
    });

    it('should return all registered components', () => {
      service.register({
        id: 'comp-1',
        name: 'Component 1',
        component: TestComponent,
      });

      service.register({
        id: 'comp-2',
        name: 'Component 2',
        component: AnotherComponent,
      });

      const all = service.getAll();
      expect(all.length).toBe(2);
    });
  });

  describe('getByCategory', () => {
    it('should return components in specified category', () => {
      service.register({
        id: 'comp-1',
        name: 'Component 1',
        component: TestComponent,
        category: 'Category A',
      });

      service.register({
        id: 'comp-2',
        name: 'Component 2',
        component: AnotherComponent,
        category: 'Category B',
      });

      service.register({
        id: 'comp-3',
        name: 'Component 3',
        component: TestComponent,
        category: 'Category A',
      });

      const categoryA = service.getByCategory('Category A');
      expect(categoryA.length).toBe(2);
      expect(categoryA[0].id).toBe('comp-1');
      expect(categoryA[1].id).toBe('comp-3');
    });

    it('should return empty array for non-existent category', () => {
      expect(service.getByCategory('Non-existent')).toEqual([]);
    });
  });

  describe('getBySource', () => {
    it('should return components from specified source', () => {
      service.register({
        id: 'comp-1',
        name: 'Component 1',
        component: TestComponent,
      }, 'source-a');

      service.register({
        id: 'comp-2',
        name: 'Component 2',
        component: AnotherComponent,
      }, 'source-b');

      service.register({
        id: 'comp-3',
        name: 'Component 3',
        component: TestComponent,
      }, 'source-a');

      const sourceA = service.getBySource('source-a');
      expect(sourceA.length).toBe(2);
    });
  });

  describe('getByTags', () => {
    it('should return components with any of the specified tags', () => {
      service.register({
        id: 'comp-1',
        name: 'Component 1',
        component: TestComponent,
        tags: ['tag1', 'tag2'],
      });

      service.register({
        id: 'comp-2',
        name: 'Component 2',
        component: AnotherComponent,
        tags: ['tag2', 'tag3'],
      });

      service.register({
        id: 'comp-3',
        name: 'Component 3',
        component: TestComponent,
        tags: ['tag4'],
      });

      const results = service.getByTags(['tag1', 'tag3']);
      expect(results.length).toBe(2);
    });

    it('should return empty array when no tags match', () => {
      service.register({
        id: 'comp-1',
        name: 'Component 1',
        component: TestComponent,
        tags: ['tag1'],
      });

      expect(service.getByTags(['tag2'])).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      service.register({
        id: 'button-component',
        name: 'Button',
        description: 'A clickable button element',
        component: TestComponent,
        tags: ['ui', 'interactive'],
      });

      service.register({
        id: 'input-field',
        name: 'Input Field',
        description: 'Text input component',
        component: AnotherComponent,
        tags: ['form', 'input'],
      });
    });

    it('should search by ID', () => {
      const results = service.search('button');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('button-component');
    });

    it('should search by name', () => {
      const results = service.search('Input');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('input-field');
    });

    it('should search by description', () => {
      const results = service.search('clickable');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('button-component');
    });

    it('should search by tags', () => {
      const results = service.search('form');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('input-field');
    });

    it('should be case-insensitive', () => {
      const results = service.search('BUTTON');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('button-component');
    });

    it('should return empty array for no matches', () => {
      expect(service.search('nonexistent')).toEqual([]);
    });
  });

  describe('validate', () => {
    it('should validate valid metadata', () => {
      const metadata: ComponentMetadata = {
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
      };

      const result = service.validate(metadata);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject metadata without id', () => {
      const metadata = {
        name: 'Test Component',
        component: TestComponent,
      } as any;

      const result = service.validate(metadata);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject metadata without name', () => {
      const metadata = {
        id: 'test-component',
        component: TestComponent,
      } as any;

      const result = service.validate(metadata);
      expect(result.isValid).toBe(false);
    });

    it('should reject metadata without component', () => {
      const metadata = {
        id: 'test-component',
        name: 'Test Component',
      } as any;

      const result = service.validate(metadata);
      expect(result.isValid).toBe(false);
    });

    it('should reject invalid ID format', () => {
      const metadata: ComponentMetadata = {
        id: 'Test_Component!',
        name: 'Test Component',
        component: TestComponent,
      };

      const result = service.validate(metadata);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
    });

    it('should warn about deprecated components', () => {
      const metadata: ComponentMetadata = {
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
        deprecated: true,
      };

      const result = service.validate(metadata);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count', () => {
      service.register({
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
      });

      service.incrementUsage('test-component');
      const entry = service.getEntry('test-component');
      expect(entry?.usageCount).toBe(1);

      service.incrementUsage('test-component');
      const updatedEntry = service.getEntry('test-component');
      expect(updatedEntry?.usageCount).toBe(2);
    });

    it('should do nothing for non-existent component', () => {
      expect(() => {
        service.incrementUsage('non-existent');
      }).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      service.register({
        id: 'comp-1',
        name: 'Component 1',
        component: TestComponent,
        category: 'Category A',
      }, 'source-1');

      service.register({
        id: 'comp-2',
        name: 'Component 2',
        component: AnotherComponent,
        category: 'Category A',
      }, 'source-2');

      service.register({
        id: 'comp-3',
        name: 'Component 3',
        component: TestComponent,
        category: 'Category B',
      }, 'source-1');

      const stats = service.getStats();
      expect(stats.totalCount).toBe(3);
      expect(stats.byCategory['Category A']).toBe(2);
      expect(stats.byCategory['Category B']).toBe(1);
      expect(stats.bySource['source-1']).toBe(2);
      expect(stats.bySource['source-2']).toBe(1);
    });

    it('should track most used components', () => {
      service.register({
        id: 'comp-1',
        name: 'Component 1',
        component: TestComponent,
      });

      service.register({
        id: 'comp-2',
        name: 'Component 2',
        component: AnotherComponent,
      });

      service.incrementUsage('comp-1');
      service.incrementUsage('comp-1');
      service.incrementUsage('comp-2');

      const stats = service.getStats();
      expect(stats.mostUsed.length).toBeGreaterThan(0);
      expect(stats.mostUsed[0].id).toBe('comp-1');
      expect(stats.mostUsed[0].usageCount).toBe(2);
    });

    it('should limit most used to top 10', () => {
      for (let i = 0; i < 15; i++) {
        service.register({
          id: `comp-${i}`,
          name: `Component ${i}`,
          component: TestComponent,
        });
        service.incrementUsage(`comp-${i}`);
      }

      const stats = service.getStats();
      expect(stats.mostUsed.length).toBe(10);
    });
  });

  describe('changes$ observable', () => {
    it('should emit on registration', (done) => {
      service.changes$.subscribe((change) => {
        expect(change.type).toBe('registered');
        expect(change.componentId).toBe('test-component');
        done();
      });

      service.register({
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
      });
    });

    it('should emit on unregistration', (done) => {
      service.register({
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
      });

      service.changes$.subscribe((change) => {
        if (change.type === 'unregistered') {
          expect(change.componentId).toBe('test-component');
          done();
        }
      });

      service.unregister('test-component');
    });
  });
});
