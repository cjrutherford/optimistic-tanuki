import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PersonaSelectionMenuComponent } from './persona-selection-menu.component';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('PersonaSelectionMenuComponent', () => {
  let component: PersonaSelectionMenuComponent;
  let fixture: ComponentFixture<PersonaSelectionMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonaSelectionMenuComponent, HttpClientTestingModule],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PersonaSelectionMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
