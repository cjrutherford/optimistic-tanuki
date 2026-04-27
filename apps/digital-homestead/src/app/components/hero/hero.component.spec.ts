import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeroSectionComponent } from './hero.component';
import {
  ButtonComponent,
  HeadingComponent,
} from '@optimistic-tanuki/common-ui';
import { HeroComponent } from '@optimistic-tanuki/blogging-ui';

describe('HeroSectionComponent', () => {
  let component: HeroSectionComponent;
  let fixture: ComponentFixture<HeroSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HeroSectionComponent,
        ButtonComponent,
        HeadingComponent,
        HeroComponent,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the personality-driven hero shell', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.homestead-hero')).toBeTruthy();
    expect(compiled.textContent).toContain('Own your corner of the internet');
  });
});
