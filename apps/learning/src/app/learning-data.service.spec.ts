import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { LearningDataService, NotSignedInError } from './learning-data.service';

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
