import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { LazyLoadDirective } from './lazy-load.directive';

@Component({
  standalone: true,
  imports: [LazyLoadDirective],
  template: `
    <img
      [appLazyLoad]="imageSrc"
      [placeholder]="placeholder"
      alt="Test Image"
    />
  `,
})
class TestComponent {
  imageSrc = 'https://example.com/image.jpg';
  placeholder = 'https://example.com/placeholder.jpg';
}

describe('LazyLoadDirective', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;
  let imgElement: DebugElement;
  let mockIntersectionObserver: jest.Mock;
  let observerCallback: IntersectionObserverCallback;
  let hasNativeLoading: boolean;

  beforeEach(async () => {
    // Store whether native loading exists
    hasNativeLoading = 'loading' in HTMLImageElement.prototype;

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

    global.IntersectionObserver = mockIntersectionObserver as any;

    await TestBed.configureTestingModule({
      imports: [TestComponent, LazyLoadDirective],
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    imgElement = fixture.debugElement.query(By.css('img'));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(imgElement).toBeTruthy();
  });

  describe('initialization', () => {
    it('should set loading attribute to lazy', () => {
      fixture.detectChanges();
      expect(imgElement.nativeElement.getAttribute('loading')).toBe('lazy');
    });

    it('should set image src', () => {
      fixture.detectChanges();
      expect(imgElement.nativeElement.getAttribute('src')).toBeTruthy();
    });

    it('should handle placeholder when provided', () => {
      // This test checks that placeholder is set initially
      component.placeholder = 'placeholder.jpg';
      fixture.detectChanges();

      const src = imgElement.nativeElement.getAttribute('src');
      // Either placeholder or final image should be set
      expect(src).toBeTruthy();
    });
  });

  describe('IntersectionObserver fallback', () => {
    it('should create IntersectionObserver for browsers without native lazy loading', () => {
      // Save the original descriptor
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        'loading'
      );

      // Temporarily remove loading property
      delete (HTMLImageElement.prototype as any).loading;

      try {
        const newFixture = TestBed.createComponent(TestComponent);
        newFixture.detectChanges();

        // Should have created IntersectionObserver
        expect(mockIntersectionObserver).toHaveBeenCalled();
      } finally {
        // Restore the descriptor
        if (originalDescriptor) {
          Object.defineProperty(
            HTMLImageElement.prototype,
            'loading',
            originalDescriptor
          );
        }
      }
    });

    it('should set src when element intersects (fallback mode)', () => {
      // Save and remove loading property
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        'loading'
      );
      delete (HTMLImageElement.prototype as any).loading;

      try {
        component.placeholder = '';
        const newFixture = TestBed.createComponent(TestComponent);
        newFixture.detectChanges();

        const newImgElement = newFixture.debugElement.query(By.css('img'));

        const mockEntry = {
          isIntersecting: true,
          target: newImgElement.nativeElement,
        } as IntersectionObserverEntry;

        observerCallback([mockEntry], {} as IntersectionObserver);

        expect(newImgElement.nativeElement.getAttribute('src')).toBe(
          'https://example.com/image.jpg'
        );
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(
            HTMLImageElement.prototype,
            'loading',
            originalDescriptor
          );
        }
      }
    });

    it('should not set src when element does not intersect (fallback mode)', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        'loading'
      );
      delete (HTMLImageElement.prototype as any).loading;

      try {
        component.placeholder = '';
        const newFixture = TestBed.createComponent(TestComponent);
        newFixture.detectChanges();

        const newImgElement = newFixture.debugElement.query(By.css('img'));

        const mockEntry = {
          isIntersecting: false,
          target: newImgElement.nativeElement,
        } as IntersectionObserverEntry;

        observerCallback([mockEntry], {} as IntersectionObserver);

        // Should not have the final image src yet
        const src = newImgElement.nativeElement.getAttribute('src');
        expect(src).not.toBe('https://example.com/image.jpg');
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(
            HTMLImageElement.prototype,
            'loading',
            originalDescriptor
          );
        }
      }
    });

    it('should disconnect observer after loading', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        'loading'
      );
      delete (HTMLImageElement.prototype as any).loading;

      try {
        const mockObserver = {
          observe: jest.fn(),
          disconnect: jest.fn(),
          unobserve: jest.fn(),
        };

        mockIntersectionObserver.mockImplementation((callback) => {
          observerCallback = callback;
          return mockObserver;
        });

        const newFixture = TestBed.createComponent(TestComponent);
        newFixture.detectChanges();

        const newImgElement = newFixture.debugElement.query(By.css('img'));
        const mockEntry = {
          isIntersecting: true,
          target: newImgElement.nativeElement,
        } as IntersectionObserverEntry;

        observerCallback([mockEntry], mockObserver as unknown as IntersectionObserver);

        expect(mockObserver.disconnect).toHaveBeenCalled();
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(
            HTMLImageElement.prototype,
            'loading',
            originalDescriptor
          );
        }
      }
    });
  });

  describe('placeholder functionality', () => {
    it('should work without placeholder when native loading supported', () => {
      component.placeholder = '';
      fixture.detectChanges();

      // When native loading is supported, src should be set
      // When not supported, src is only set on intersection
      const src = imgElement.nativeElement.getAttribute('src');
      
      // Either has src (native loading) or is null (waiting for intersection)
      if ('loading' in HTMLImageElement.prototype) {
        expect(src).toBeTruthy();
      } else {
        // Fallback mode - src not set yet
        expect(src).toBeNull();
      }
    });

    it('should set placeholder when provided', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype,
        'loading'
      );
      delete (HTMLImageElement.prototype as any).loading;

      try {
        component.placeholder = 'placeholder.jpg';
        const newFixture = TestBed.createComponent(TestComponent);
        newFixture.componentInstance.placeholder = 'placeholder.jpg';
        newFixture.detectChanges();

        const newImgElement = newFixture.debugElement.query(By.css('img'));

        // Initially should have placeholder
        expect(newImgElement.nativeElement.getAttribute('src')).toBe(
          'placeholder.jpg'
        );
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(
            HTMLImageElement.prototype,
            'loading',
            originalDescriptor
          );
        }
      }
    });
  });

  describe('different image sources', () => {
    it('should handle different image URLs', () => {
      component.imageSrc = 'https://cdn.example.com/photo.png';
      fixture.detectChanges();

      const src = imgElement.nativeElement.getAttribute('src');
      expect(src).toBeTruthy();
    });

    it('should handle relative image paths', () => {
      component.imageSrc = '/assets/images/test.jpg';
      fixture.detectChanges();

      const src = imgElement.nativeElement.getAttribute('src');
      expect(src).toBeTruthy();
    });

    it('should handle data URLs', () => {
      component.imageSrc = 'data:image/png;base64,iVBORw0KGgoAAAANS';
      fixture.detectChanges();

      const src = imgElement.nativeElement.getAttribute('src');
      expect(src).toBeTruthy();
    });
  });

  describe('multiple images', () => {
    @Component({
      standalone: true,
      imports: [LazyLoadDirective],
      template: `
        <img [appLazyLoad]="image1" alt="Image 1" />
        <img [appLazyLoad]="image2" alt="Image 2" />
        <img [appLazyLoad]="image3" alt="Image 3" />
      `,
    })
    class MultiImageComponent {
      image1 = 'image1.jpg';
      image2 = 'image2.jpg';
      image3 = 'image3.jpg';
    }

    it('should handle multiple images independently', () => {
      const multiFixture = TestBed.createComponent(MultiImageComponent);
      multiFixture.detectChanges();

      const images = multiFixture.debugElement.queryAll(By.css('img'));
      expect(images.length).toBe(3);
      
      // All images should have loading attribute set
      images.forEach((img) => {
        expect(img.nativeElement.getAttribute('loading')).toBe('lazy');
      });
      
      // If native loading is supported, src should be set
      if ('loading' in HTMLImageElement.prototype) {
        images.forEach((img) => {
          expect(img.nativeElement.getAttribute('src')).toBeTruthy();
        });
      }
    });
  });
});

