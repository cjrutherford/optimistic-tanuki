import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { ContactService } from './contact.service';

describe('ContactService', () => {
  let service: ContactService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ContactService],
    });
    service = TestBed.inject(ContactService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('postContact should create a new contact', (done) => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello World',
      subject: '',
    };
    const expectedResponse = {
      id: '1',
      name: data.name,
      email: data.email,
      message: data.message,
      subject: '[Christopher Rutherford net] General Inquiry',
    };

    service.postContact(data).subscribe((result) => {
      expect(result).toEqual(expectedResponse);
      done();
    });

    const req = httpMock.expectOne('/api/contact');
    expect(req.request.method).toBe('POST');
    req.flush(expectedResponse);
  });

  it('postContact should set default subject if not provided', (done) => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello World',
      subject: '',
    };
    const expectedResponse = {
      id: '1',
      name: data.name,
      email: data.email,
      message: data.message,
      subject: '[Christopher Rutherford net] General Inquiry',
    };

    service.postContact(data).subscribe((result) => {
      expect(result).toEqual(expectedResponse);
      done();
    });

    const req = httpMock.expectOne('/api/contact');
    expect(req.request.method).toBe('POST');
    req.flush(expectedResponse);
  });

  it('postContact should return an error if the request fails', (done) => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello World',
      subject: '',
    };

    service.postContact(data).subscribe(
      () => fail('should have failed with the network error'),
      (error: unknown) => {
        expect(error).toBeTruthy();
        done();
      }
    );

    const req = httpMock.expectOne('/api/contact');
    expect(req.request.method).toBe('POST');
    req.error(new ErrorEvent('network error'));
  });
});
