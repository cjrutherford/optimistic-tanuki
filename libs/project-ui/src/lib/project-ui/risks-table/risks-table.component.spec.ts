import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RisksTableComponent } from './risks-table.component';

describe('RisksTableComponent', () => {
  let component: RisksTableComponent;
  let fixture: ComponentFixture<RisksTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RisksTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RisksTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
