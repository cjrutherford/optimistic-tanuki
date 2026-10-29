import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PublicInfoFooterComponent } from './public-info-footer.component';

describe('PublicInfoFooterComponent', () => {
  let component: PublicInfoFooterComponent;
  let fixture: ComponentFixture<PublicInfoFooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicInfoFooterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicInfoFooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps the product identity and public contact link available in the shell', () => {
    fixture.componentRef.setInput('productName', 'Towne Square');
    fixture.componentRef.setInput(
      'tagline',
      'Connect around the places that matter to you.'
    );
    fixture.detectChanges();

    const footer = fixture.nativeElement.querySelector('footer');
    const link = footer.querySelector('a') as HTMLAnchorElement;

    expect(footer.textContent).toContain('Towne Square');
    expect(footer.textContent).toContain(
      'Connect around the places that matter to you.'
    );
    expect(link.getAttribute('href')).toBe('/contact');
    expect(link.textContent.trim()).toBe('Contact and support');
  });
});
