import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthorProfileComponent } from './author-profile.component';

describe('AuthorProfileComponent', () => {
  let component: AuthorProfileComponent;
  let fixture: ComponentFixture<AuthorProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthorProfileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthorProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display default author name, bio, and profile image', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.authorName).toBe('Author Name');
    expect(component.authorBio).toBe('This is a short bio about the author. It gives readers some background information.');
    expect(component.profileImage).toBe('https://picsum.photos/200');
    // Check rendered content
    expect(compiled.textContent).toContain('Author Name');
    expect(compiled.textContent).toContain('This is a short bio about the author');
    const img = compiled.querySelector('lib-profile-photo,img');
    expect(img).toBeTruthy();
  });

  it('should update authorName, authorBio, and profileImage when inputs change', () => {
    component.authorName = 'Jane Doe';
    component.authorBio = 'Jane is a passionate writer.';
    component.profileImage = 'https://example.com/jane.jpg';
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Jane Doe');
    expect(compiled.textContent).toContain('Jane is a passionate writer.');
    const img = compiled.querySelector('lib-profile-photo,img');
    if (img) {
      expect(img.getAttribute('src')).toBe('https://example.com/jane.jpg');
    }
  });
});
