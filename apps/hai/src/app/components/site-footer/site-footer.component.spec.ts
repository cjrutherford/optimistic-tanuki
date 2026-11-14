import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CONTACT_DETAILS } from '../../content/contact-details';
import { HEADER_LINKS } from '../../content/navigation';
import { SITE_NAME } from '../../content/seo';
import { SiteFooterComponent } from './site-footer.component';

describe('SiteFooterComponent', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({
      imports: [SiteFooterComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(SiteFooterComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('is a footer landmark', () => {
    expect(render().querySelector('footer')).not.toBeNull();
  });

  it('links to the key pages from the shared navigation constants', () => {
    const nav = render().querySelector('nav[aria-label="Footer"]');
    const links = Array.from(nav?.querySelectorAll('a') ?? []).map((link) => [
      link.textContent?.trim(),
      link.getAttribute('href'),
    ]);

    expect(links).toEqual(HEADER_LINKS.map((l) => [l.label, l.route]));
  });

  it('shows the phone and email from the contact constants', () => {
    const element = render();
    const phone = element.querySelector(
      `a[href="${CONTACT_DETAILS.phoneHref}"]`
    );
    const email = element.querySelector(
      `a[href="mailto:${CONTACT_DETAILS.email}"]`
    );

    expect(phone?.textContent?.trim()).toBe(CONTACT_DETAILS.phone);
    expect(email?.textContent?.trim()).toBe(CONTACT_DETAILS.email);
  });

  it('ends with a copyright line for the current year', () => {
    const text = render().querySelector('.copyright')?.textContent;

    expect(text).toContain(`© ${new Date().getFullYear()} ${SITE_NAME}`);
  });
});
