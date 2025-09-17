import { TestBed } from '@angular/core/testing';

import { ContactService } from './contact.service';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('ContactService', () => {
  let service: ContactService;
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting(), ContactService],
    });
    service = TestBed.inject(ContactService);
    http = TestBed.inject(HttpClient);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('ContactService', () => {
    let service: ContactService;

    beforeEach(() => {
      TestBed.configureTestingModule({});
      service = TestBed.inject(ContactService);
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('postContact should create a new contact', async () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello World',
        subject: '',
      };
      const expectedResponse = {
        status: 201,
        headers: {},
        body: {
          id: expect.any(Number),
          name: data.name,
          email: data.email,
          message: data.message,
          subject: data.subject || 'General Inquiry',
        },
      };

      const result = await service.postContact(data);
      expect(result).toEqual(expectedResponse);
    });

    it('postContact should set default subject if not provided', async () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello World',
        subject: '',
      };
      const expectedResponse = {
        status: 201,
        headers: {},
        body: {
          id: expect.any(String),
          name: data.name,
          email: data.email,
          message: data.message,
          subject: 'General Inquiry',
        },
      };

      const result = await service.postContact(data);
      expect(result).toEqual(expectedResponse);
    });

    it('postContact should return an error if the request fails', async () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello World',
        subject: '',
      };
      const error = new Error('Test error');
      jest.spyOn(http, 'post' as any).mockRejectedValue(error);

      // rest of your code

      await expect(service.postContact(data)).rejects.toThrowError(error);
    });
  });
});
