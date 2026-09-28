import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates header and displays brand titles', () => {
    expect(component).toBeTruthy();
    const brand = fixture.nativeElement.querySelector('.brand-title');
    expect(brand.textContent).toContain('Practice Vault');
    const sub = fixture.nativeElement.querySelector('.brand-sub');
    expect(sub.textContent).toContain('Escrow Wire Shield');
  });

  it('renders statutory compliance badges', () => {
    const badges = fixture.nativeElement.querySelectorAll('.statutory-pill');
    expect(badges.length).toBe(3);
    expect(badges[0].textContent).toContain('FTC 16 CFR Part 314');
  });

  it('uses token-required routes instead of demo session links', () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll(
        'a'
      ) as NodeListOf<HTMLAnchorElement>
    ).map((link) => link.getAttribute('href'));

    expect(links).toEqual(
      expect.arrayContaining(['/drop', '/escrow-verify', '/admin/compliance'])
    );
    expect(links.join(' ')).not.toContain('demo-');
  });
});
