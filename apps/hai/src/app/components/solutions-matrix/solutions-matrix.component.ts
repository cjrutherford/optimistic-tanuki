import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  BadgeComponent,
  CardComponent,
  TabsComponent,
  Tab,
} from '@optimistic-tanuki/common-ui';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { Observable } from 'rxjs';

export interface SolutionVertical {
  id: string;
  name: string;
  tabLabel: string;
  targetIndustry: string;
  summary: string;
  hardwareTier: string;
  hardwareDetails: string;
  whiteBoxApps: {
    name: string;
    path: string;
    slice: string;
    demoRoute: string;
    features: string[];
  }[];
  fossStack: {
    name: string;
    role: string;
  }[];
  investment: {
    upfront?: string;
    monthly: string;
    projectOption?: string;
  };
  actionLabel: string;
  configuratorPreset: string;
  portalUrl?: string;
}

export const VERTICAL_SOLUTIONS: SolutionVertical[] = [
  {
    id: 'vertical-field',
    name: 'Trade and field contractors',
    tabLabel: 'Trade and field',
    targetIndustry:
      'Electrical, plumbing, HVAC, roofing, and general trade contractors',
    summary:
      'Dispatches field teams, issues estimates, collects client signatures on tablets, and runs accounting entirely on an on-premises mini server.',
    hardwareTier: 'Tier 1 Compact Mini-PC (Beelink N100) + CyberPower UPS',
    hardwareDetails:
      'Intel N100 quad-core processor, 16GB DDR5 memory, 512GB NVMe boot drive, external dual 2TB SATA SSDs in RAID-1 mirror, 12W draw, and CyberPower pure sine-wave UPS with automated shutdown daemon.',
    whiteBoxApps: [
      {
        name: 'Field Flow',
        path: 'apps/whitebox-field-flow',
        slice: 'Slice 04',
        demoRoute: '/field-flow/demo',
        features: [
          'Offline-first mobile job dispatch and crew time tracking',
          'On-site work order sign-offs with direct customer signature capture',
          'Equipment service history and inventory tracking',
          'Instant invoice generation pushed directly to local accounting',
        ],
      },
    ],
    fossStack: [
      {
        name: 'Invoice Ninja v5',
        role: 'Client portal, automated quoting, and recurring billing',
      },
      {
        name: 'Vikunja',
        role: 'Crew task assignment, dispatch checklists, and job scheduling',
      },
      {
        name: 'N8N',
        role: 'Workflow automation routing webhooks, notifications, and alerts',
      },
    ],
    investment: {
      monthly: '$50/mo software + $99/mo Mini-PC lease',
    },
    actionLabel: 'Configure Tier 1 Appliance',
    configuratorPreset: 'tier1',
  },
  {
    id: 'vertical-cpa',
    name: 'Regulated CPA and tax practices',
    tabLabel: 'CPA and tax',
    targetIndustry:
      'Accounting firms, certified public accountants, and tax preparation practices',
    summary:
      'Safeguards taxpayer records on local office hardware, intake client returns through an encrypted portal, and retains documents under IRS Section 7216 compliance.',
    hardwareTier:
      'Tier 2 Workstation Tower (Dell T150) + APC Smart-UPS + GL.iNet cellular router',
    hardwareDetails:
      'Dell PowerEdge T150 Tower with AMD Ryzen or Intel Core processor, 32GB to 64GB DDR5 ECC memory, mirrored NVMe and mirrored 4TB IronWolf Pro HDDs in ZFS, APC Smart-UPS 1500C, and GL.iNet cellular failover.',
    whiteBoxApps: [
      {
        name: 'Practice Vault',
        path: 'apps/whitebox-practice-vault',
        slice: 'Slice 05',
        demoRoute: '/practice-vault/demo',
        features: [
          'Encrypted client tax document intake portal',
          'Automated client identity validation and retention lock',
          'IRS Section 7216 and FTC Safeguards compliance logging',
          'Immutable audit trail tracking all document views and exports',
        ],
      },
    ],
    fossStack: [
      {
        name: 'Paperless-ngx',
        role: 'Optical character recognition and searchable tax document indexing',
      },
      {
        name: 'DocuSeal',
        role: 'Legally binding signature capture on engagement letters and Form 8879',
      },
      {
        name: 'Vaultwarden',
        role: 'Self-hosted credential vault for firm-wide password management',
      },
    ],
    investment: {
      upfront: '$3,200 setup',
      monthly: '$550/mo compliance retainer',
    },
    actionLabel: 'Configure Tier 2 Appliance',
    configuratorPreset: 'tier2',
  },
  {
    id: 'vertical-legal',
    name: 'Real estate title and law firms',
    tabLabel: 'Legal and title',
    targetIndustry:
      'Real estate closing attorneys, title companies, and civil litigation practices',
    summary:
      'Protects escrow transactions against wire fraud, verifies wiring instructions with two-factor validation, and keeps client communications immune from third-party inspection.',
    hardwareTier: 'Tier 2 Workstation Tower (Dell T150) + APC Smart-UPS',
    hardwareDetails:
      'Dell PowerEdge T150 Tower with ECC DDR5 memory, mirrored ZFS NVMe storage, mirrored Seagate IronWolf Pro archive drives, and APC Smart-UPS battery backup with auto-shutdown scripts.',
    whiteBoxApps: [
      {
        name: 'Practice Vault Wire Shield',
        path: 'apps/whitebox-practice-vault Wire Shield',
        slice: 'Slice 05',
        demoRoute: '/wire-shield/demo',
        features: [
          'Two-factor verified closing wire instructions',
          'Encrypted transaction room for title transfer and payoff documents',
          'Identity-verified payout confirmation notices',
          'Cryptographic receipt logging verifying delivery and acceptance',
        ],
      },
    ],
    fossStack: [
      {
        name: 'Stalwart Mail Server',
        role: 'Self-hosted secure mail server free from cloud vendor data mining',
      },
      {
        name: 'DocuSeal',
        role: 'Audit-ready electronic signatures for closing disclosures and deeds',
      },
    ],
    investment: {
      upfront: '$2,850 setup',
      monthly: '$650/mo defense retainer',
    },
    actionLabel: 'Configure Tier 2 Appliance',
    configuratorPreset: 'tier2',
  },
  {
    id: 'vertical-builders',
    name: 'Commercial builders and municipal agencies',
    tabLabel: 'Builders and municipal',
    targetIndustry:
      'Commercial general contractors, civil engineers, and municipal government departments',
    summary:
      'Processes heavy engineering drawings, manages multi-phase permits, and indexes ordinances locally with private AI inference on enterprise rackmount hardware.',
    hardwareTier:
      'Tier 3 Enterprise 2U Rackmount (Supermicro EPYC / RTX 4060 Ti) + CyberPower Online UPS',
    hardwareDetails:
      'Supermicro AS-1015A-MT 2U Rackmount with AMD EPYC processor, 64GB to 128GB DDR5 ECC Registered memory, 32TB raw ZFS storage, NVIDIA RTX 4060 Ti 16GB GPU for local Ollama inference, and CyberPower Online Double-Conversion UPS.',
    whiteBoxApps: [
      {
        name: 'Project Nexus',
        path: 'apps/whitebox-project-nexus',
        slice: 'Slice 06',
        demoRoute: '/project-nexus/demo',
        features: [
          'Submittal tracking and plan revision change management',
          'Subcontractor drawing distribution and RFIs',
          'On-site photo documentation linked directly to drawing sheets',
        ],
      },
      {
        name: 'Civic Core',
        path: 'apps/whitebox-civic-core',
        slice: 'Slice 07',
        demoRoute: '/civic-core/demo',
        features: [
          'Building permit application intake and department review routing',
          'Public records archival compliant with state retention statutes',
          'Local AI indexing of county ordinances and codes without third-party exposure',
        ],
      },
    ],
    fossStack: [
      {
        name: 'Nextcloud Enterprise',
        role: 'Terabyte-scale team file sync and collaboration platform',
      },
      {
        name: 'Planka',
        role: 'Milestone tracking and department coordination boards',
      },
      {
        name: 'Stirling-PDF',
        role: 'Local PDF redaction, split, merge, and conversion utility',
      },
      {
        name: 'Local Ollama with Open WebUI',
        role: 'Private on-premises large language model for ordinance and specification searches',
      },
    ],
    investment: {
      upfront: '$3,200 setup',
      monthly: '$849/mo retainer',
      projectOption: '$40,000 project build',
    },
    actionLabel: 'Configure Tier 3 Appliance',
    configuratorPreset: 'tier3',
  },
];

@Component({
  selector: 'hai-solutions-matrix',
  standalone: true,
  imports: [CommonModule, TabsComponent, CardComponent, BadgeComponent],
  templateUrl: './solutions-matrix.component.html',
  styleUrl: './solutions-matrix.component.scss',
})
export class SolutionsMatrixComponent implements OnInit {
  private readonly catalogService = inject(HardwareCatalogService);

  readonly verticals = VERTICAL_SOLUTIONS;
  readonly activeVerticalId = signal<string>(VERTICAL_SOLUTIONS[0].id);

  readonly tabs: Tab[] = VERTICAL_SOLUTIONS.map((v) => ({
    id: v.id,
    label: v.tabLabel,
  }));

  readonly portalUrls: Record<string, Observable<string>> = {
    tier1: this.catalogService.getPortalUrl('tier1'),
    tier2: this.catalogService.getPortalUrl('tier2'),
    tier3: this.catalogService.getPortalUrl('tier3'),
  };

  ngOnInit(): void {
    // Component initializes with the first vertical active
  }

  get activeVertical(): SolutionVertical {
    return (
      this.verticals.find((v) => v.id === this.activeVerticalId()) ||
      this.verticals[0]
    );
  }

  onTabChange(tabId: string): void {
    this.activeVerticalId.set(tabId);
  }

  getPortalUrl(preset: string): Observable<string> {
    return this.portalUrls[preset] || this.catalogService.getPortalUrl(preset);
  }
}
