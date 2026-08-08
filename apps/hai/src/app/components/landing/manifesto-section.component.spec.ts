import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ManifestoSectionComponent } from './manifesto-section.component';

describe('ManifestoSectionComponent', () => {
  let fixture: ComponentFixture<ManifestoSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManifestoSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ManifestoSectionComponent);
    fixture.componentRef.setInput('manifesto', [
      { label: 'Your customer relationships', value: 'Keep control' },
      { label: 'Your operational data', value: 'Choose carefully' },
      { label: 'Your infrastructure choices', value: 'Stay visible' },
    ]);
    fixture.detectChanges();
  });

  it('renders manifesto items as brand outline cards with label badges', () => {
    const element = fixture.nativeElement as HTMLElement;
    const cards = element.querySelectorAll('otui-card');
    const badges = element.querySelectorAll('otui-badge');

    expect(cards).toHaveLength(3);
    expect(cards[0].getAttribute('tone')).toBe('brand');
    expect(cards[0].getAttribute('emphasis')).toBe('outline');
    expect(badges).toHaveLength(3);
    expect(
      fixture.debugElement
        .queryAll(By.css('otui-badge'))
        .map((badge) => badge.componentInstance.tone)
    ).toEqual(['brand', 'info', 'brand']);
    expect(badges[0].textContent).toContain('Your customer relationships');
    expect(element.querySelector('otui-shimmer-beam')).not.toBeNull();
    expect(element.textContent).toContain('Keep control');
  });
});
