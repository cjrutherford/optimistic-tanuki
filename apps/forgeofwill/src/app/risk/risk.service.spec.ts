import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { RiskService } from './risk.service';
import { CreateRisk, QueryRisk, Risk } from '@optimistic-tanuki/ui-models';
import { ProfileService } from '../profile/profile.service';

describe('RiskService', () => {
  let service: RiskService;
  let httpMock: HttpTestingController;
  let profileServiceMock: any;

  const mockProfile = { id: 'user1', profileName: 'Test User' };

  beforeEach(() => {
    profileServiceMock = {
      getCurrentUserProfile: jest.fn().mockReturnValue(mockProfile),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        RiskService,
        { provide: ProfileService, useValue: profileServiceMock },
      ],
    });
    service = TestBed.inject(RiskService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getRisks', () => {
    it('should retrieve risks successfully', () => {
      const expectedResponse: Risk[] = [{ id: '1', description: 'Test Risk', projectId: '1', impact: 'LOW', likelihood: 'UNLIKELY', status: 'OPEN', riskOwner: 'user1', createdBy: 'user1', createdAt: new Date(), updatedAt: new Date() }];

      service.getRisks().subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/risk/');
      expect(req.request.method).toBe('GET');
      req.flush(expectedResponse);
    });
  });

  describe('queryRisks', () => {
    it('should query risks successfully', () => {
      const mockQuery: QueryRisk = { projectId: '1' };
      const expectedResponse: Risk[] = [{ id: '1', description: 'Test Risk', projectId: '1', impact: 'LOW', likelihood: 'UNLIKELY', status: 'OPEN', riskOwner: 'user1', createdBy: 'user1', createdAt: new Date(), updatedAt: new Date() }];

      service.queryRisks(mockQuery).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/risk/query');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockQuery);
      req.flush(expectedResponse);
    });
  });

  describe('createRisk', () => {
    it('should create a risk successfully', () => {
      const createRiskDto: CreateRisk = { description: 'New Risk', projectId: '1', impact: 'LOW', likelihood: 'UNLIKELY', status: 'OPEN', riskOwner: '', createdBy: '' };
      const expectedResponse: Risk = { id: '1', ...createRiskDto, riskOwner: mockProfile.id, createdBy: mockProfile.id, createdAt: new Date(), updatedAt: new Date() };

      service.createRisk(createRiskDto).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/risk/');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.createdBy).toBe(mockProfile.id);
      expect(req.request.body.riskOwner).toBe(mockProfile.id);
      req.flush(expectedResponse);
    });

    it('should throw an error if user profile is not available', () => {
      profileServiceMock.getCurrentUserProfile.mockReturnValue(null);
      const createRiskDto: CreateRisk = { description: 'New Risk', projectId: '1', impact: 'LOW', likelihood: 'UNLIKELY', status: 'OPEN', riskOwner: '', createdBy: '' };
      expect(() => service.createRisk(createRiskDto)).toThrow('User profile is not available');
    });
  });

  describe('getRiskById', () => {
    it('should retrieve a risk by ID successfully', () => {
      const expectedResponse: Risk = { id: '1', description: 'Test Risk', projectId: '1', impact: 'LOW', likelihood: 'UNLIKELY', status: 'OPEN', riskOwner: 'user1', createdBy: 'user1', createdAt: new Date(), updatedAt: new Date() };

      service.getRiskById('1').subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/risk/1');
      expect(req.request.method).toBe('GET');
      req.flush(expectedResponse);
    });
  });

  describe('updateRisk', () => {
    it('should update a risk successfully', () => {
      const mockRisk: Risk = { id: '1', description: 'Updated Risk', projectId: '1', impact: 'LOW', likelihood: 'UNLIKELY', status: 'OPEN', riskOwner: 'user1', createdBy: 'user1', createdAt: new Date(), updatedAt: new Date() };
      const expectedResponse: Risk = { ...mockRisk, description: 'Updated Risk' };

      service.updateRisk('1', mockRisk).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/risk');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(mockRisk);
      req.flush(expectedResponse);
    });
  });

  describe('deleteRisk', () => {
    it('should delete a risk successfully', () => {
      service.deleteRisk('1').subscribe(response => {
        expect(response).toBeUndefined(); // DELETE often returns undefined or empty object
      });

      const req = httpMock.expectOne('/api/project-planning/risk/1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
