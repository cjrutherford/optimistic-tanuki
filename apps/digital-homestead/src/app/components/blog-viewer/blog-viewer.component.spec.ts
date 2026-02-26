import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlogViewerComponent } from './blog-viewer.component';
import { SimpleChange } from '@angular/core';
import DOMPurify from 'dompurify';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

jest.mock('dompurify', () => ({
  sanitize: jest.fn((content) => `sanitized-${content}`),
}));

describe('BlogViewerComponent', () => {
  let component: BlogViewerComponent;
  let fixture: ComponentFixture<BlogViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogViewerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should sanitize content on init', () => {
    (DOMPurify.sanitize as jest.Mock).mockClear();
    component.content = '<p>Test</p>';
    component.ngOnInit();
    expect(DOMPurify.sanitize).toHaveBeenCalledWith(
      '<p>Test</p>',
      expect.any(Object)
    );
    expect(component.sanitizedContent).toBe('sanitized-<p>Test</p>');
  });

  it('should update sanitized content on changes', () => {
    (DOMPurify.sanitize as jest.Mock).mockClear();
    const newContent = '<div>New</div>';
    component.content = newContent;
    component.ngOnChanges({
      content: new SimpleChange(null, newContent, true),
    });
    expect(DOMPurify.sanitize).toHaveBeenCalledWith(
      newContent,
      expect.any(Object)
    );
    expect(component.sanitizedContent).toBe(`sanitized-${newContent}`);
  });

  it('should NOT update sanitized content if content has not changed', () => {
    (DOMPurify.sanitize as jest.Mock).mockClear();
    component.ngOnChanges({
      title: new SimpleChange(null, 'New Title', true),
    });
    expect(DOMPurify.sanitize).not.toHaveBeenCalled();
  });
});
