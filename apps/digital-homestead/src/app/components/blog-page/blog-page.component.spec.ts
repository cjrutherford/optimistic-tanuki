import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlogPageComponent } from './blog-page.component';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

describe('BlogPageComponent', () => {
  let component: BlogPageComponent;
  let fixture: ComponentFixture<BlogPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogPageComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to view mode', () => {
    expect(component.mode()).toBe('view');
  });

  it('should initialize with empty posts', () => {
    expect(component.posts().length).toBe(0);
  });

  it('should have canEdit as false when not authenticated', () => {
    expect(component.canEdit()).toBe(false);
  });
});
