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

  it('should toggle sections', () => {
    component.sections = [
      { heading: 'Section 1', content: 'Content 1' },
      { heading: 'Section 2', content: 'Content 2' },
    ];
    component.multiple = false;
    fixture.detectChanges();

    // Initially no sections are expanded (ngOnInit already ran with empty sections)
    expect(component.isSectionExpanded(0)).toBe(false);
    expect(component.isSectionExpanded(1)).toBe(false);

    // Expand section 0
    component.toggleSection(0);
    expect(component.isSectionExpanded(0)).toBe(true);
    expect(component.isSectionExpanded(1)).toBe(false);

    // Toggle section 1 (section 0 should collapse in single mode)
    component.toggleSection(1);
    expect(component.isSectionExpanded(0)).toBe(false);
    expect(component.isSectionExpanded(1)).toBe(true);
  });

  it('should allow collapsing section in single mode', () => {
    component.sections = [{ heading: 'Section 1', content: 'Content 1' }];
    component.multiple = false;
    fixture.detectChanges();

    // Expand section 0
    component.toggleSection(0);
    expect(component.isSectionExpanded(0)).toBe(true);

    // Toggle section 0 (collapse it)
    component.toggleSection(0);
    expect(component.isSectionExpanded(0)).toBe(false);
  });

  it('should allow multiple sections in multiple mode', () => {
    component.sections = [
      { heading: 'Section 1', content: 'Content 1' },
      { heading: 'Section 2', content: 'Content 2' },
    ];
    component.multiple = true;
    fixture.detectChanges();

    // Expand both sections
    component.toggleSection(0);
    component.toggleSection(1);

    expect(component.isSectionExpanded(0)).toBe(true);
    expect(component.isSectionExpanded(1)).toBe(true);

    // Toggle section 0 off (section 1 stays open)
    component.toggleSection(0);
    expect(component.isSectionExpanded(0)).toBe(false);
    expect(component.isSectionExpanded(1)).toBe(true);
  });

  it('should emit sectionToggle event', () => {
    const mockToggle = jest.fn();
    component.sectionToggle.subscribe(mockToggle);

    component.sections = [{ heading: 'Section 1', content: 'Content 1' }];
    fixture.detectChanges();

    // Toggle section 0 (was closed, now open)
    component.toggleSection(0);
    expect(mockToggle).toHaveBeenCalledWith({
      index: 0,
      section: component.sections[0],
      isOpen: true,
    });

    // Toggle again (was open, now closed)
    component.toggleSection(0);
    expect(mockToggle).toHaveBeenCalledWith({
      index: 0,
      section: component.sections[0],
      isOpen: false,
    });
  });

  it('should not toggle disabled sections', () => {
    component.sections = [
      { heading: 'Section 1', content: 'Content 1', disabled: true },
    ];
    fixture.detectChanges();

    // Try to toggle disabled section
    component.toggleSection(0);
    // Section should remain closed (not opened)
    expect(component.isSectionExpanded(0)).toBe(false);
  });

  it('should return correct ARIA attributes', () => {
    component.sections = [{ heading: 'Section 1', content: 'Content 1' }];
    component.ariaLabel = 'Test Accordion';
    fixture.detectChanges();

    // Initially closed
    let sectionAria = component.getSectionAria(0);
    expect(sectionAria.role).toBe('button');
    expect(sectionAria.ariaExpanded).toBe(false);
    expect(sectionAria.ariaControls).toBe('accordion-section-0');
    expect(sectionAria.tabIndex).toBe(0);
    expect(sectionAria.ariaLabel).toBe('Test Accordion');

    // Expand section
    component.toggleSection(0);
    sectionAria = component.getSectionAria(0);
    expect(sectionAria.ariaExpanded).toBe(true);
  });

  it('should return container ARIA attributes', () => {
    component.sections = [{ heading: 'Section 1', content: 'Content 1' }];
    component.ariaLabel = 'Test Accordion';
    component.multiple = true;
    fixture.detectChanges();

    const containerAria = component.getContainerAria();
    expect(containerAria.role).toBe('region');
    expect(containerAria.ariaLabel).toBe('Test Accordion');
    expect(containerAria.ariaMultiSelectable).toBe(true);
  });

  it('should track by index or id', () => {
    component.sections = [
      { heading: 'Section 1', content: 'Content 1', id: 'section-1' },
      { heading: 'Section 2', content: 'Content 2' },
    ];

    // Should use id when available
    expect(component.trackByIndex(0, component.sections[0])).toBe('section-1');
    // Should use index when id not available
    expect(component.trackByIndex(1, component.sections[1])).toBe(1);
  });

  it('should handle non-existent sections gracefully', () => {
    component.sections = [{ heading: 'Section 1', content: 'Content 1' }];
    fixture.detectChanges();

    // Try to toggle a section that doesn't exist
    component.toggleSection(5);
    // Should not throw error
    expect(component.isSectionExpanded(0)).toBe(false);
  });
});
