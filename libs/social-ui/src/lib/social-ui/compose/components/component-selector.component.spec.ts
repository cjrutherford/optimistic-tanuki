import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentSelectorComponent } from './component-selector.component';
import { InjectableComponent } from '../interfaces/component-injection.interface';

@Component({ selector: 'lib-stub', standalone: true, template: '' })
class StubComponent {}

const social: InjectableComponent = {
  id: 'callout-box',
  name: 'Callout Box',
  description: 'Highlight important information',
  component: StubComponent,
  category: 'Social',
  icon: 'info',
};

const layout: InjectableComponent = {
  id: 'grid',
  name: 'Grid',
  component: StubComponent,
  category: 'Layout',
};

const uncategorised: InjectableComponent = {
  id: 'raw',
  name: 'Raw',
  component: StubComponent,
};

describe('ComponentSelectorComponent', () => {
  let fixture: ComponentFixture<ComponentSelectorComponent>;
  let component: ComponentSelectorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ComponentSelectorComponent);
    component = fixture.componentInstance;
    component.components = [social, layout, uncategorised];
  });

  it('derives the category list from the components, ignoring uncategorised ones', () => {
    expect(component.categories).toEqual(['All', 'Social', 'Layout']);
  });

  it('deduplicates categories shared by several components', () => {
    component.components = [social, { ...social, id: 'other' }];

    expect(component.categories).toEqual(['All', 'Social']);
  });

  it('returns every component while the All category is selected', () => {
    expect(component.filteredComponents).toEqual([
      social,
      layout,
      uncategorised,
    ]);
  });

  it('filters to the selected category', () => {
    component.selectCategory('Social');

    expect(component.selectedCategory).toBe('Social');
    expect(component.filteredComponents).toEqual([social]);
  });

  it('renders nothing while hidden', () => {
    component.isVisible = false;
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.component-selector')
    ).toBeNull();
  });

  it('renders one item per filtered component with its name and description', () => {
    component.isVisible = true;
    fixture.detectChanges();

    const items: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.component-item')
    );

    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain('Callout Box');
    expect(items[0].textContent).toContain('Highlight important information');
  });

  it('emits the clicked component', () => {
    component.isVisible = true;
    fixture.detectChanges();
    const selected: InjectableComponent[] = [];
    component.componentSelected.subscribe((c) => selected.push(c));

    const items: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.component-item')
    );
    items[1].click();

    expect(selected).toEqual([layout]);
  });

  it('re-renders the grid when a category button is clicked', () => {
    component.isVisible = true;
    fixture.detectChanges();

    const categoryButtons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.category-btn')
    );
    const socialButton = categoryButtons.find(
      (b) => b.textContent?.trim() === 'Social'
    )!;
    socialButton.click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('.component-item')
    ).toHaveLength(1);
    expect(socialButton.classList.contains('active')).toBe(true);
  });

  it('emits closed from the header close button', () => {
    component.isVisible = true;
    fixture.detectChanges();
    const closed = jest.fn();
    component.closed.subscribe(closed);

    fixture.nativeElement.querySelector('.close-btn').click();

    expect(closed).toHaveBeenCalled();
  });

  it('hides the category bar when only the All category exists', () => {
    component.components = [uncategorised];
    component.isVisible = true;
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.component-categories')
    ).toBeNull();
  });
});
