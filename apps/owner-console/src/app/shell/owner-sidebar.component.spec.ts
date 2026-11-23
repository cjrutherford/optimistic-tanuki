import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OwnerSidebarComponent } from './owner-sidebar.component';
import { OwnerNavGroup } from '../owner-nav';
import { NavBadge } from '../services/attention.service';

const groups: OwnerNavGroup[] = [
  {
    id: 'ops',
    label: 'Operations',
    icon: 'O',
    leaves: [
      {
        label: 'Orders',
        path: '/dashboard/store/orders',
        icon: 'o',
        countSource: 'commerce.orders',
      },
      {
        label: 'Leads',
        path: '/dashboard/contacts',
        icon: 'l',
        countSource: 'leads.new',
      },
      {
        label: 'Appointments',
        path: '/dashboard/store/appointments',
        icon: 'a',
        countSource: 'commerce.appointments',
      },
    ],
  },
];

describe('OwnerSidebarComponent badges', () => {
  let fixture: ComponentFixture<OwnerSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OwnerSidebarComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(OwnerSidebarComponent);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('activePath', '/dashboard/store/orders');
  });

  const badges = (map: Record<string, NavBadge>) => {
    fixture.componentRef.setInput('badges', map);
    fixture.detectChanges();
    return Array.from(
      fixture.nativeElement.querySelectorAll('.badge')
    ) as HTMLElement[];
  };

  it('shows a count, a "!" for unavailable, and nothing for zero', () => {
    const rendered = badges({
      'commerce.orders': {
        kind: 'count',
        count: 4,
        capped: false,
        label: '4 waiting',
      },
      'leads.new': { kind: 'unavailable', label: 'Could not be loaded' },
    });
    expect(rendered).toHaveLength(2);
    expect(rendered[0].textContent?.trim()).toBe('4');
    expect(rendered[0].getAttribute('aria-label')).toBe('4 waiting');
    expect(rendered[1].textContent?.trim()).toBe('!');
    expect(rendered[1].getAttribute('aria-label')).toBe('Could not be loaded');
    // Appointments has no entry: no badge at all.
    const links = fixture.nativeElement.querySelectorAll('a.link');
    expect(links[2].querySelector('.badge')).toBeNull();
  });

  it('caps long counts and marks lower bounds', () => {
    const rendered = badges({
      'commerce.orders': {
        kind: 'count',
        count: 120,
        capped: false,
        label: '120 waiting',
      },
      'leads.new': { kind: 'count', count: 100, capped: true, label: 'x' },
    });
    expect(rendered[0].textContent?.trim()).toBe('99+');
    expect(rendered[1].textContent?.trim()).toBe('99+');
  });
});
