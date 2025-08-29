import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { JournalService } from './journal.service';
import { CreateProjectJournal, ProjectJournal, QueryProjectJournal } from '@optimistic-tanuki/ui-models';

describe('JournalService', () => {
  let service: JournalService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(JournalService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createJournalEntry', () => {
    it('should create a journal entry successfully', () => {
      const mockJournal: CreateProjectJournal = { content: 'Test Entry', projectId: '1', profileId: '1', createdAt: new Date() };
      const expectedResponse: ProjectJournal = { id: '1', ...mockJournal, createdAt: new Date(), updatedAt: new Date() };

      service.createJournalEntry(mockJournal).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/journal');
      expect(req.request.method).toBe('POST');
      req.flush(expectedResponse);
    });
  });

  describe('getJournalEntries', () => {
    it('should retrieve journal entries successfully', () => {
      const expectedResponse: ProjectJournal[] = [{ id: '1', content: 'Test Entry', projectId: '1', profileId: '1', createdAt: new Date(), updatedAt: new Date() }];

      service.getJournalEntries().subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/journal');
      expect(req.request.method).toBe('GET');
      req.flush(expectedResponse);
    });
  });

  describe('queryJournalEntries', () => {
    it('should query journal entries successfully', () => {
      const mockQuery: QueryProjectJournal = { projectId: '1' };
      const expectedResponse: ProjectJournal[] = [{ id: '1', content: 'Test Entry', projectId: '1', profileId: '1', createdAt: new Date(), updatedAt: new Date() }];

      service.queryJournalEntries(mockQuery).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/journal/query');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockQuery);
      req.flush(expectedResponse);
    });
  });

  describe('deleteJournalEntry', () => {
    it('should delete a journal entry successfully', () => {
      service.deleteJournalEntry('1').subscribe(response => {
        expect(response).toBeNull(); // DELETE often returns null or empty object
      });

      const req = httpMock.expectOne('/api/project-planning/journal/1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getJournalEntryById', () => {
    it('should retrieve a journal entry by ID successfully', () => {
      const expectedResponse: ProjectJournal = { id: '1', content: 'Test Entry', projectId: '1', profileId: '1', createdAt: new Date(), updatedAt: new Date() };

      service.getJournalEntryById('1').subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/journal/1');
      expect(req.request.method).toBe('GET');
      req.flush(expectedResponse);
    });
  });

  describe('updateJournalEntry', () => {
    it('should update a journal entry successfully', () => {
      const mockJournal: ProjectJournal = { id: '1', content: 'Updated Entry', projectId: '1', profileId: '1', createdAt: new Date(), updatedAt: new Date() };
      const expectedResponse: ProjectJournal = { ...mockJournal, content: 'Updated Entry' };

      service.updateJournalEntry(mockJournal).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/journal');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(mockJournal);
      req.flush(expectedResponse);
    });
  });
});
