import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { HeadingComponent } from '@optimistic-tanuki/common-ui';
import { HeroComponent } from '../landing/hero/hero.component';
import { TitleBarComponent } from '../landing/title-bar/title-bar.component';
import { AboutComponent } from '../landing/about/about.component';
import { ProjectGridComponent } from '../landing/project-grid/project-grid.component';
import { ServicesGridComponent } from '../landing/services-grid/services-grid.component';
import { ContactComponent } from '../landing/contact/contact.component';
import { LandingComponent } from '../landing/landing.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ContactService } from './contact.service';
import { of } from 'rxjs';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let app: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        RouterTestingModule.withRoutes([
          { path: '', component: LandingComponent },
        ]),
        HeadingComponent,
        HeroComponent,
        TitleBarComponent,
        AboutComponent,
        ProjectGridComponent,
        ServicesGridComponent,
        ContactComponent,
        LandingComponent,
        HttpClientTestingModule,
      ],
      providers: [
        {
          provide: ContactService,
          useValue: {
            postContact: jest.fn(() => of({})),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    app = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(app).toBeTruthy();
  });

  it(`should have as title 'christopherrutherford-net'`, () => {
    expect(app.title).toEqual('christopherrutherford.net');
  });
});
