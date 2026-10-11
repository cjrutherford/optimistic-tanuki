import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ANALYTICS_TRANSPORT } from './analytics.service';
import { Subject, of, throwError } from 'rxjs';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/blogging-data-access';
import { AssessmentRequestService } from './assessment-request.service';
import { AssessmentAnswers } from '../content/assessment';

interface BloggingApiStub {
  contactControllerCreateContact: jest.Mock;
}

describe('AssessmentRequestService', () => {
  const answers: AssessmentAnswers = {
    audience: 'organization',
    organization: 'Grace Community',
    name: ' Ada ',
    email: ' ada@example.com ',
    phone: '912 555 0100',
    people: '6-20',
    keep: ['files'],
    storage: 'not-sure',
    currentSpend: '',
    notes: '',
  };
  let api: BloggingApiStub;
  let service: AssessmentRequestService;

  beforeEach(() => {
    api = { contactControllerCreateContact: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        AssessmentRequestService,
        { provide: OptomisitcTanukiAPIService, useValue: api },
        { provide: ANALYTICS_TRANSPORT, useValue: () => undefined },
      ],
    });
    service = TestBed.inject(AssessmentRequestService);
  });

  it('sends the answers through the public contact intake', () => {
    api.contactControllerCreateContact.mockReturnValue(of({}));

    service.submit(answers, '');

    expect(api.contactControllerCreateContact).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ada',
        email: 'ada@example.com',
        phone: '912 555 0100',
        company: 'Grace Community',
        subject: 'Private cloud assessment (organization)',
        appScope: 'hai',
        sourcePage: '/private-cloud/assessment',
        sourceLabel: 'HAI private cloud assessment',
        website: '',
      })
    );
    expect(
      api.contactControllerCreateContact.mock.calls[0][0].message
    ).toContain('People using it: 6 to 20 people');
    expect(service.state()).toBe('sent');
  });

  it('omits empty optional fields and passes the honeypot through', () => {
    api.contactControllerCreateContact.mockReturnValue(of({}));

    service.submit(
      { ...answers, audience: 'home', phone: ' ', organization: 'x' },
      'http://spam.example'
    );
    const payload = api.contactControllerCreateContact.mock.calls[0][0];

    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('company');
    expect(payload.subject).toBe('Private cloud assessment (home)');
    expect(payload.website).toBe('http://spam.example');
  });

  it('reports failure without throwing', () => {
    api.contactControllerCreateContact.mockReturnValue(
      throwError(() => new Error('offline'))
    );

    service.submit(answers, '');

    expect(service.state()).toBe('failed');
  });

  it('ignores a second submit while one is in flight', () => {
    const pending = new Subject<unknown>();
    api.contactControllerCreateContact.mockReturnValue(pending);

    service.submit(answers, '');
    service.submit(answers, '');

    expect(api.contactControllerCreateContact).toHaveBeenCalledTimes(1);
    expect(service.state()).toBe('sending');
  });
});
