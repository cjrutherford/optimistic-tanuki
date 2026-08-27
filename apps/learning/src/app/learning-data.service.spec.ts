import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  LearningDataService,
  NotSignedInError,
  Program,
  programVariantLabel,
} from './learning-data.service';

describe('LearningDataService', () => {
  let service: LearningDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LearningDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts submitted code to the exercise submit route', () => {
    const result = jest.fn();
    service.submit('go-b-01', 'package main').subscribe(result);

    const request = http.expectOne('/api/learning/exercises/go-b-01/submit');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ code: 'package main' });

    request.flush({
      output: 'ok',
      errors: [],
      passed: true,
      awardedPoints: 10,
      progress: {
        lessonId: 'b-01',
        completed: false,
        completedExerciseIds: ['go-b-01'],
        points: 10,
      },
    });

    expect(result).toHaveBeenCalledWith(
      expect.objectContaining({ passed: true, awardedPoints: 10 })
    );
  });

  it('turns a 401 on submit into a NotSignedInError', () => {
    const failure = jest.fn();
    service.submit('go-b-01', 'package main').subscribe({ error: failure });

    http
      .expectOne('/api/learning/exercises/go-b-01/submit')
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(failure).toHaveBeenCalledWith(expect.any(NotSignedInError));
  });

  it('leaves other submit failures alone', () => {
    const failure = jest.fn();
    service.submit('go-b-01', 'package main').subscribe({ error: failure });

    http
      .expectOne('/api/learning/exercises/go-b-01/submit')
      .flush('Boom', { status: 500, statusText: 'Server Error' });

    expect(failure).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500 })
    );
  });

  it('reports no progress rather than failing when the visitor is anonymous', () => {
    const progress = jest.fn();
    service.myProgress().subscribe(progress);

    http
      .expectOne('/api/learning/me/progress')
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(progress).toHaveBeenCalledWith([]);
  });

  it('posts code to the run route', () => {
    const result = jest.fn();
    service.run('go-b-01', 'package main').subscribe(result);

    const request = http.expectOne('/api/learning/runs');
    expect(request.request.body).toEqual({
      activityId: 'go-b-01',
      code: 'package main',
    });
    request.flush({ output: 'hello', errors: [] });

    expect(result).toHaveBeenCalledWith(
      expect.objectContaining({ output: 'hello' })
    );
  });

  it('turns a 401 on run into a NotSignedInError', () => {
    const failure = jest.fn();
    service.run('go-b-01', 'package main').subscribe({ error: failure });

    http
      .expectOne('/api/learning/runs')
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(failure).toHaveBeenCalledWith(expect.any(NotSignedInError));
  });

  it('leaves other run failures alone', () => {
    const failure = jest.fn();
    service.run('go-b-01', 'package main').subscribe({ error: failure });

    http
      .expectOne('/api/learning/runs')
      .flush('Boom', { status: 500, statusText: 'Server Error' });

    expect(failure).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500 })
    );
  });
});

/**
 * The label above a track's name used to read supportedLanguageIds[0], which
 * assumed the track taught a programming language. The catalog is meant to
 * hold courses about anything.
 */
describe('programVariantLabel', () => {
  const program = (overrides: Partial<Program>): Program => ({
    id: 'p',
    displayName: 'A course',
    offerings: [],
    ...overrides,
  });

  it('names the variant a track varies along', () => {
    expect(
      programVariantLabel(
        program({
          variantAxis: {
            id: 'language',
            displayName: 'Language',
            options: [{ id: 'go', displayName: 'Go' }],
          },
        })
      )
    ).toBe('Go');
  });

  it('says nothing about a track that varies along nothing', () => {
    expect(programVariantLabel(program({}))).toBe('');
  });

  it('does not fall back to a language id', () => {
    expect(programVariantLabel(program({ supportedLanguageIds: ['go'] }))).toBe(
      ''
    );
  });
});

/**
 * The entrance page rendered "Nothing has been published here yet" on every
 * server-side first paint, because an unloaded catalog and an empty one were
 * the same value. Found by looking at the rendered HTML, not by a test.
 */
describe('LearningDataService server-side reads', () => {
  function serviceOnServer(): LearningDataService {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: API_BASE_URL, useValue: 'http://gateway:3000/api' },
      ],
    });
    return TestBed.inject(LearningDataService);
  }

  // catalog() and subjects() are @Public() gateway routes, so the server may
  // call them directly. This is the behaviour this whole change is for: a
  // signed-out visitor's first paint should have real courses in it.
  it('fetches the catalog from the gateway, using the injected base URL', () => {
    const emitted = jest.fn();
    const catalog = [
      {
        id: 't1',
        displayName: 'Go',
        subjectIds: [],
        focuses: [],
        offerings: [],
      },
    ];

    serviceOnServer().catalog().subscribe(emitted);

    const request = TestBed.inject(HttpTestingController).expectOne(
      'http://gateway:3000/api/learning/programs'
    );
    request.flush(catalog);

    expect(emitted).toHaveBeenCalledWith(catalog);
  });

  it('fetches subjects from the gateway the same way', () => {
    const emitted = jest.fn();
    const subjects = [
      { subjectId: 's1', displayName: 'Go', focusNames: [], courseCount: 1 },
    ];

    serviceOnServer().subjects().subscribe(emitted);

    const request = TestBed.inject(HttpTestingController).expectOne(
      'http://gateway:3000/api/learning/subjects'
    );
    request.flush(subjects);

    expect(emitted).toHaveBeenCalledWith(subjects);
  });

  // The render must not hang because the gateway is slow or down. A timed
  // out or failed server-side read completes without emitting, exactly like
  // the old unconditional EMPTY, so it stays distinguishable from a genuinely
  // empty catalog rather than becoming `of([])`.
  it('degrades to the loading state, not an empty list, when the gateway times out', fakeAsync(() => {
    const emitted = jest.fn();
    const completed = jest.fn();

    serviceOnServer()
      .catalog()
      .subscribe({ next: emitted, complete: completed });

    TestBed.inject(HttpTestingController).expectOne(
      'http://gateway:3000/api/learning/programs'
    );
    tick(2001);

    expect(emitted).not.toHaveBeenCalled();
    expect(completed).toHaveBeenCalled();
    TestBed.inject(HttpTestingController).verify();
  }));

  it('degrades the same way when the gateway errors', () => {
    const emitted = jest.fn();
    const completed = jest.fn();

    serviceOnServer()
      .subjects()
      .subscribe({ next: emitted, complete: completed });

    TestBed.inject(HttpTestingController)
      .expectOne('http://gateway:3000/api/learning/subjects')
      .flush('Boom', { status: 503, statusText: 'Service Unavailable' });

    expect(emitted).not.toHaveBeenCalled();
    expect(completed).toHaveBeenCalled();
  });

  it('does not claim a single course is empty before anyone has asked', () => {
    const emitted = jest.fn();

    serviceOnServer().offering('go-100').subscribe({ next: emitted });

    expect(emitted).not.toHaveBeenCalled();
    TestBed.inject(HttpTestingController).verify();
  });
});
