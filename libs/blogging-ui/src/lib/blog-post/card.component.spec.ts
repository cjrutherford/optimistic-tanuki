import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlogPostCardComponent } from './card.component';

describe('BlogPostCardComponent', () => {
  let component: BlogPostCardComponent;
  let fixture: ComponentFixture<BlogPostCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogPostCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogPostCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default input values', () => {
    expect(component.title).toBe('A Blog Post Title');
    expect(component.bannerImage).toBe('https://picsum.photos/600/200');
    expect(component.excerpt).toBe('This is a short excerpt from the blog post to give readers an idea of the content.');
    expect(component.authorName).toBe('Author Name');
    expect(component.publishDate).toBe('January 1, 2024');
    expect(component.readMoreLink).toBe('#');
  });

  it('should update input values', () => {
    component.title = 'Test Title';
    component.bannerImage = 'test-image.jpg';
    component.excerpt = 'Test excerpt';
    component.authorName = 'Test Author';
    component.publishDate = 'February 2, 2024';
    component.readMoreLink = '/test-link';
    fixture.detectChanges();

    expect(component.title).toBe('Test Title');
    expect(component.bannerImage).toBe('test-image.jpg');
    expect(component.excerpt).toBe('Test excerpt');
    expect(component.authorName).toBe('Test Author');
    expect(component.publishDate).toBe('February 2, 2024');
    expect(component.readMoreLink).toBe('/test-link');
  });

  it('should open readMoreLink in a new tab when onReadMoreClick is called', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation();
    component.readMoreLink = '/some-link';
    component.onReadMoreClick();
    expect(openSpy).toHaveBeenCalledWith('/some-link', '_blank');
    openSpy.mockRestore();
  });
});
