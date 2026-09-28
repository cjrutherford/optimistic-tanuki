import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ProjectNexusApiService } from './project-nexus-api.service';

describe('ProjectNexusApiService', () => {
  let service: ProjectNexusApiService;
  let httpMock: HttpTestingController;
  const projectId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProjectNexusApiService],
    });
    service = TestBed.inject(ProjectNexusApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('reads milestones for a project', () => {
    service.getMilestones(projectId).subscribe((res) => {
      expect(res).toHaveLength(1);
    });

    const req = httpMock.expectOne(
      `/api/v1/nexus/projects/${projectId}/milestones`
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush([{ id: 'm-1' }]);
  });

  it('pins the path project onto uploads and submissions', () => {
    service
      .uploadInspectionPhoto(projectId, {
        projectId: 'attacker-project',
        fileName: 'pour.jpg',
        mimeType: 'image/jpeg',
        fileBase64: 'aGVsbG8=',
      })
      .subscribe();

    const upload = httpMock.expectOne(
      `/api/v1/nexus/projects/${projectId}/photos`
    );
    expect(upload.request.body).toEqual(expect.objectContaining({ projectId }));

    service
      .submitChangeOrder(projectId, {
        projectId: 'attacker-project',
        title: 'Extra work performed here',
        description: 'Additional trenching beyond the planned scope.',
        amountCents: 100,
        signatures: [],
      })
      .subscribe();

    const submit = httpMock.expectOne(
      `/api/v1/nexus/projects/${projectId}/change-orders`
    );
    expect(submit.request.body).toEqual(expect.objectContaining({ projectId }));
  });

  it('downloads signed change order documents as blobs', () => {
    service.downloadChangeOrderDocument(projectId, 'co-1').subscribe((blob) => {
      expect(blob).toBeInstanceOf(Blob);
    });

    const req = httpMock.expectOne(
      `/api/v1/nexus/projects/${projectId}/change-orders/co-1/document`
    );
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
  });

  it('propagates backend failures', () => {
    const error = jest.fn();
    service.getDrawings(projectId).subscribe({ error });

    const req = httpMock.expectOne(
      `/api/v1/nexus/projects/${projectId}/drawings`
    );
    req.flush(
      { message: 'Service unavailable' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    expect(error).toHaveBeenCalled();
  });
});
