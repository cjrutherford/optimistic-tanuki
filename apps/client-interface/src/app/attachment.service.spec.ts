import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AttachmentService } from './attachment.service';
import { AttachmentDto, CreateAttachmentDto, UpdateAttachmentDto, SearchAttachmentDto } from '@optimistic-tanuki/social-ui';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('AttachmentService', () => {
  let service: AttachmentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AttachmentService,
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ]
    });
    service = TestBed.inject(AttachmentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create an attachment', () => {
    const mockAttachmentDto: CreateAttachmentDto = { url: 'http://example.com/test.txt', postId: '456'};
    const mockResponse: AttachmentDto = { id: '1', url: 'http://example.com/test.txt', postId: '456', userId: '123', name: 'file.txt', type: 'text/plain' };

    service.createAttachment(mockAttachmentDto).subscribe(attachment => {
      expect(attachment).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/api/social/attachment');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should get an attachment by id', () => {
    const mockResponse: AttachmentDto = { id: '1', name: 'test.txt',  url: 'http://example.com/test.txt',  type: 'text/plain',  postId: '456', userId: '123' };
    const id = '1';

    service.getAttachment(id).subscribe(attachment => {
      expect(attachment).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`/api/social/attachment/${id}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should update an attachment', () => {
    const mockUpdateAttachmentDto: UpdateAttachmentDto = { url: 'updated.txt' };
    const mockResponse: AttachmentDto = { id: '1', name: 'updated.txt',  url: 'http://example.com/test.txt',  type: 'text/plain', postId: '456', userId: '123' };
    const id = '1';

    service.updateAttachment(id, mockUpdateAttachmentDto).subscribe(attachment => {
      expect(attachment).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`/api/social/attachment/update/${id}`);
    expect(req.request.method).toBe('PUT');
    req.flush(mockResponse);
  });

  it('should delete an attachment', () => {
    const id = '1';

    service.deleteAttachment(id).subscribe(() => {
      expect(true).toBeTruthy(); // Just check that the subscribe is called
    });

    const req = httpMock.expectOne(`/api/social/attachment/${id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should search attachments', () => {
    const mockSearchCriteria: SearchAttachmentDto = { url: 'test' };
    const mockResponse: AttachmentDto[] = [{ id: '1', name: 'test.txt',  url: 'http://example.com/test.txt',  type: 'text/plain',  postId: '456', userId: '123' }];

    service.searchAttachments(mockSearchCriteria).subscribe(attachments => {
      expect(attachments).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`/api/social/attachment/find`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });
});