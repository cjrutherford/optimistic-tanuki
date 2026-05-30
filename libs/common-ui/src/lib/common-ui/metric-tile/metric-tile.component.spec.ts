import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MetricTileComponent } from './metric-tile.component';

describe('MetricTileComponent', () => {
  let component: MetricTileComponent;
  let fixture: ComponentFixture<MetricTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetricTileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MetricTileComponent);
    component = fixture.componentInstance;
  });

  it('renders label and value', () => {
    component.label = 'Active users';
    component.value = '1,204';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Active users');
    expect(el.textContent).toContain('1,204');
  });

  it('renders delta when provided and maps direction to data attribute', () => {
    component.label = 'Conversions';
    component.value = '8.2%';
    component.delta = '+0.4%';
    component.deltaDirection = 'up';
    fixture.detectChanges();
    const deltaEl: HTMLElement | null = fixture.nativeElement.querySelector(
      '.metric-tile__delta'
    );
    expect(deltaEl).not.toBeNull();
    expect(deltaEl?.getAttribute('data-direction')).toBe('up');
    expect(deltaEl?.textContent).toContain('+0.4%');
  });

  it('resolves tone from direction by default', () => {
    component.deltaDirection = 'down';
    expect(component.resolvedTone).toBe('negative');
    component.deltaDirection = 'up';
    expect(component.resolvedTone).toBe('positive');
    component.deltaDirection = 'flat';
    expect(component.resolvedTone).toBe('neutral');
  });

  it('honors explicit deltaTone override', () => {
    component.deltaDirection = 'up';
    component.deltaTone = 'negative';
    expect(component.resolvedTone).toBe('negative');
  });
});
