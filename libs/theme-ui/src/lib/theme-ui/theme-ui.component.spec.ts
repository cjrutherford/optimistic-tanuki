import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeUiComponent } from './theme-ui.component';

describe('ThemeUiComponent', () => {
  let component: ThemeUiComponent;
  let fixture: ComponentFixture<ThemeUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThemeUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
