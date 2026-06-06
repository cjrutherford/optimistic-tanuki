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

    expect(compiled.textContent).toContain(
      'I help teams sort out product, platform, and delivery work that needs a clearer path'
    );
    expect(compiled.textContent).toContain('Explore work');
    expect(compiled.textContent).toContain('Start a project');
  });
});
