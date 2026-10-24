import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HardwareSupportComponent } from './hardware-support.component';

describe('HardwareSupportComponent', () => {
  let component: HardwareSupportComponent;
  let fixture: ComponentFixture<HardwareSupportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HardwareSupportComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HardwareSupportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
