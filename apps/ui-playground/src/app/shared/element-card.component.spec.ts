import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ElementCardComponent,
  PlaygroundElement,
} from './element-card.component';

describe('ElementCardComponent', () => {
  let component: ElementCardComponent;
  let fixture: ComponentFixture<ElementCardComponent>;

  const element: PlaygroundElement = {
    id: 'murmuration',
    title: 'Murmuration Scene',
    headline: 'WebGL flocking surface',
    importName: 'MurmurationSceneComponent',
    selector: 'otui-murmuration-scene',
    summary: 'Three.js-driven flocking accent for hero scenes.',
    props: [
      {
        name: 'count',
        type: 'number',
        defaultValue: '48',
        description: 'Particle count for the flock.',
        min: 10,
        max: 100,
        step: 1,
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ElementCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ElementCardComponent);
    component = fixture.componentInstance;
    component.element = element;
    component.config = { count: 48 };
    fixture.detectChanges();
  });

  it('does not emit config changes while dragging a slider until commit', () => {
    const emitSpy = jest.spyOn(component.configChange, 'emit');
    const slider: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[type="range"]'
    );

    slider.value = '72';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.config['count']).toBe(48);
    expect(emitSpy).not.toHaveBeenCalled();

    slider.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.config['count']).toBe(72);
    expect(emitSpy).toHaveBeenCalledWith({ count: 72 });
  });
});
