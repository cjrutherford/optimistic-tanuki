import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SummaryBlockComponent } from './summary-block.component';

describe('SummaryBlockComponent', () => {
  let component: SummaryBlockComponent;
  let fixture: ComponentFixture<SummaryBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SummaryBlockComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SummaryBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
