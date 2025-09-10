import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { TimerService } from './timer.service';
import { CreateTimer, Timer, TimerStatus } from '@optimistic-tanuki/ui-models';

describe('TimerService', () => {
  let service: TimerService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(TimerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createTimer', () => {
    it('should create a timer successfully', () => {
      const mockTimer: CreateTimer = { taskId: '1', startTime: new Date(), endTime: new Date(), elapsedTime: 100, status: 'Running' };
      const expectedResponse: Timer = { id: '1', ...mockTimer, updatedAt: new Date(), deletedAt: new Date() };

      service.createTimer(mockTimer).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/timers');
      expect(req.request.method).toBe('POST');
      req.flush(expectedResponse);
    });
  });

  describe('getTimers', () => {
    it('should retrieve timers successfully', () => {
      const expectedResponse: Timer[] = [{ id: '1', taskId: '1', startTime: new Date(), endTime: new Date(), elapsedTime: 100, status: 'Running', updatedAt: new Date(), deletedAt: new Date() }];

      service.getTimers().subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/timers');
      expect(req.request.method).toBe('GET');
      req.flush(expectedResponse);
    });
  });

  describe('getTimerById', () => {
    it('should retrieve a timer by ID successfully', () => {
      const expectedResponse: Timer = { id: '1', taskId: '1', startTime: new Date(), endTime: new Date(), elapsedTime: 100, status: 'Running', updatedAt: new Date(), deletedAt: new Date() };

      service.getTimerById('1').subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/timers/1');
      expect(req.request.method).toBe('GET');
      req.flush(expectedResponse);
    });
  });

  describe('updateTimer', () => {
    it('should update a timer successfully', () => {
      const mockTimer: Timer = { id: '1', taskId: '1', startTime: new Date(), endTime: new Date(), elapsedTime: 120, status: 'Running', updatedAt: new Date(), deletedAt: new Date() };
      const expectedResponse: Timer = { ...mockTimer, elapsedTime: 120 };

      service.updateTimer(mockTimer).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/timers');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(mockTimer);
      req.flush(expectedResponse);
    });
  });

  describe('deleteTimer', () => {
    it('should delete a timer successfully', () => {
      service.deleteTimer('1').subscribe(response => {
        expect(response).toBeNull(); // DELETE often returns null or empty object
      });

      const req = httpMock.expectOne('/api/project-planning/timers/1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
