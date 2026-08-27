import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AboutComponent } from './about.component';

describe('AboutComponent', () => {
  async function render() {
    TestBed.configureTestingModule({
      imports: [AboutComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(AboutComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    for (const pending of http.match('/api/learning/me')) pending.flush(null);
    for (const pending of http.match('/api/learning/dashboard')) {
      pending.flush([]);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  // This is the page a signed-out visitor deciding whether to spend a
  // weekend writing a course lands on, so it must render with no session.
  it('renders signed out', async () => {
    const element = await render();

    expect(element.textContent).toContain('argument');
  });

  it('offers a way back to the catalog', async () => {
    const element = await render();
    const back = element.querySelector('.back');

    expect(back?.getAttribute('href')).toBe('/courses');
  });
});
