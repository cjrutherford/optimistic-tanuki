import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgGridUiComponent } from './ag-grid-ui.component';

describe('AgGridUiComponent', () => {
  let component: AgGridUiComponent;
  let fixture: ComponentFixture<AgGridUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgGridUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgGridUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
