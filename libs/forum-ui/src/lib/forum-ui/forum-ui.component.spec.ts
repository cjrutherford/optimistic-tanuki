import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForumUiComponent } from './forum-ui.component';

describe('ForumUiComponent', () => {
  let component: ForumUiComponent;
  let fixture: ComponentFixture<ForumUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForumUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ForumUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
