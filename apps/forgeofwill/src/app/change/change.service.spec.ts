import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { ChangeService } from './change.service';
import { Change, CreateChange, QueryChange } from '@optimistic-tanuki/ui-models';

describe('ChangeService', () => {
  let service: ChangeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ChangeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createChange', () => {
    it('should create a change successfully', () => {
      const mockChange: CreateChange = { changeDate: new Date(), projectId: '1', changeType: 'ADDITION', changeStatus: 'PENDING', changeDescription: 'Test', requestor: 'User', resolution: 'PENDING' };
      const expectedResponse: Change = { id: '1', ...mockChange, updatedAt: new Date() };

      service.createChange(mockChange).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/changes');
      expect(req.request.method).toBe('POST');
      req.flush(expectedResponse);
    });
  });

  describe('getChanges', () => {
    it('should retrieve changes successfully', () => {
      const expectedResponse: Change[] = [{ id: '1', changeDate: new Date(), projectId: '1', changeType: 'ADDITION', changeStatus: 'PENDING', changeDescription: 'Test', requestor: 'User', resolution: 'PENDING', updatedAt: new Date() }];

      service.getChanges().subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/changes');
      expect(req.request.method).toBe('GET');
      req.flush(expectedResponse);
    });
  });

  describe('queryChanges', () => {
    it('should query changes successfully', () => {
      const mockQuery: QueryChange = { projectId: '1', createdAt: [new Date(), new Date()], updatedAt: [new Date(), new Date()] };
      const expectedResponse: Change[] = [{ id: '1', changeDate: new Date(), projectId: '1', changeType: 'ADDITION', changeStatus: 'PENDING', changeDescription: 'Test', requestor: 'User', resolution: 'PENDING', updatedAt: new Date() }];

      service.queryChanges(mockQuery).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/changes/query');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockQuery);
      req.flush(expectedResponse);
    });
  });

  describe('deleteChange', () => {
    it('should delete a change successfully', () => {
      service.deleteChange('1').subscribe(response => {
        expect(response).toBeNull(); // DELETE often returns null or empty object
      });

      const req = httpMock.expectOne('/api/project-planning/changes/1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getChangeById', () => {
    it('should retrieve a change by ID successfully', () => {
      const expectedResponse: Change = { id: '1', changeDate: new Date(), projectId: '1', changeType: 'ADDITION', changeStatus: 'PENDING', changeDescription: 'Test', requestor: 'User', resolution: 'PENDING', updatedAt: new Date() };

      service.getChangeById('1').subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/changes/1');
      expect(req.request.method).toBe('GET');
      req.flush(expectedResponse);
    });
  });

  describe('updateChange', () => {
    it('should update a change successfully', () => {
      const mockChange: Change = { id: '1', changeDate: new Date(), projectId: '1', changeType: 'ADDITION', changeStatus: 'PENDING', changeDescription: 'Updated', requestor: 'User', resolution: 'PENDING', updatedAt: new Date() };
      const expectedResponse: Change = { ...mockChange, changeDescription: 'Updated' };

      service.updateChange(mockChange).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/changes');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(mockChange);
      req.flush(expectedResponse);
    });
  });
});
