import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterBlockComponent } from './register-block.component';

describe('RegisterBlockComponent', () => {
  let component: RegisterBlockComponent;
  let fixture: ComponentFixture<RegisterBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterBlockComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
