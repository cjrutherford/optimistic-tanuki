import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContentSectionComponent } from './content-section.component';

describe('ContentSectionComponent', () => {
  let component: ContentSectionComponent;
  let fixture: ComponentFixture<ContentSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContentSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContentSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default values', () => {
    expect(component.maxWidth).toBe('1200px');
    expect(component.padding).toBe('2rem');
  });
});
