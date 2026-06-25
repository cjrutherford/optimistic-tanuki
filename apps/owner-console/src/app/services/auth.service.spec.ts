import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('sends the owner-console app scope header on login', () => {
    service.login('owner@example.com', 'password').subscribe();

    const req = httpMock.expectOne('/api/authentication/login');
    expect(req.request.headers.get('x-ot-appscope')).toBe('owner-console');
    req.flush({ data: { newToken: 'token' } });
  });

  it('sends the owner-console app scope header on registration', () => {
    service
      .register('owner@example.com', 'Owner', 'Console', 'password', 'password')
      .subscribe();

    const req = httpMock.expectOne('/api/authentication/register');
    expect(req.request.headers.get('x-ot-appscope')).toBe('owner-console');
    req.flush({ data: { newToken: 'token' } });
  });
});
