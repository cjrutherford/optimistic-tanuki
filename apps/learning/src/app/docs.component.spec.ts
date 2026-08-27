import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { DocsComponent } from './docs.component';

describe('DocsComponent', () => {
  async function render() {
    TestBed.configureTestingModule({
      imports: [DocsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(DocsComponent);
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

  it('renders signed out, with both sections', async () => {
    const element = await render();

    expect(element.querySelector('#learners')).not.toBeNull();
    expect(element.querySelector('#authors')).not.toBeNull();
  });

  it('offers a way back to the catalog', async () => {
    const element = await render();
    const back = element.querySelector('.back');

    expect(back?.getAttribute('href')).toBe('/courses');
  });
});
