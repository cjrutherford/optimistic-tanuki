import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AttachmentService } from './attachment.service';
import {
  AttachmentDto,
  CreateAttachmentDto,
  UpdateAttachmentDto,
  SearchAttachmentDto,
} from '@optimistic-tanuki/social-ui';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('AttachmentService', () => {
  let service: AttachmentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AttachmentService, { provide: API_BASE_URL, useValue: '' }],
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
    const mockRequest: CreateAttachmentDto = {
      postId: '123',
      url: 'http://example.com/image.jpg',
    };
    const mockResponse: AttachmentDto = {
      id: '1',
      name: 'image.jpg',
      type: 'image/jpeg',
      userId: '1',
      ...mockRequest,
    };

    service.createAttachment(mockRequest).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('/social/attachment');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should get an attachment by id', () => {
    const id = '1';
    const mockResponse: AttachmentDto = {
      id: '1',
      postId: '123',
      url: 'http://example.com/image.jpg',
      name: 'image.jpg',
      type: 'image/jpeg',
      userId: '1',
    };

    service.getAttachment(id).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`/social/attachment/${id}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should update an attachment', () => {
    const id = '1';
    const mockRequest: UpdateAttachmentDto = {
      url: 'http://example.com/new-image.jpg',
    };
    const mockResponse: AttachmentDto = {
      id: '1',
      postId: '123',
      url: 'http://example.com/new-image.jpg',
      name: 'new-image.jpg',
      type: 'image/jpeg',
      userId: '1',
    };

    service.updateAttachment(id, mockRequest).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`/social/attachment/update/${id}`);
    expect(req.request.method).toBe('PUT');
    req.flush(mockResponse);
  });

  it('should delete an attachment', () => {
    const id = '1';

    service.deleteAttachment(id).subscribe((response) => {
      expect(response).toBeNull();
    });

    const req = httpMock.expectOne(`/social/attachment/${id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should search attachments', () => {
    const mockRequest: SearchAttachmentDto = { postId: '123' };
    const mockResponse: AttachmentDto[] = [
      {
        id: '1',
        postId: '123',
        url: 'http://example.com/image.jpg',
        name: 'image.jpg',
        type: 'image/jpeg',
        userId: '1',
      },
    ];

    service.searchAttachments(mockRequest).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`/social/attachment/find`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });
});
