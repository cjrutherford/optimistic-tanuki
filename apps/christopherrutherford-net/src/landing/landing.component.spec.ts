import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LandingComponent } from './landing.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ContactService } from '../app/contact.service';
import { of } from 'rxjs';
import { TitleBarComponent } from './title-bar/title-bar.component';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent, HttpClientTestingModule, TitleBarComponent],
      providers: [
        {
          provide: ContactService,
          useValue: {
            postContact: jest.fn(() => of({})),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the landing page inside the personality shell', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(
      compiled.querySelector('.landing-container.personality-shell')
    ).toBeTruthy();
  });

  it('renders the landing section anchors in order', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const ids = Array.from(
      compiled.querySelectorAll('.landing-container > [id]')
    ).map((element) => element.id);

    expect(ids).toEqual([
      'home',
      'work',
      'approach',
      'experience',
      'about',
      'work-together',
      'workshop',
      'contact',
    ]);
    expect(compiled.querySelector('details#systems-lab')).toBeTruthy();
    expect(compiled.querySelector('details#platform')).toBeTruthy();
  });
});
