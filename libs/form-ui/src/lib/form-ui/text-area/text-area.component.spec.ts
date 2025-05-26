import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextAreaComponent } from './text-area.component';
import { ReactiveFormsModule } from '@angular/forms';

describe('TextAreaComponent', () => {
  let component: TextAreaComponent;
  let fixture: ComponentFixture<TextAreaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextAreaComponent],
      providers: [ReactiveFormsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(TextAreaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
