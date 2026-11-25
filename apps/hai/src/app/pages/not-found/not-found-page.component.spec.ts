import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotFoundPageComponent } from './not-found-page.component';

describe('NotFoundPageComponent', () => {
  it('answers the server render with a 404 and links back into the site', () => {
    const responseInit: ResponseInit = {};
    TestBed.configureTestingModule({
      imports: [NotFoundPageComponent],
      providers: [
        provideRouter([]),
        { provide: RESPONSE_INIT, useValue: responseInit },
      ],
    });

    const fixture = TestBed.createComponent(NotFoundPageComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(responseInit.status).toBe(404);
    expect(element.querySelector('h1')?.textContent).toContain(
      'Page not found'
    );
    expect(
      Array.from(element.querySelectorAll('a')).map((a) =>
        a.getAttribute('href')
      )
    ).toEqual(['/', '/private-cloud', '/technical-support', '/contact']);
  });

  it('renders in the browser, where there is no response to set', () => {
    TestBed.configureTestingModule({
      imports: [NotFoundPageComponent],
      providers: [provideRouter([])],
    });

    expect(() =>
      TestBed.createComponent(NotFoundPageComponent).detectChanges()
    ).not.toThrow();
  });
});
