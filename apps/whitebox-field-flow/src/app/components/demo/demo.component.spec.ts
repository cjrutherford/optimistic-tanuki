import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DemoComponent } from './demo.component';
import { BrandConfigService } from '../../services/brand-config.service';
import { FieldFlowSyncService } from '../../services/field-flow-sync.service';

describe('DemoComponent', () => {
  let component: DemoComponent;
  let fixture: ComponentFixture<DemoComponent>;
  let brandConfig: BrandConfigService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DemoComponent],
      providers: [provideRouter([]), BrandConfigService, FieldFlowSyncService],
    }).compileComponents();

    fixture = TestBed.createComponent(DemoComponent);
    component = fixture.componentInstance;
    brandConfig = TestBed.inject(BrandConfigService);
    fixture.detectChanges();
  });

  it('renders all four trade demo profiles', () => {
    expect(component).toBeTruthy();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Apex Mobile Detailing');
    expect(element.textContent).toContain('Coastal Pressure Washing');
    expect(element.textContent).toContain('WirePro Electrical Services');
    expect(element.textContent).toContain('Summit Roofing');
  });

  it('switches trade profiles on button click', () => {
    component.selectProfile('coastal-pressure-wash');
    fixture.detectChanges();
    expect(brandConfig.currentBrand().id).toBe('coastal-pressure-wash');
  });

  it('explains multi-tenant and on-premises deployment modes', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Multi-tenant cloud hosted');
    expect(element.textContent).toContain('On-premises Tier 1 Mini-PC server');
  });

  it('never uses slice or whitebox in client copy', () => {
    const text = fixture.nativeElement.textContent?.toLowerCase() || '';
    expect(text).not.toContain('slice');
    expect(text).not.toContain('whitebox');
  });
});
