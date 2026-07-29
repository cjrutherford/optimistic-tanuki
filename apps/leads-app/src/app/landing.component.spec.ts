import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { LandingComponent } from './landing.component';
import { AuthStateService } from './auth-state.service';

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent, RouterTestingModule],
      providers: [
        {
          provide: AuthStateService,
          useValue: { isAuthenticated$: of(false) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
  });

  it('gives new visitors a clear opportunity-discovery path', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Opportunities worth pursuing');
    expect(
      fixture.nativeElement.querySelector('[routerLink="/register"]')
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[routerLink="/login"]')
    ).toBeTruthy();
  });
});
