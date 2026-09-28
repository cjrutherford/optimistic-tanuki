import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SolutionsMatrixComponent } from './solutions-matrix.component';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';

describe('SolutionsMatrixComponent', () => {
  let component: SolutionsMatrixComponent;
  let fixture: ComponentFixture<SolutionsMatrixComponent>;

  const catalogServiceMock = {
    getPortalUrl: jest
      .fn()
      .mockImplementation((preset) =>
        of(`http://localhost:8091?preset=${preset}`)
      ),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolutionsMatrixComponent],
      providers: [
        { provide: HardwareCatalogService, useValue: catalogServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SolutionsMatrixComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the solutions matrix component', () => {
    expect(component).toBeTruthy();
  });

  it('renders all four vertical tabs in sentence case', () => {
    const tabs = fixture.nativeElement.querySelectorAll('.tab-item');
    expect(tabs).toHaveLength(4);

    const labels = Array.from(tabs).map((tab: any) => tab.textContent.trim());
    expect(labels).toEqual([
      'Trade and field',
      'CPA and tax',
      'Legal and title',
      'Builders and municipal',
    ]);
  });

  it('displays Vertical 1: Trade and field contractors by default', () => {
    const panel = fixture.nativeElement.querySelector('.vertical-panel');
    expect(panel).not.toBeNull();
    const text = panel.textContent;

    expect(text).toContain('Trade and field contractors');
    expect(text).toContain(
      'Tier 1 Compact Mini-PC (Beelink N100) + CyberPower UPS'
    );
    expect(text).toContain('Field Flow');
    expect(text).toContain('Branded application tailored to your business');
    expect(text).toContain('Invoice Ninja v5');
    expect(text).toContain('Vikunja');
    expect(text).toContain('N8N');
    expect(text).toContain('$50/mo software + $99/mo Mini-PC lease');

    const button = panel.querySelector('a.action-btn');
    expect(button.textContent.trim()).toBe('Configure Tier 1 Appliance');
    expect(button.getAttribute('href')).toContain('preset=tier1');
  });

  it('switches seamlessly to Vertical 2: Regulated CPA and tax practices', () => {
    component.onTabChange('vertical-cpa');
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.vertical-panel');
    const text = panel.textContent;

    expect(text).toContain('Regulated CPA and tax practices');
    expect(text).toContain(
      'Tier 2 Workstation Tower (Dell T150) + APC Smart-UPS + GL.iNet cellular router'
    );
    expect(text).toContain('Practice Vault');
    expect(text).toContain('Branded application tailored to your business');
    expect(text).toContain('Paperless-ngx');
    expect(text).toContain('DocuSeal');
    expect(text).toContain('Vaultwarden');
    expect(text).toContain('$3,200 setup');
    expect(text).toContain('$550/mo compliance retainer');

    const button = panel.querySelector('a.action-btn');
    expect(button.textContent.trim()).toBe('Configure Tier 2 Appliance');
    expect(button.getAttribute('href')).toContain('preset=tier2');
  });

  it('switches seamlessly to Vertical 3: Real estate title and law firms', () => {
    component.onTabChange('vertical-legal');
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.vertical-panel');
    const text = panel.textContent;

    expect(text).toContain('Real estate title and law firms');
    expect(text).toContain(
      'Tier 2 Workstation Tower (Dell T150) + APC Smart-UPS'
    );
    expect(text).toContain('Practice Vault Wire Shield');
    expect(text).toContain('Branded application tailored to your business');
    expect(text).toContain('Stalwart Mail Server');
    expect(text).toContain('DocuSeal');
    expect(text).toContain('$2,850 setup');
    expect(text).toContain('$650/mo defense retainer');

    const button = panel.querySelector('a.action-btn');
    expect(button.textContent.trim()).toBe('Configure Tier 2 Appliance');
    expect(button.getAttribute('href')).toContain('preset=tier2');
  });

  it('switches seamlessly to Vertical 4: Commercial builders and municipal agencies', () => {
    component.onTabChange('vertical-builders');
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.vertical-panel');
    const text = panel.textContent;

    expect(text).toContain('Commercial builders and municipal agencies');
    expect(text).toContain(
      'Tier 3 Enterprise 2U Rackmount (Supermicro EPYC / RTX 4060 Ti) + CyberPower Online UPS'
    );
    expect(text).toContain('Project Nexus');
    expect(text).toContain('Civic Core');
    expect(text).toContain('Branded application tailored to your business');
    expect(text).toContain('Nextcloud Enterprise');
    expect(text).toContain('Planka');
    expect(text).toContain('Stirling-PDF');
    expect(text).toContain('Local Ollama with Open WebUI');
    expect(text).toContain('$3,200 setup');
    expect(text).toContain('$849/mo retainer');
    expect(text).toContain('$40,000 project build');

    const button = panel.querySelector('a.action-btn');
    expect(button.textContent.trim()).toBe('Configure Tier 3 Appliance');
    expect(button.getAttribute('href')).toContain('preset=tier3');
  });

  it('never uses the internal term slice anywhere in the UI', () => {
    for (const v of component.verticals) {
      component.onTabChange(v.id);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent?.toLowerCase()).not.toContain('slice');
    }
  });

  it('omits matrix from industry solutions heading and eyebrow', () => {
    const eyebrow = fixture.nativeElement.querySelector('.eyebrow');
    expect(eyebrow?.textContent?.trim()).toBe('Industry solutions');
    expect(eyebrow?.textContent?.toLowerCase()).not.toContain('matrix');
  });

  it('omits whitebox from app product titles while noting brand tailoring', () => {
    const appNames = fixture.nativeElement.querySelectorAll('.app-name');
    appNames.forEach((el: HTMLElement) => {
      expect(el.textContent?.toLowerCase()).not.toContain('whitebox');
    });
    const cardHeading = fixture.nativeElement.querySelector(
      '.software-card .card-heading'
    );
    expect(cardHeading?.textContent?.toLowerCase()).not.toContain('white-box');
    expect(cardHeading?.textContent?.toLowerCase()).not.toContain('whitebox');
    expect(fixture.nativeElement.textContent).toContain(
      'Branded application tailored to your business'
    );
  });

  it('contains zero em dashes, maintains sentence case headings, and writes turn-key with hyphen', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain('\u2014');
    expect(element.textContent).not.toContain('&mdash;');

    const h2 = element.querySelector('h2');
    expect(h2?.textContent?.trim()).toBe('Turn-key industry stacks');
  });
});
