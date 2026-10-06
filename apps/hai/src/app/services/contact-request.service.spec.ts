import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/blogging-data-access';
import {
  CONTACT_FAILED_MESSAGE,
  CONTACT_RECEIVED_MESSAGE,
  ContactRequestService,
} from './contact-request.service';

interface BloggingApiStub {
  contactControllerCreateContact: jest.Mock;
}

describe('ContactRequestService', () => {
  const request = {
    name: 'Ada',
    email: 'ada@example.com',
    subject: 'infrastructure',
    message: 'Hello',
  };
  let api: BloggingApiStub;
  let service: ContactRequestService;

  beforeEach(() => {
    api = { contactControllerCreateContact: jest.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: OptomisitcTanukiAPIService, useValue: api }],
    });
    service = TestBed.inject(ContactRequestService);
  });

  it('submits with the HAI scope and the page it came from', () => {
    api.contactControllerCreateContact.mockReturnValue(of({}));

    service.submit(request, '/contact');

    expect(api.contactControllerCreateContact).toHaveBeenCalledWith({
      ...request,
      appScope: 'hai',
      sourcePage: '/contact',
      sourceLabel: 'HAI',
    });
    expect(service.submitting()).toBe(false);
    expect(service.status()).toBe(CONTACT_RECEIVED_MESSAGE);
  });

  it('reports a failure without throwing', () => {
    api.contactControllerCreateContact.mockReturnValue(
      throwError(() => new Error('offline'))
    );

    service.submit(request, '/#contact');

    expect(service.submitting()).toBe(false);
    expect(service.status()).toBe(CONTACT_FAILED_MESSAGE);
  });

  it('holds a prefilled message and clears any old status', () => {
    service.status.set(CONTACT_RECEIVED_MESSAGE);

    service.setPrefill('Please send me the comparison');

    expect(service.prefill()).toBe('Please send me the comparison');
    expect(service.status()).toBeNull();
  });
});
