import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  combineLatest,
  map,
  of,
  shareReplay,
} from 'rxjs';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';

export interface HardwareTier {
  id: string;
  tierNumber: number;
  name: string;
  formFactor: string;
  hardware: string;
  ram: string;
  storage: string;
  network: string;
  powerAndProtection: string;
  aiAccelerator?: string;
  targetUsers: string;
  wholesaleCost: number;
  marginRate: number;
  marginAmount: number;
  retailPrice: number;
  retailPriceMax?: number;
  leaseMonthlyRate: number;
  softwareMonthlyRate?: number;
  retainerMonthlyRate?: number;
  retainerMonthlyRateMax?: number;
  projectBuildPrice?: number;
  inStock: boolean;
  stockStatus: string;
  configuratorPreset: string;
  portalUrl?: string;
}

export const DEFAULT_HARDWARE_TIERS: HardwareTier[] = [
  {
    id: 'tier1',
    tierNumber: 1,
    name: 'Compact Edge Appliance',
    formFactor: 'Mini-PC',
    hardware:
      'Beelink EQ12 Pro (Intel N100, 4 cores, 4 threads, 3.4 GHz, 6W TDP)',
    ram: '16GB DDR5-4800 SODIMM',
    storage:
      '512GB NVMe SSD (OS) + Dual 2TB Crucial MX500 SATA SSDs in external RAID-1 mirror',
    network: 'Dual 2.5 GbE Intel i226-V ports',
    powerAndProtection:
      '12W draw. CyberPower CP685AVRG (685VA / 390W) pure sine-wave UPS with USB auto-shutdown daemon.',
    targetUsers: '10 to 50 users',
    wholesaleCost: 522.22,
    marginRate: 0.35,
    marginAmount: 182.78,
    retailPrice: 705,
    leaseMonthlyRate: 99,
    softwareMonthlyRate: 50,
    inStock: true,
    stockStatus: 'In stock',
    configuratorPreset: 'tier1',
  },
  {
    id: 'tier2',
    tierNumber: 2,
    name: 'Workstation Tower Appliance',
    formFactor: 'Tower',
    hardware:
      'Dell PowerEdge T150 Tower (AMD Ryzen 5 7600 or Intel Core i5-14500)',
    ram: '32GB to 64GB DDR5 ECC Unbuffered',
    storage:
      'Dual 1TB NVMe SSDs in ZFS mirror + Dual 4TB Seagate IronWolf Pro SATA HDDs in ZFS mirror',
    network:
      'Dual 2.5 GbE ports + GL.iNet GL-X3000 Spitz AX cellular failover router',
    powerAndProtection:
      'APC Smart-UPS SMT1500C (1500VA / 1000W) pure sine-wave UPS with automated shutdown scripts.',
    targetUsers: '50 to 250 users',
    wholesaleCost: 2111.11,
    marginRate: 0.35,
    marginAmount: 738.89,
    retailPrice: 2850,
    retailPriceMax: 3200,
    leaseMonthlyRate: 199,
    retainerMonthlyRate: 300,
    retainerMonthlyRateMax: 500,
    inStock: true,
    stockStatus: 'In stock',
    configuratorPreset: 'tier2',
  },
  {
    id: 'tier3',
    tierNumber: 3,
    name: 'Enterprise Rackmount Appliance',
    formFactor: '2U Rackmount',
    hardware:
      'Supermicro AS-1015A-MT 2U Rackmount (AMD EPYC 4344P or AMD Ryzen 9 7900)',
    ram: '64GB to 128GB DDR5 ECC Registered',
    storage:
      'Dual 960GB Micron 7450 Pro Enterprise NVMe (RAID-1) + Four 8TB Enterprise HDDs in ZFS RAID-Z2 (raw 32TB)',
    aiAccelerator:
      'PNY NVIDIA GeForce RTX 4060 Ti 16GB for local Ollama LLM execution',
    network: 'Dual 10 GbE SFP+ optical ports + dual 2.5 GbE ports',
    powerAndProtection:
      'Redundant dual 650W Platinum power supplies + CyberPower OL2200RTXL2U (2000VA online double-conversion) rackmount UPS.',
    targetUsers: '250+ users, municipalities, commercial builders',
    wholesaleCost: 2370.37,
    marginRate: 0.35,
    marginAmount: 829.63,
    retailPrice: 3200,
    projectBuildPrice: 40000,
    leaseMonthlyRate: 349,
    retainerMonthlyRate: 849,
    inStock: true,
    stockStatus: 'Available on build order',
    configuratorPreset: 'tier3',
  },
];

@Injectable({ providedIn: 'root' })
export class HardwareCatalogService {
  private readonly http = inject(HttpClient);
  private readonly appRegistry = inject(AppRegistryService);
  private readonly apiUrl = '/api/hardware/tiers';

  private readonly rawTiers$ = this.http.get<HardwareTier[]>(this.apiUrl).pipe(
    map((tiers) =>
      tiers && tiers.length > 0 ? tiers : DEFAULT_HARDWARE_TIERS
    ),
    catchError(() => of(DEFAULT_HARDWARE_TIERS))
  );

  private readonly configuratorUrl$ = this.appRegistry
    .getApp('system-configurator')
    .pipe(
      map((app) => app?.uiBaseUrl || 'http://localhost:8091'),
      catchError(() => of('http://localhost:8091'))
    );

  private readonly tiers$ = combineLatest([
    this.rawTiers$,
    this.configuratorUrl$,
  ]).pipe(
    map(([tiers, configuratorUrl]) =>
      tiers.map((tier) => {
        const separator = configuratorUrl.includes('?') ? '&' : '?';
        return {
          ...tier,
          portalUrl: `${configuratorUrl}${separator}preset=${tier.configuratorPreset}`,
        };
      })
    ),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  getTiers(): Observable<HardwareTier[]> {
    return this.tiers$;
  }

  getPortalUrl(preset: string): Observable<string> {
    return this.configuratorUrl$.pipe(
      map((baseUrl) => {
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}preset=${preset}`;
      })
    );
  }
}
