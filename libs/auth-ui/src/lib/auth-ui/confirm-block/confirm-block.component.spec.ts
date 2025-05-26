import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmBlockComponent } from './confirm-block.component';

describe('ConfirmBlockComponent', () => {
  let component: ConfirmBlockComponent;
  let fixture: ComponentFixture<ConfirmBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmBlockComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
