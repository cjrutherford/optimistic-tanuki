import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HardwareCatalogComponent } from './hardware-catalog.component';
import {
  DEFAULT_HARDWARE_TIERS,
  HardwareCatalogService,
} from '../../services/hardware-catalog.service';

describe('HardwareCatalogComponent', () => {
  let component: HardwareCatalogComponent;
  let fixture: ComponentFixture<HardwareCatalogComponent>;

  const catalogServiceMock = {
    getTiers: jest.fn().mockReturnValue(of(DEFAULT_HARDWARE_TIERS)),
    getPortalUrl: jest
      .fn()
      .mockImplementation((preset) =>
        of(`http://localhost:8091?preset=${preset}`)
      ),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HardwareCatalogComponent],
      providers: [
        { provide: HardwareCatalogService, useValue: catalogServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HardwareCatalogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the catalog component', () => {
    expect(component).toBeTruthy();
  });

  it('renders three appliance tier cards', () => {
    const tierCards = fixture.nativeElement.querySelectorAll('.tier-card');
    expect(tierCards).toHaveLength(3);
  });

  it('renders exact hardware specifications for Tier 1: Compact Edge Appliance', () => {
    const tier1Card = fixture.nativeElement.querySelector(
      '.tier-card[data-tier="tier1"]'
    );
    expect(tier1Card).not.toBeNull();
    const text = tier1Card.textContent;

    expect(text).toContain('Compact Edge Appliance');
    expect(text).toContain('Target: 10 to 50 users');
    expect(text).toContain('Beelink EQ12 Pro');
    expect(text).toContain('Intel N100, 4 cores, 4 threads, 3.4 GHz, 6W TDP');
    expect(text).toContain('16GB DDR5-4800 SODIMM');
    expect(text).toContain('512GB NVMe SSD');
    expect(text).toContain(
      'Dual 2TB Crucial MX500 SATA SSDs in external RAID-1 mirror'
    );
    expect(text).toContain('Dual 2.5 GbE Intel i226-V ports');
    expect(text).toContain('12W draw');
    expect(text).toContain('CyberPower CP685AVRG (685VA / 390W)');
    expect(text).toContain('$705');
    expect(text).toContain('$99/mo lease');
    expect(text).toContain('Wholesale cost: $522.22 with 35% margin');

    const button = tier1Card.querySelector('a.portal-btn');
    expect(button.getAttribute('href')).toContain('preset=tier1');
    expect(button.textContent.trim()).toBe('Customize in Appliance Portal');
  });

  it('renders exact hardware specifications for Tier 2: Workstation Tower Appliance', () => {
    const tier2Card = fixture.nativeElement.querySelector(
      '.tier-card[data-tier="tier2"]'
    );
    expect(tier2Card).not.toBeNull();
    const text = tier2Card.textContent;

    expect(text).toContain('Workstation Tower Appliance');
    expect(text).toContain('Target: 50 to 250 users');
    expect(text).toContain('Dell PowerEdge T150 Tower');
    expect(text).toContain('AMD Ryzen 5 7600 or Intel Core i5-14500');
    expect(text).toContain('32GB to 64GB DDR5 ECC Unbuffered');
    expect(text).toContain('Dual 1TB NVMe SSDs in ZFS mirror');
    expect(text).toContain(
      'Dual 4TB Seagate IronWolf Pro SATA HDDs in ZFS mirror'
    );
    expect(text).toContain('GL.iNet GL-X3000 Spitz AX');
    expect(text).toContain('APC Smart-UPS SMT1500C (1500VA / 1000W)');
    expect(text).toContain('$2,850 to $3,200 setup');
    expect(text).toContain('$199/mo lease');
    expect(text).toContain('Wholesale cost: $2,111.11 with 35% margin');

    const button = tier2Card.querySelector('a.portal-btn');
    expect(button.getAttribute('href')).toContain('preset=tier2');
  });

  it('renders exact hardware specifications for Tier 3: Enterprise Rackmount Appliance', () => {
    const tier3Card = fixture.nativeElement.querySelector(
      '.tier-card[data-tier="tier3"]'
    );
    expect(tier3Card).not.toBeNull();
    const text = tier3Card.textContent;

    expect(text).toContain('Enterprise Rackmount Appliance');
    expect(text).toContain(
      'Target: 250+ users, municipalities, commercial builders'
    );
    expect(text).toContain('Supermicro AS-1015A-MT 2U Rackmount');
    expect(text).toContain('AMD EPYC 4344P or AMD Ryzen 9 7900');
    expect(text).toContain('64GB to 128GB DDR5 ECC Registered');
    expect(text).toContain('Dual 960GB Micron 7450 Pro Enterprise NVMe');
    expect(text).toContain(
      'Four 8TB Enterprise HDDs in ZFS RAID-Z2 (raw 32TB)'
    );
    expect(text).toContain('PNY NVIDIA GeForce RTX 4060 Ti 16GB');
    expect(text).toContain('Dual 10 GbE SFP+ optical ports');
    expect(text).toContain(
      'CyberPower OL2200RTXL2U (2000VA online double-conversion)'
    );
    expect(text).toContain('$3,200 setup or $40,000 project build');
    expect(text).toContain('$349/mo lease');

    const button = tier3Card.querySelector('a.portal-btn');
    expect(button.getAttribute('href')).toContain('preset=tier3');
  });

  it('contains zero em dashes and maintains sentence case headings', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain('\u2014'); // em dash
    expect(element.textContent).not.toContain('&mdash;');

    const h2 = element.querySelector('h2');
    expect(h2?.textContent?.trim()).toBe('Turn-key hardware appliances');
  });
});
