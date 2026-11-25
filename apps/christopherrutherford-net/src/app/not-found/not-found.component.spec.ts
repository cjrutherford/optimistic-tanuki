import { DOCUMENT } from '@angular/common';
import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { NOT_FOUND_TITLE, NotFoundComponent } from './not-found.component';

describe('NotFoundComponent', () => {
  let document: Document;
  const responseInit: ResponseInit = {};

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [
        provideRouter([]),
        { provide: RESPONSE_INIT, useValue: responseInit },
      ],
    });
    document = TestBed.inject(DOCUMENT);
    const canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    canonical.setAttribute('href', 'https://christopherrutherford.net/');
    document.head.appendChild(canonical);
    TestBed.inject(Title).setTitle('Home');
  });

  afterEach(() => {
    document.head
      .querySelectorAll('link[rel="canonical"]')
      .forEach((link) => link.remove());
  });

  it('answers with a 404, marks the page noindex and drops the canonical', () => {
    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();

    expect(responseInit.status).toBe(404);
    expect(document.title).toBe(NOT_FOUND_TITLE);
    expect(
      document.head
        .querySelector('meta[name="robots"]')
        ?.getAttribute('content')
    ).toBe('noindex');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('restores the title and canonical and clears noindex when it leaves', () => {
    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
    fixture.destroy();

    expect(document.title).toBe('Home');
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    expect(
      document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')
    ).toBe('https://christopherrutherford.net/');
  });
});
