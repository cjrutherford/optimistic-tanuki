import { TestBed } from '@angular/core/testing';
import { NavSidebarComponent } from './nav-sidebar.component';

describe('NavSidebarComponent', () => {
  beforeEach(async () => {
    Object.defineProperty(window, 'scrollTo', {
      value: jest.fn(),
      writable: true,
    });

    await TestBed.configureTestingModule({
      imports: [NavSidebarComponent],
    }).compileComponents();
  });

  it('renders nested tree nodes when nav items include children', () => {
    const fixture = TestBed.createComponent(NavSidebarComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('heading', 'Tenant navigation');
    fixture.componentRef.setInput('navItems', [
      {
        label: 'Tenant',
        children: [
          {
            label: 'Plans',
            children: [{ label: 'Operating Plan' }],
          },
          {
            label: 'Accounts',
            children: [{ label: 'Transactions' }],
          },
        ],
      },
    ]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Tenant');
    expect(text).toContain('Plans');
    expect(text).toContain('Operating Plan');
    expect(text).toContain('Accounts');
    expect(text).toContain('Transactions');
  });
});
