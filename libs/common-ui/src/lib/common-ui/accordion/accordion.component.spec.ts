import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccordionComponent } from './accordion.component';

describe('AccordionComponent', () => {
  let component: AccordionComponent;
  let fixture: ComponentFixture<AccordionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccordionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AccordionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle section and set expandedIndex', () => {
    component.sections = [
      { heading: 'Section 1', content: 'Content 1' },
      { heading: 'Section 2', content: 'Content 2' },
    ];
    component.expandedIndex = 0;
    component.toggleSection(1);
    expect(component.expandedIndex).toBe(1);
  });

  it('should collapse section if already expanded and multiple sections exist', () => {
    component.sections = [
      { heading: 'Section 1', content: 'Content 1' },
      { heading: 'Section 2', content: 'Content 2' },
    ];
    component.expandedIndex = 0;
    component.toggleSection(0);
    expect(component.expandedIndex).toBe(-1);
  });

  it('should expand section if not already expanded', () => {
    component.sections = [
      { heading: 'Section 1', content: 'Content 1' },
      { heading: 'Section 2', content: 'Content 2' },
    ];
    component.expandedIndex = -1;
    component.toggleSection(0);
    expect(component.expandedIndex).toBe(0);
  });

  it('should expand section if only one section exists, even if already expanded', () => {
    component.sections = [
      { heading: 'Section 1', content: 'Content 1' },
    ];
    component.expandedIndex = 0;
    component.toggleSection(0);
    expect(component.expandedIndex).toBe(0);
  });
});
