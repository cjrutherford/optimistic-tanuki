import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { InfiniteScrollDirective } from './infinite-scroll.directive';

@Component({
  standalone: true,
  imports: [InfiniteScrollDirective],
  template: `
    <div
      appInfiniteScroll
      [scrollThreshold]="scrollThreshold"
      [disabled]="disabled"
      (scrolled)="onScrolled()"
      style="height: 100px"
    >
      Scroll trigger element
    </div>
  `,
})
class TestComponent {
  scrollThreshold = 200;
  disabled = false;
  scrolledCount = 0;

  onScrolled() {
    this.scrolledCount++;
  }
}

describe('InfiniteScrollDirective', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;
  let directiveElement: DebugElement;
  let mockIntersectionObserver: jest.Mock;
  let observerCallback: IntersectionObserverCallback;

  beforeEach(async () => {
    // Mock IntersectionObserver
    mockIntersectionObserver = jest.fn();
    mockIntersectionObserver.mockImplementation((callback) => {
      observerCallback = callback;
      return {
        observe: jest.fn(),
        disconnect: jest.fn(),
        unobserve: jest.fn(),
      };
    });

    // Replace global IntersectionObserver
    global.IntersectionObserver = mockIntersectionObserver as any;

    await TestBed.configureTestingModule({
      imports: [TestComponent, InfiniteScrollDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    directiveElement = fixture.debugElement.query(
      By.directive(InfiniteScrollDirective)
    );
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(directiveElement).toBeTruthy();
  });

  describe('initialization', () => {
    it('should create IntersectionObserver with correct options', () => {
      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        { rootMargin: '200px' }
      );
    });

    it('should observe the element', () => {
      const directive = directiveElement.injector.get(InfiniteScrollDirective);
      expect(directive['observer'].observe).toHaveBeenCalledWith(
        directiveElement.nativeElement
      );
    });

    it('should use custom scroll threshold', () => {
      component.scrollThreshold = 500;
      fixture.detectChanges();

      // Create a new instance to test with different threshold
      const newFixture = TestBed.createComponent(TestComponent);
      newFixture.componentInstance.scrollThreshold = 500;
      newFixture.detectChanges();

      const calls = mockIntersectionObserver.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual({ rootMargin: '500px' });
    });
  });

  describe('intersection detection', () => {
    it('should emit scrolled event when element intersects', () => {
      const mockEntry = {
        isIntersecting: true,
        target: directiveElement.nativeElement,
      } as IntersectionObserverEntry;

      observerCallback([mockEntry], {} as IntersectionObserver);

      expect(component.scrolledCount).toBe(1);
    });

    it('should not emit when element is not intersecting', () => {
      const mockEntry = {
        isIntersecting: false,
        target: directiveElement.nativeElement,
      } as IntersectionObserverEntry;

      observerCallback([mockEntry], {} as IntersectionObserver);

      expect(component.scrolledCount).toBe(0);
    });

    it('should not emit when disabled', () => {
      component.disabled = true;
      fixture.detectChanges();

      const mockEntry = {
        isIntersecting: true,
        target: directiveElement.nativeElement,
      } as IntersectionObserverEntry;

      observerCallback([mockEntry], {} as IntersectionObserver);

      expect(component.scrolledCount).toBe(0);
    });

    it('should resume emitting when re-enabled', () => {
      component.disabled = true;
      fixture.detectChanges();

      const mockEntry = {
        isIntersecting: true,
        target: directiveElement.nativeElement,
      } as IntersectionObserverEntry;

      // Should not emit when disabled
      observerCallback([mockEntry], {} as IntersectionObserver);
      expect(component.scrolledCount).toBe(0);

      // Re-enable
      component.disabled = false;
      fixture.detectChanges();

      // Should emit when enabled
      observerCallback([mockEntry], {} as IntersectionObserver);
      expect(component.scrolledCount).toBe(1);
    });

    it('should emit multiple times for multiple intersections', () => {
      const mockEntry = {
        isIntersecting: true,
        target: directiveElement.nativeElement,
      } as IntersectionObserverEntry;

      observerCallback([mockEntry], {} as IntersectionObserver);
      observerCallback([mockEntry], {} as IntersectionObserver);
      observerCallback([mockEntry], {} as IntersectionObserver);

      expect(component.scrolledCount).toBe(3);
    });
  });

  describe('cleanup', () => {
    it('should disconnect observer on destroy', () => {
      const directive = directiveElement.injector.get(InfiniteScrollDirective);
      const disconnectSpy = jest.spyOn(directive['observer'], 'disconnect');

      fixture.destroy();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should handle destroy gracefully if observer not initialized', () => {
      const directive = directiveElement.injector.get(InfiniteScrollDirective);
      directive['observer'] = null as any;

      expect(() => fixture.destroy()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle zero threshold', () => {
      component.scrollThreshold = 0;
      fixture.detectChanges();

      const newFixture = TestBed.createComponent(TestComponent);
      newFixture.componentInstance.scrollThreshold = 0;
      newFixture.detectChanges();

      const calls = mockIntersectionObserver.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual({ rootMargin: '0px' });
    });

    it('should handle negative threshold', () => {
      component.scrollThreshold = -100;
      fixture.detectChanges();

      const newFixture = TestBed.createComponent(TestComponent);
      newFixture.componentInstance.scrollThreshold = -100;
      newFixture.detectChanges();

      const calls = mockIntersectionObserver.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual({ rootMargin: '-100px' });
    });

    it('should handle very large threshold', () => {
      component.scrollThreshold = 10000;
      fixture.detectChanges();

      const newFixture = TestBed.createComponent(TestComponent);
      newFixture.componentInstance.scrollThreshold = 10000;
      newFixture.detectChanges();

      const calls = mockIntersectionObserver.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual({ rootMargin: '10000px' });
    });
  });
});
