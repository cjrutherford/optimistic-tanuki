import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HealthStripComponent } from './health-strip.component';
import { OwnerServiceHealth } from '../services/attention.service';

const svc = (
  name: string,
  status: OwnerServiceHealth['status'],
  latencyMs: number | null = 4
): OwnerServiceHealth => ({ name, status, latencyMs, checkedAt: 't' });

describe('HealthStripComponent', () => {
  let fixture: ComponentFixture<HealthStripComponent>;
  const text = () => fixture.nativeElement.textContent as string;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthStripComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HealthStripComponent);
  });

  it('states each status in words, not colour alone, with trouble first', () => {
    fixture.componentRef.setInput('health', [
      svc('social', 'up'),
      svc('clamav', 'down', null),
      svc('directory', 'degraded'),
    ]);
    fixture.componentRef.setInput('state', 'ready');
    fixture.detectChanges();
    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('.chip')
    ).map((c) => (c as HTMLElement).textContent?.trim() ?? '');
    expect(chips[0]).toContain('clamav');
    expect(chips[0]).toContain('Down');
    expect(chips[1]).toContain('Degraded');
    expect(chips[2]).toContain('Up');
    expect(text()).toContain('1 down, 1 degraded, 1 up');
  });

  it('summarises a healthy stack', () => {
    fixture.componentRef.setInput('health', [svc('a', 'up'), svc('b', 'up')]);
    fixture.detectChanges();
    expect(text()).toContain('All 2 services up');
  });

  it('offers Retry when the sweep itself fails', () => {
    fixture.componentRef.setInput('state', 'error');
    fixture.detectChanges();
    expect(text()).toContain('Unavailable');
    const retried = jest.fn();
    fixture.componentInstance.retry.subscribe(retried);
    (
      fixture.nativeElement.querySelector('p.bad button') as HTMLButtonElement
    ).click();
    expect(retried).toHaveBeenCalled();
  });
});
