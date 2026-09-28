import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SignatureCanvasComponent } from './signature-canvas.component';

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(
    type: string,
    init: MouseEventInit & { pointerId?: number } = {}
  ) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

(globalThis as Record<string, unknown>)['PointerEvent'] ??= TestPointerEvent;

describe('SignatureCanvasComponent', () => {
  let component: SignatureCanvasComponent;
  let fixture: ComponentFixture<SignatureCanvasComponent>;

  const fakeContext = (): CanvasRenderingContext2D =>
    ({
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      quadraticCurveTo: jest.fn(),
      stroke: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      setTransform: jest.fn(),
      clearRect: jest.fn(),
      lineWidth: 1,
      lineCap: 'round',
      lineJoin: 'round',
      strokeStyle: '',
    } as unknown as CanvasRenderingContext2D);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignatureCanvasComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SignatureCanvasComponent);
    component = fixture.componentInstance;
    const canvas = fixture.nativeElement.querySelector(
      'canvas'
    ) as HTMLCanvasElement;
    jest.spyOn(canvas, 'getContext').mockReturnValue(fakeContext());
    jest
      .spyOn(canvas, 'toDataURL')
      .mockReturnValue('data:image/png;base64,c2lnbmF0dXJl');
    fixture.detectChanges();
  });

  it('renders an accessible canvas with a label', () => {
    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toContain('Signature pad');
  });

  it('starts unsigned with no data URL', () => {
    expect(component.signed).toBe(false);
    expect(component.toDataUrl()).toBeNull();
  });

  it('captures pointer strokes and emits the signature', () => {
    const emitted: Array<string | null> = [];
    component.signedChange.subscribe((value) => emitted.push(value));
    const canvas = fixture.nativeElement.querySelector(
      'canvas'
    ) as HTMLCanvasElement;
    const rect = { left: 0, top: 0, width: 600, height: 160 };
    jest
      .spyOn(canvas, 'getBoundingClientRect')
      .mockReturnValue(rect as DOMRect);

    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 10,
        clientY: 10,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 30,
        clientY: 20,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    fixture.detectChanges();

    expect(component.signed).toBe(true);
    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted[emitted.length - 1]).toMatch(/^data:image\/png;base64,/);
    expect(
      fixture.nativeElement.querySelector('.signature-state').textContent
    ).toContain('Signature captured');
  });

  it('clears the signature and emits null', () => {
    const emitted: Array<string | null> = [];
    component.signedChange.subscribe((value) => emitted.push(value));
    const canvas = fixture.nativeElement.querySelector(
      'canvas'
    ) as HTMLCanvasElement;
    jest
      .spyOn(canvas, 'getBoundingClientRect')
      .mockReturnValue({ left: 0, top: 0 } as DOMRect);
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 10,
        clientY: 10,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 30,
        clientY: 20,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(component.signed).toBe(true);

    component.clear();
    fixture.detectChanges();

    expect(component.signed).toBe(false);
    expect(emitted[emitted.length - 1]).toBeNull();
  });

  it('ignores input while disabled', () => {
    component.disabled = true;
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas');

    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 10,
        clientY: 10,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 30,
        clientY: 20,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    expect(component.signed).toBe(false);
  });
});
