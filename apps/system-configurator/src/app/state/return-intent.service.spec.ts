import { TestBed } from '@angular/core/testing';
import { ReturnIntentService } from './return-intent.service';

describe('ReturnIntentService', () => {
  let service: ReturnIntentService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReturnIntentService);
  });

  it('remembers and consumes a url once', () => {
    service.remember('/configure/step-2');
    expect(service.consume()).toBe('/configure/step-2');
    expect(service.consume()).toBeNull();
  });

  it('returns null when nothing was remembered', () => {
    expect(service.consume()).toBeNull();
  });
});
