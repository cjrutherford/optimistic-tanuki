import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AttentionInboxComponent, ageOf } from './attention-inbox.component';
import { OwnerAttentionItem } from '../services/attention.service';

const base = (over: Partial<OwnerAttentionItem>): OwnerAttentionItem => ({
  source: 'commerce.orders',
  label: 'Orders awaiting action',
  count: 3,
  oldest: '2026-01-01T00:00:00.000Z',
  link: '/dashboard/store/orders',
  status: 'ok',
  ...over,
});

describe('AttentionInboxComponent', () => {
  let fixture: ComponentFixture<AttentionInboxComponent>;
  const text = () => fixture.nativeElement.textContent as string;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttentionInboxComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AttentionInboxComponent);
  });

  const show = (items: OwnerAttentionItem[]) => {
    fixture.componentRef.setInput('report', { generatedAt: 't', items });
    fixture.componentRef.setInput('state', 'ready');
    fixture.detectChanges();
  };

  it('groups by source with count, age and a console link', () => {
    show([
      base({}),
      base({
        source: 'directory.address',
        label: 'Address review (Springfield)',
        townId: 't1',
        count: 4,
        link: '/dashboard/towns/t1/directory-address-review',
      }),
      base({
        source: 'directory.address',
        label: 'Address review (Shelbyville)',
        townId: 't2',
        count: 1,
        capped: true,
        link: '/dashboard/towns/t2/directory-address-review',
      }),
    ]);
    const groups = fixture.nativeElement.querySelectorAll('.group');
    expect(groups).toHaveLength(2);
    expect(text()).toContain('3 waiting');
    expect(text()).toContain('Springfield');
    expect(text()).toContain('1 or more waiting');
    expect(text()).toContain('oldest');
    const hrefs = Array.from(
      fixture.nativeElement.querySelectorAll('a.row-link')
    ).map((a) => (a as HTMLAnchorElement).getAttribute('href'));
    expect(hrefs).toContain('/dashboard/towns/t1/directory-address-review');
  });

  it('shows an unavailable item as Unavailable with Retry, not zero', () => {
    show([
      base({
        status: 'unavailable',
        count: null,
        oldest: null,
        error: 'Timed out after 3s',
      }),
    ]);
    expect(text()).toContain('Unavailable');
    expect(text()).toContain('Timed out after 3s');
    expect(text()).not.toContain('0 waiting');
    const retried = jest.fn();
    fixture.componentInstance.retry.subscribe(retried);
    const button = fixture.nativeElement.querySelector(
      '.row--unavailable button.retry'
    ) as HTMLButtonElement;
    button.click();
    expect(retried).toHaveBeenCalled();
  });

  it('hides sources that are fine and empty', () => {
    show([base({ count: 0 })]);
    expect(text()).toContain('Nothing is waiting on you');
  });

  it('shows an error with Retry when the list cannot load', () => {
    fixture.componentRef.setInput('state', 'error');
    fixture.detectChanges();
    expect(text()).toContain('Unavailable');
    expect(
      fixture.nativeElement.querySelector('.inbox-error button')
    ).toBeTruthy();
  });

  it('words ages', () => {
    const now = Date.parse('2026-01-10T00:00:00Z');
    expect(ageOf(null, now)).toBe('');
    expect(ageOf('2026-01-09T23:30:00Z', now)).toBe('under an hour');
    expect(ageOf('2026-01-09T00:00:00Z', now)).toBe('24 hours');
    expect(ageOf('2026-01-01T00:00:00Z', now)).toBe('9 days');
  });
});
