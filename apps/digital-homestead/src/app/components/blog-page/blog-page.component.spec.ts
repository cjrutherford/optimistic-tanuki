import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlogPageComponent } from './blog-page.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

describe('BlogPageComponent', () => {
  let component: BlogPageComponent;
  let fixture: ComponentFixture<BlogPageComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    // Handle any HTTP requests made during component initialization
    const req = httpMock.match(() => true);
    req.forEach(r => r.flush([]));
    expect(component).toBeTruthy();
  });

  it('should default to view mode', () => {
    const req = httpMock.match(() => true);
    req.forEach(r => r.flush([]));
    expect(component.mode()).toBe('view');
  });

  it('should initialize with empty posts', () => {
    const req = httpMock.match(() => true);
    req.forEach(r => r.flush([]));
    expect(component.posts().length).toBe(0);
  });

  it('should have canEdit as false when not authenticated', () => {
    const req = httpMock.match(() => true);
    req.forEach(r => r.flush([]));
    expect(component.canEdit()).toBe(false);
  });
});
