import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ContactStripComponent } from './contact-strip.component';

describe('ContactStripComponent', () => {
  it('shows the required phone, email, and website with working links', () => {
    TestBed.configureTestingModule({
      imports: [ContactStripComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(ContactStripComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const links = Array.from(element.querySelectorAll('a')).map((link) => [
      link.textContent?.trim(),
      link.getAttribute('href'),
    ]);

    expect(links).toEqual([
      ['912-521-7314', 'tel:+19125217314'],
      [
        'chris@hopefulaspirationsindustries.com',
        'mailto:chris@hopefulaspirationsindustries.com',
      ],
      ['Contact form', '/contact'],
    ]);
    expect(element.textContent).toContain('hopefulaspirationsindustries.com');
  });
});
