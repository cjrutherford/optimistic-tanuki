import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServicesGridComponent } from './services-grid.component';

describe('ServicesGridComponent', () => {
  let component: ServicesGridComponent;
  let fixture: ComponentFixture<ServicesGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServicesGridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ServicesGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('positions the services grid as outcome-driven consulting', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('How I help teams move forward');
  });
});
