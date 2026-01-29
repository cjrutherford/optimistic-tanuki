import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlogViewerComponent } from './blog-viewer.component';
import { SimpleChange } from '@angular/core';
import DOMPurify from 'dompurify';

jest.mock('dompurify', () => ({
  sanitize: jest.fn((content) => `sanitized-${content}`),
}));

describe('BlogViewerComponent', () => {
  let component: BlogViewerComponent;
  let fixture: ComponentFixture<BlogViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogViewerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should sanitize content on init', () => {
    component.content = '<p>Test</p>';
    component.ngOnInit();
    expect(DOMPurify.sanitize).toHaveBeenCalledWith('<p>Test</p>');
    expect(component.sanitizedContent).toBe('sanitized-<p>Test</p>');
  });

  it('should update sanitized content on changes', () => {
    const newContent = '<div>New</div>';
    component.content = newContent;
    component.ngOnChanges({
      content: new SimpleChange(null, newContent, true),
    });
    expect(DOMPurify.sanitize).toHaveBeenCalledWith(newContent);
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
