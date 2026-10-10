import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { SelectComponent } from './select.component';

@Component({
  standalone: true,
  imports: [SelectComponent],
  template: '<lib-select id="join-policy" label="Join Policy"></lib-select>',
})
class LabeledSelectHostComponent {}

describe('SelectComponent', () => {
  let component: SelectComponent;
  let fixture: ComponentFixture<SelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps a provided wrapper id while giving the native select a distinct id', () => {
    component.id = 'field-gallery.style';
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const select = host.querySelector('select') as HTMLSelectElement | null;

    expect(select?.id).toBe('field-gallery.style-control');
    expect(
      host.querySelectorAll('#field-gallery\\.style-control')
    ).toHaveLength(1);
  });

  it('associates the supplied visible label with the native select', async () => {
    const hostFixture = TestBed.createComponent(LabeledSelectHostComponent);
    hostFixture.detectChanges();

    const host = hostFixture.nativeElement as HTMLElement;
    const select = host.querySelector('select');
    const label = host.querySelector('label');

    expect(label?.textContent?.trim()).toBe('Join Policy');
    expect(label?.htmlFor).toBe('join-policy-control');
    expect(select?.id).toBe('join-policy-control');
    expect(host.querySelectorAll('#join-policy-control')).toHaveLength(1);
  });
});
