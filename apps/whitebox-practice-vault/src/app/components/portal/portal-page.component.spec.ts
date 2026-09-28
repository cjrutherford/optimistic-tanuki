import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PortalPageComponent } from './portal-page.component';

describe('PortalPageComponent', () => {
  let component: PortalPageComponent;
  let fixture: ComponentFixture<PortalPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortalPageComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PortalPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders brand heading and statutory modules', () => {
    expect(component).toBeTruthy();
    const title = fixture.nativeElement.querySelector('.hero-title');
    expect(title.textContent).toContain('Practice Vault');
    const cards = fixture.nativeElement.querySelectorAll('.module-card');
    expect(cards.length).toBe(3);
  });

  it('excludes whitebox and slice terminology from text content', () => {
    const text = fixture.nativeElement.textContent.toLowerCase();
    expect(text).not.toContain('whitebox');
    expect(text).not.toContain('slice');
  });

  it('uses token-required routes instead of demo session links', () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll(
        'a'
      ) as NodeListOf<HTMLAnchorElement>
    ).map((link) => link.getAttribute('href'));

    expect(links).toEqual(expect.arrayContaining(['/drop', '/escrow-verify']));
    expect(links.join(' ')).not.toContain('demo-');
  });
});
