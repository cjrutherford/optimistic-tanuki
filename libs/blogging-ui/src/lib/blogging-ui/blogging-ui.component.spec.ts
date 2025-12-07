import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BloggingUiComponent } from './blogging-ui.component';

describe('BloggingUiComponent', () => {
  let component: BloggingUiComponent;
  let fixture: ComponentFixture<BloggingUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BloggingUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BloggingUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
