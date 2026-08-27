import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServicesSectionComponent } from './services-section.component';

describe('ServicesSectionComponent', () => {
  let fixture: ComponentFixture<ServicesSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServicesSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ServicesSectionComponent);
    fixture.componentRef.setInput('serviceProof', ['Proof one']);
    fixture.componentRef.setInput('servicePillars', [
      { icon: 'P', title: 'Pillar one', description: 'Description one' },
    ]);
    fixture.detectChanges();
  });

  it('uses contract cards for the lead panel and service pillars', () => {
    const element = fixture.nativeElement as HTMLElement;
    const cards = element.querySelectorAll('otui-card');

    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute('cardvariant')).toBe('default');
    expect(cards[0].getAttribute('tone')).toBe('brand');
    expect(cards[0].getAttribute('emphasis')).toBe('soft');
    expect(cards[1].getAttribute('tone')).toBe('neutral');
    expect(cards[1].getAttribute('emphasis')).toBe('soft');
    expect(element.querySelector('.proof-list')?.textContent).toContain(
      'Proof one'
    );
    expect(element.querySelector('h3')?.textContent).toContain('Pillar one');
  });
});
