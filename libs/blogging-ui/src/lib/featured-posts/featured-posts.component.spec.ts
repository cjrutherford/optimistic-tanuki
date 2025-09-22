import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeaturedPostsComponent } from './featured-posts.component';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('FeaturedPostsComponent', () => {
  let component: FeaturedPostsComponent;
  let fixture: ComponentFixture<FeaturedPostsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeaturedPostsComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(FeaturedPostsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
