import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AboutComponent } from './about.component';

describe('AboutComponent', () => {
  let component: AboutComponent;
  let fixture: ComponentFixture<AboutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('is personal prose rather than a capability list', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('About me');
    expect(compiled.textContent).toContain(
      'how complicated systems fit together'
    );
    expect(compiled.textContent).toContain(
      'more control over their digital lives'
    );
    expect(compiled.textContent).not.toContain('Capabilities');
  });

  it('links Hopeful Aspirations Industries', () => {
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'a[href="https://hopefulaspirationsindustries.com"]'
    );

    expect(link?.textContent).toContain('Hopeful Aspirations Industries');
  });
});
