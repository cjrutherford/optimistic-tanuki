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

  it('positions the services grid as open client work', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Available for project work');
    expect(compiled.textContent).toContain(
      'I take on product builds, platform and deployment work'
    );
    expect(compiled.textContent).toContain('How it starts');
    expect(compiled.textContent).toContain('Explore work');
    expect(compiled.textContent).toContain('Start a project');
  });
});
