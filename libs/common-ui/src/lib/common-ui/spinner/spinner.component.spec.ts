describe('SpinnerComponent', () => {
  let component: SpinnerComponent;
  let fixture: ComponentFixture<SpinnerComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpinnerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SpinnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply theme colors via applyTheme', () => {
    const mockColors = {
      accent: '#123',
      foreground: '#abc',
      background: '#def',
      complementary: '#456',
    } as any;
    spyOn(component, 'setLocalCSSVariable');
  component.applyTheme(mockColors);
    expect(component.setLocalCSSVariable).toHaveBeenCalledWith('accent', '#123');
    expect(component.setLocalCSSVariable).toHaveBeenCalledWith('foreground', '#abc');
    expect(component.setLocalCSSVariable).toHaveBeenCalledWith('background', '#def');
    expect(component.setLocalCSSVariable).toHaveBeenCalledWith('complement', '#456');
  });

  it('should set styleType and size', () => {
    component.styleType = 'circle';
    component.size = '48px';
    expect(component.styleType).toBe('circle');
    expect(component.size).toBe('48px');
  });

});
