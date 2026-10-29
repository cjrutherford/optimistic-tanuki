import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PublicContactPageComponent } from './public-contact-page.component';

describe('PublicContactPageComponent', () => {
  let component: PublicContactPageComponent;
  let fixture: ComponentFixture<PublicContactPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicContactPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicContactPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the approved contact destinations without introducing a request form', () => {
    expect(component).toBeTruthy();

    const root = fixture.nativeElement as HTMLElement;
    const email = root.querySelector('a[href^="mailto:"]') as HTMLAnchorElement;

    expect(root.querySelector('h1')?.textContent).toContain(
      'Contact Hopeful Aspirations Industries'
    );
    expect(email.getAttribute('href')).toBe(
      'mailto:support@hopefulaspirationsindustries.com'
    );
    expect(root.textContent).toContain('the United States and its territories');
    expect(root.textContent).toContain('The HAI owner monitors this inbox.');
    expect(root.textContent).toContain('We do not promise a response time.');
    expect(root.querySelector('form')).toBeNull();
  });
});
