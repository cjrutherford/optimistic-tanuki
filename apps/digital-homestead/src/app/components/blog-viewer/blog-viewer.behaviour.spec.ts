import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { ComponentPersistenceService } from '@optimistic-tanuki/blogging-ui';
import { BlogViewerComponent } from './blog-viewer.component';

/**
 * The viewer rebuilds live Angular components from the placeholder nodes left
 * in stored post HTML. These drive that reconstruction: stored data preferred
 * over the legacy attribute payload, an unknown component type degrading to a
 * placeholder rather than throwing, and the fallback that appends components
 * the HTML has no node for.
 *
 * DOMPurify is left real here (the spec beside this one mocks it) so the
 * sanitised HTML actually lands in the DOM and the nodes can be found.
 */
describe('BlogViewerComponent behaviour', () => {
  let component: BlogViewerComponent;
  let fixture: ComponentFixture<BlogViewerComponent>;
  let persistence: { getComponentsForPost: jest.Mock };

  const storedComponent = (overrides: Record<string, unknown> = {}) => ({
    instanceId: 'a-1',
    componentType: 'callout-box',
    componentData: { title: 'Stored title' },
    ...overrides,
  });

  const placeholderHtml = (attrs: string) =>
    `<div data-angular-component ${attrs}></div>`;

  beforeEach(async () => {
    persistence = { getComponentsForPost: jest.fn().mockReturnValue(of([])) };

    await TestBed.configureTestingModule({
      imports: [BlogViewerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComponentPersistenceService, useValue: persistence },
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogViewerComponent);
    component = fixture.componentInstance;

    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fixture.destroy();
  });

  /** Renders `content`, settling the async component load. */
  const render = (content: string, postId?: string) => {
    component.content = content;
    component.postId = postId;
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    tick();
    return fixture.nativeElement as HTMLElement;
  };

  /**
   * Puts placeholder HTML straight into the content element and reconstructs.
   *
   * The template binds content with [innerHTML], and Angular's sanitizer
   * strips the data-* attributes the reconstruction keys on before they ever
   * reach the DOM. Writing the markup onto the element directly is what the
   * method actually sees at runtime, once the stored HTML is trusted.
   */
  const reconstruct = (html: string, postId?: string) => {
    render('<p></p>', postId);
    const container = component.contentElement!.nativeElement;
    container.innerHTML = html;
    (
      component as unknown as { reconstructComponents(): void }
    ).reconstructComponents();
    fixture.detectChanges();
    return container;
  };

  describe('component data loading', () => {
    it('skips the request entirely without a post id', fakeAsync(() => {
      render('<p>Body</p>');

      expect(persistence.getComponentsForPost).not.toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    }));

    it('loads stored components for a post id', fakeAsync(() => {
      persistence.getComponentsForPost.mockReturnValue(of([storedComponent()]));

      render('<p>Body</p>', 'post-1');

      expect(persistence.getComponentsForPost).toHaveBeenCalledWith('post-1');
      expect(component.loading()).toBe(false);
    }));

    it('stops loading and carries on when the request fails', fakeAsync(() => {
      persistence.getComponentsForPost.mockReturnValue(
        throwError(() => new Error('offline'))
      );

      render('<p>Body</p>', 'post-1');

      expect(component.loading()).toBe(false);
    }));
  });

  describe('reconstruction from stored data', () => {
    it('replaces the placeholder with a live component', fakeAsync(() => {
      persistence.getComponentsForPost.mockReturnValue(of([storedComponent()]));

      const host = reconstruct(
        placeholderHtml('data-instance-id="a-1"'),
        'post-1'
      );

      // The placeholder is gone, replaced by the rendered component.
      expect(host.querySelector('[data-angular-component]')).toBeNull();
    }));

    it('shows a placeholder for a component type it cannot resolve', fakeAsync(() => {
      persistence.getComponentsForPost.mockReturnValue(
        of([storedComponent({ componentType: 'not-a-real-component' })])
      );

      const host = reconstruct(
        placeholderHtml('data-instance-id="a-1"'),
        'post-1'
      );

      expect(host.textContent).toContain('Component not available in viewer');
      expect(host.textContent).toContain('not-a-real-component');
    }));

    it('appends stored components the HTML has no node for', fakeAsync(() => {
      persistence.getComponentsForPost.mockReturnValue(
        of([storedComponent({ componentType: 'not-a-real-component' })])
      );

      // Content carries no placeholder at all.
      const host = reconstruct('<p>Just prose</p>', 'post-1');

      expect(host.textContent).toContain('Component not available in viewer');
    }));
  });

  describe('reconstruction from legacy attributes', () => {
    it('falls back to the attribute payload when nothing is stored', fakeAsync(() => {
      const host = reconstruct(
        placeholderHtml(
          'data-instance-id="a-1" data-component-id="not-a-real-component" data-component-def=\'{"name":"Legacy Widget"}\''
        ),
        'post-1'
      );

      // The def's display name is preferred over the raw id in the placeholder.
      expect(host.textContent).toContain('Legacy Widget');
    }));

    it('skips a node with no component id', fakeAsync(() => {
      const host = reconstruct(
        placeholderHtml('data-instance-id="a-1"'),
        'post-1'
      );

      // Nothing to build from, so the node is left as it was.
      expect(host.querySelector('[data-angular-component]')).not.toBeNull();
    }));

    it('skips a node with no instance id', fakeAsync(() => {
      const host = reconstruct(
        placeholderHtml('data-component-id="callout-box"')
      );

      expect(host.querySelector('[data-angular-component]')).not.toBeNull();
    }));

    it('survives an unparseable data attribute', fakeAsync(() => {
      expect(() =>
        reconstruct(
          placeholderHtml(
            'data-instance-id="a-1" data-component-id="callout-box" data-component-data="not-json"'
          )
        )
      ).not.toThrow();
    }));
  });

  describe('ngOnChanges', () => {
    it('re-sanitises when the content changes', fakeAsync(() => {
      render('<p>First</p>');

      component.content = '<p>Second</p>';
      component.ngOnChanges({
        content: new SimpleChange('<p>First</p>', '<p>Second</p>', false),
      });
      tick();

      expect(component.sanitizedContent).toContain('Second');
    }));

    it('reloads component data when the post id changes too', fakeAsync(() => {
      render('<p>First</p>', 'post-1');
      persistence.getComponentsForPost.mockClear();

      component.content = '<p>Second</p>';
      component.postId = 'post-2';
      component.ngOnChanges({
        content: new SimpleChange('<p>First</p>', '<p>Second</p>', false),
        postId: new SimpleChange('post-1', 'post-2', false),
      });
      tick();

      expect(persistence.getComponentsForPost).toHaveBeenCalledWith('post-2');
    }));

    it('ignores a change that does not touch the content', fakeAsync(() => {
      render('<p>First</p>', 'post-1');
      const before = component.sanitizedContent;

      component.ngOnChanges({
        title: new SimpleChange('A', 'B', false),
      });
      tick();

      expect(component.sanitizedContent).toBe(before);
    }));
  });

  describe('ngOnDestroy', () => {
    it('destroys every component it built', fakeAsync(() => {
      persistence.getComponentsForPost.mockReturnValue(of([storedComponent()]));
      reconstruct(placeholderHtml('data-instance-id="a-1"'), 'post-1');

      const refs = (
        component as unknown as { componentRefs: { destroy: jest.Mock }[] }
      ).componentRefs;
      expect(refs.length).toBeGreaterThan(0);
      const destroy = jest.spyOn(refs[0], 'destroy');

      component.ngOnDestroy();

      expect(destroy).toHaveBeenCalled();
      expect(
        (component as unknown as { componentRefs: unknown[] }).componentRefs
      ).toEqual([]);
    }));

    it('is safe with nothing built', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
