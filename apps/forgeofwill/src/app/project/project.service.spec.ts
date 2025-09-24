import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { ProjectService } from './project.service';
import { CreateProject, Project, QueryProject } from '@optimistic-tanuki/ui-models';
import { ProfileService } from '../profile/profile.service';

describe('ProjectService', () => {
  let service: ProjectService;
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
        ProjectService,
        { provide: ProfileService, useValue: profileServiceMock },
      ],
    });
    service = TestBed.inject(ProjectService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createProject', () => {
    it('should create a project successfully', () => {
      const createProjectDto: CreateProject = { name: 'Test Project', description: 'Test Desc', owner: '', createdBy: '', members: [], startDate: new Date(), endDate: new Date(), status: 'IN_PROGRESS' };
      const expectedResponse: Project = { id: '1', ...createProjectDto, owner: mockProfile.id, createdBy: mockProfile.id, createdAt: new Date(), updatedAt: new Date(), tasks: [], risks: [], changes: [], journalEntries: [], timers: [], endDate: new Date() };

      service.createProject(createProjectDto).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/projects');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.createdBy).toBe(mockProfile.id);
      expect(req.request.body.owner).toBe(mockProfile.id);
      req.flush(expectedResponse);
    });

    it('should throw an error if no profile is selected', () => {
      profileServiceMock.getCurrentUserProfile.mockReturnValue(null);
      const createProjectDto: CreateProject = { name: 'Test Project', description: 'Test Desc', owner: '', createdBy: '', members: [], startDate: new Date(), endDate: new Date(), status: 'IN_PROGRESS' };
      expect(() => service.createProject(createProjectDto)).toThrow('No profile selected. Please select a profile before creating a project.');
    });
  });

  describe('getProjects', () => {
    it('should retrieve projects successfully', () => {
      const expectedResponse: Project[] = [{ id: '1', name: 'Test Project', description: 'Test Desc', owner: 'user1', createdBy: 'user1', members: [], startDate: new Date(), status: 'IN_PROGRESS', createdAt: new Date(), updatedAt: new Date(), endDate: new Date(), tasks: [], risks: [], changes: [], journalEntries: [], timers: [] }];

      service.getProjects().subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/projects');
      expect(req.request.method).toBe('GET');
      req.flush(expectedResponse);
    });
  });

  describe('queryProjects', () => {
    it('should query projects successfully', () => {
      const mockQuery: QueryProject = { name: 'Test Project', owner: 'user1', members: [], description: 'Test Desc', createdAt: [new Date(), new Date()], updatedAt: [new Date(), new Date()] };
      const expectedResponse: Project[] = [{ id: '1', name: 'Test Project', description: 'Test Desc', owner: 'user1', createdBy: 'user1', members: [], startDate: new Date(), status: 'IN_PROGRESS', createdAt: new Date(), updatedAt: new Date(), endDate: new Date(), tasks: [], risks: [], changes: [], journalEntries: [], timers: [] }];

      service.queryProjects(mockQuery).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/projects/query');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockQuery);
      req.flush(expectedResponse);
    });
  });

  describe('getProjectById', () => {
    it('should retrieve a project by ID successfully', () => {
      const expectedResponse: Project = { id: '1', name: 'Test Project', description: 'Test Desc', owner: 'user1', createdBy: 'user1', members: [], startDate: new Date(), status: 'IN_PROGRESS', createdAt: new Date(), updatedAt: new Date(), endDate: new Date(), tasks: [], risks: [], changes: [], journalEntries: [], timers: [] };

      service.getProjectById('1').subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/projects/1');
      expect(req.request.method).toBe('GET');
      req.flush(expectedResponse);
    });
  });

  describe('updateProject', () => {
    it('should update a project successfully', () => {
      const mockProject: Project = { id: '1', name: 'Updated Project', description: 'Test Desc', owner: 'user1', createdBy: 'user1', members: [], startDate: new Date(), status: 'IN_PROGRESS', createdAt: new Date(), updatedAt: new Date(), endDate: new Date(), tasks: [], risks: [], changes: [], journalEntries: [], timers: [] };
      const expectedResponse: Project = { ...mockProject, name: 'Updated Project' };

      service.updateProject(mockProject).subscribe(response => {
        expect(response).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne('/api/project-planning/projects');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(mockProject);
      req.flush(expectedResponse);
    });
  });

  describe('deleteProject', () => {
    it('should delete a project successfully', () => {
      service.deleteProject('1').subscribe(response => {
        expect(response).toBeUndefined(); // DELETE often returns undefined or empty object
      });

      const req = httpMock.expectOne('/api/project-planning/projects/1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
