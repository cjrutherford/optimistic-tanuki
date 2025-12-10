import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonaUiComponent } from './persona-ui.component';

describe('PersonaUiComponent', () => {
  let component: PersonaUiComponent;
  let fixture: ComponentFixture<PersonaUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonaUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonaUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
