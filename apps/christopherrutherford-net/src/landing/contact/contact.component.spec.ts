import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ContactComponent } from './contact.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ContactService } from '../../app/contact.service';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/blogging-data-access';

interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface ContactServiceDouble {
  postContact: jest.Mock<Observable<unknown>, [ContactPayload]>;
}

interface ApiDouble {
  contactControllerCreateContact: jest.Mock<Observable<unknown>, [unknown]>;
}

const submission: ContactPayload = {
  name: 'Ada Visitor',
  email: 'ada@example.com',
  subject: 'Consulting project',
  message: 'Secret message body',
};

describe('ContactComponent', () => {
  let component: ContactComponent;
  let fixture: ComponentFixture<ContactComponent>;
  let service: ContactServiceDouble;

  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    service = { postContact: jest.fn((_: ContactPayload) => of({})) };
    await TestBed.configureTestingModule({
      imports: [ContactComponent, HttpClientTestingModule],
    })
      .overrideComponent(ContactComponent, {
        set: { providers: [{ provide: ContactService, useValue: service }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ContactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jest.restoreAllMocks());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers exactly the specified subjects in order', () => {
    expect(component.subjects.map((s) => s.label)).toEqual([
      'Employment opportunity',
      'Contract engineering',
      'Consulting project',
      'Collaboration / open source',
      'General inquiry',
    ]);
  });

  it('publishes the owner email alongside the form', () => {
    expect(
      el().querySelector<HTMLAnchorElement>(
        'a[href="mailto:chris@christopherrutherford.net"]'
      )
    ).not.toBeNull();
  });

  it('shows success in a status region after a successful submission', () => {
    component.onContactFormSubmit(submission);
    fixture.detectChanges();

    expect(service.postContact).toHaveBeenCalledWith(submission);
    const region = el().querySelector('[role="status"]') as HTMLElement;
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toContain('your message was sent');
  });

  it('shows an error with an email fallback after a failed submission', () => {
    service.postContact.mockReturnValue(throwError(() => new Error('boom')));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    component.onContactFormSubmit(submission);
    fixture.detectChanges();

    const region = el().querySelector('[role="status"]') as HTMLElement;
    expect(region.textContent).toContain('could not be sent');
    expect(
      region.querySelector('a[href="mailto:chris@christopherrutherford.net"]')
    ).not.toBeNull();
  });

  it('shows Sending… and disables submit while pending, ignoring a second submit', () => {
    const pending = new Subject<unknown>();
    service.postContact.mockReturnValue(pending);

    component.onContactFormSubmit(submission);
    component.onContactFormSubmit(submission);
    fixture.detectChanges();

    expect(service.postContact).toHaveBeenCalledTimes(1);
    expect(
      (el().querySelector('[role="status"]') as HTMLElement).textContent
    ).toContain('Sending…');
    const form = fixture.debugElement.query(
      (d) => d.name === 'lib-contact-form'
    );
    expect(form.componentInstance.disabled).toBe(true);

    pending.next({});
    pending.complete();
    fixture.detectChanges();
    expect(form.componentInstance.disabled).toBe(false);
  });

  it('never logs visitor details or the message to the console', () => {
    const spies = (['log', 'info', 'debug', 'warn', 'error'] as const).map(
      (m) => jest.spyOn(console, m).mockImplementation(() => undefined)
    );
    component.onContactFormSubmit(submission);
    service.postContact.mockReturnValue(throwError(() => submission));
    component.onContactFormSubmit(submission);
    service.postContact.mockReturnValue(throwError(() => submission));
    const second = TestBed.createComponent(ContactComponent);
    (second.componentInstance as ContactComponent).onContactFormSubmit(
      submission
    );

    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const pii of [submission.name, submission.email, submission.message]) {
      expect(logged).not.toContain(pii);
    }
  });
});

describe('ContactComponent backend contract', () => {
  it('sends the christopherrutherford-net scope and source metadata', () => {
    const api: ApiDouble = {
      contactControllerCreateContact: jest.fn((_: unknown) => of({})),
    };
    TestBed.configureTestingModule({
      imports: [ContactComponent, HttpClientTestingModule],
      providers: [{ provide: OptomisitcTanukiAPIService, useValue: api }],
    });
    const fixture = TestBed.createComponent(ContactComponent);
    fixture.componentInstance.onContactFormSubmit({
      name: 'Ada Visitor',
      email: 'ada@example.com',
      subject: 'Consulting project',
      message: 'Hello',
    });

    expect(api.contactControllerCreateContact).toHaveBeenCalledWith({
      name: 'Ada Visitor',
      email: 'ada@example.com',
      message: 'Hello',
      subject: '[Christopher Rutherford net] Consulting project',
      appScope: 'christopherrutherford-net',
      sourcePage: '/#contact',
      sourceLabel: 'Christopher Rutherford Net',
    });
  });
});
