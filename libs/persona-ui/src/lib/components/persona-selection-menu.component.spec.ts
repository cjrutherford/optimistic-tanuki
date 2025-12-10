import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonaSelectionMenuComponent } from './persona-selection-menu.component';

describe('PersonaSelectionMenuComponent', () => {
  let component: PersonaSelectionMenuComponent;
  let fixture: ComponentFixture<PersonaSelectionMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonaSelectionMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonaSelectionMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
