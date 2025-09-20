import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlogComposeComponent } from './blog-compose.component';

describe('BlogComposeComponent', () => {
  let component: BlogComposeComponent;
  let fixture: ComponentFixture<BlogComposeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogComposeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogComposeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
