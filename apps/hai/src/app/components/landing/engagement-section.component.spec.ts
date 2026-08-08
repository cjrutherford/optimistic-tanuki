import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EngagementSectionComponent } from './engagement-section.component';

describe('EngagementSectionComponent', () => {
  let fixture: ComponentFixture<EngagementSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EngagementSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EngagementSectionComponent);
    fixture.componentRef.setInput('stages', [
      { number: '01', title: 'Foundation', items: ['Plan'] },
    ]);
    fixture.detectChanges();
  });

  it('renders stages as brand outline cards with solid number badges', () => {
    const element = fixture.nativeElement as HTMLElement;
    const card = element.querySelector('otui-card');
    const badge = element.querySelector('otui-badge');

    expect(card).not.toBeNull();
    expect(card?.getAttribute('tone')).toBe('brand');
    expect(card?.getAttribute('emphasis')).toBe('outline');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('tone')).toBe('brand');
    expect(badge?.getAttribute('emphasis')).toBe('solid');
    expect(badge?.textContent).toContain('01');
    expect(element.querySelector('ul')?.textContent).toContain('Plan');
    expect(element.textContent).toContain('Hardware and cloud resources');
  });
});
