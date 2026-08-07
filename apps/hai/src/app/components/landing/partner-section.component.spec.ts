import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PartnerSectionComponent } from './partner-section.component';

describe('PartnerSectionComponent', () => {
  let fixture: ComponentFixture<PartnerSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnerSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnerSectionComponent);
    fixture.componentRef.setInput('benefits', [
      'Keep the client relationship',
      'Extend your technical capacity',
    ]);
    fixture.detectChanges();
  });

  it('renders partner content in a brand-led card with a badge hierarchy', () => {
    const element = fixture.nativeElement as HTMLElement;
    const card = element.querySelector('otui-card');
    const badge = element.querySelector('otui-badge');

    expect(card).not.toBeNull();
    expect(card?.getAttribute('tone')).toBe('brand');
    expect(card?.getAttribute('emphasis')).toBe('soft');
    expect(card?.getAttribute('size')).toBe('lg');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('tone')).toBe('brand');
    expect(badge?.getAttribute('emphasis')).toBe('solid');
    expect(element.querySelector('#partners')).not.toBeNull();
    expect(element.querySelector('ul')?.textContent).toContain(
      'Keep the client relationship'
    );
    expect(element.textContent).toContain('Extend your delivery capacity');
  });
});
