import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';

describe('AppComponent', () => {
  let brandConfig: BrandConfigService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    brandConfig = TestBed.inject(BrandConfigService);
  });

  it('renders the application shell without whitebox in title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    expect(app.title).toContain('Field Flow');
    expect(app.title.toLowerCase()).not.toContain('whitebox');
  });

  it('never uses the term slice in client-facing elements', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent?.toLowerCase() || '';
    expect(text).not.toContain('slice');
  });
});
