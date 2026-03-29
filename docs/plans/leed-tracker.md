# LEAD TRACKER — Technical Specification

## Purpose
A microservice for tracking agency client leads, integrated into the existing Optimistic Tanuki gateway.

---

## Setup (Nx Tooling)

```bash
# Generate the microservice app
nx generate @nx/node:application lead-tracker --directory=apps/lead-tracker

# Generate E2E tests
nx generate @nx/playwright:configuration lead-tracker-e2e
```

---

## Monorepo Structure

```
optimistic-tanuki/
├── apps/
│   ├── gateway/                    # EXISTING: API gateway (add lead controllers here)
│   ├── lead-tracker/              # NEW: Microservice (generated with Nx)
│   └── lead-tracker-e2e/          # NEW: E2E tests (generated with Nx)
│
├── libs/
│   ├── models/                    # EXISTING: Add lead models here
│   └── constants/                 # EXISTING: Add lead commands here
```

---

## Configuration

### Gateway Config (apps/gateway/src/config.ts)

```typescript
export const loadConfig = () => ({
  // ... existing config
  services: {
    // ... existing services
    lead_tracker: {
      host: process.env.LEAD_SERVICE_HOST || 'localhost',
      port: Number(process.env.LEAD_SERVICE_PORT) || 3020,
    },
  },
});
```

### YAML Override

Config values in YAML are defaults. Environment variables override:
```yaml
# config.yaml (if exists)
services:
  lead_tracker:
    host: localhost
    port: 3020
```

```bash
# Environment override
LEAD_SERVICE_HOST=192.168.1.100
LEAD_SERVICE_PORT=3020
```

---

## Microservice (apps/lead-tracker/)

### main.ts

```typescript
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

export async function bootstrap() {
  const configApp = await NestFactory.create(AppModule);
  const config = configApp.get(ConfigService);
  
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: Number(config.get('listenPort')) || 3020,
      },
    }
  );
  
  await app.listen().then(() => {
    Logger.log('Lead Tracker listening on port: ' + (config.get('listenPort') || 3020));
  });
}

bootstrap();
```

### Controller (apps/lead-tracker/src/controllers/leads/leads.controller.ts)

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LeadsService } from '../../services/leads.service';
import {
  LeadCommands,
  CreateLeadDto,
  UpdateLeadDto,
} from '@optimistic-tanuki/models';

@Controller()
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @MessagePattern({ cmd: LeadCommands.FIND_ALL })
  async findAll(@Payload() filters?: { status?: string; source?: string }) {
    return this.leadsService.findAll(filters);
  }

  @MessagePattern({ cmd: LeadCommands.FIND_ONE })
  async findOne(@Payload() data: { id: string }) {
    return this.leadsService.findOne(data.id);
  }

  @MessagePattern({ cmd: LeadCommands.CREATE })
  async create(@Payload() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @MessagePattern({ cmd: LeadCommands.UPDATE })
  async update(@Payload() data: { id: string; dto: UpdateLeadDto }) {
    return this.leadsService.update(data.id, data.dto);
  }

  @MessagePattern({ cmd: LeadCommands.DELETE })
  async delete(@Payload() data: { id: string }) {
    return this.leadsService.delete(data.id);
  }

  @MessagePattern({ cmd: LeadCommands.GET_STATS })
  async getStats() {
    return this.leadsService.getStats();
  }
}
```

### Service (apps/lead-tracker/src/services/leads.service.ts)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead, CreateLeadDto, UpdateLeadDto } from '@optimistic-tanuki/models';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
  ) {}

  async findAll(filters?: { status?: string; source?: string }): Promise<Lead[]> {
    const query = this.leadRepository.createQueryBuilder('lead');
    
    if (filters?.status) {
      query.andWhere('lead.status = :status', { status: filters.status });
    }
    if (filters?.source) {
      query.andWhere('lead.source = :source', { source: filters.source });
    }
    
    return query.orderBy('lead.nextFollowUp', 'ASC').getMany();
  }

  async findOne(id: string): Promise<Lead> {
    return this.leadRepository.findOneBy({ id });
  }

  async create(dto: CreateLeadDto): Promise<Lead> {
    const lead = this.leadRepository.create(dto);
    return this.leadRepository.save(lead);
  }

  async update(id: string, dto: UpdateLeadDto): Promise<Lead> {
    await this.leadRepository.update(id, dto);
    return this.leadRepository.findOneBy({ id });
  }

  async delete(id: string): Promise<void> {
    await this.leadRepository.delete(id);
  }

  async getStats() {
    const leads = await this.leadRepository.find();
    
    return {
      total: leads.length,
      autoDiscovered: leads.filter(l => l.isAutoDiscovered).length,
      manual: leads.filter(l => !l.isAutoDiscovered).length,
      totalValue: leads.reduce((sum, l) => sum + (l.value || 0), 0),
      followUpsDue: leads.filter(l => {
        if (!l.nextFollowUp) return false;
        if (l.status === 'won' || l.status === 'lost') return false;
        return new Date(l.nextFollowUp) <= new Date();
      }).length,
      byStatus: leads.reduce((acc, l) => {
        acc[l.status] = (acc[l.status] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}
```

---

## Gateway Integration (Existing Gateway)

### Controller (apps/gateway/src/controllers/leads/leads.controller.ts)

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  ServiceTokens,
  LeadCommands,
  CreateLeadDto,
  UpdateLeadDto,
} from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';

@UseGuards(AuthGuard, PermissionsGuard)
@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(
    @Inject(ServiceTokens.LEAD_SERVICE)
    private readonly leadClient: ClientProxy,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all leads' })
  @RequirePermissions('leads.read')
  async findAll(
    @Query('status') status?: string,
    @Query('source') source?: string,
  ) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.FIND_ALL }, { status, source }),
    );
  }

  @Get('stats/overview')
  @ApiOperation({ summary: 'Get lead statistics' })
  @RequirePermissions('leads.read')
  async getStats() {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.GET_STATS }, {}),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by ID' })
  @RequirePermissions('leads.read')
  async findOne(@Param('id') id: string) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.FIND_ONE }, { id }),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create lead' })
  @RequirePermissions('leads.create')
  async create(@Body() dto: CreateLeadDto) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.CREATE }, dto),
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update lead' })
  @RequirePermissions('leads.update')
  async update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.UPDATE }, { id, dto }),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete lead' })
  @RequirePermissions('leads.delete')
  async delete(@Param('id') id: string) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.DELETE }, { id }),
    );
  }
}
```

### Module Registration (apps/gateway/src/app/app.module.ts)

```typescript
// Add to controllers array
LeadsController,

// Add to providers array
{
  provide: ServiceTokens.LEAD_SERVICE,
  useFactory: (configService: ConfigService) => {
    const serviceConfig = configService.get<TcpServiceConfig>('services.lead_tracker');
    return ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: serviceConfig.host,
        port: serviceConfig.port,
      },
    });
  },
  inject: [ConfigService],
},
```

---

## Models (libs/models)

### libs/models/src/lib/libs/leads/lead-source.enum.ts

```typescript
export enum LeadSource {
  UPWORK = 'upwork',
  LINKEDIN = 'linkedin',
  REFERRAL = 'referral',
  COLD = 'cold',
  LOCAL = 'local',
  OTHER = 'other',
}
```

### libs/models/src/lib/libs/leads/lead-status.enum.ts

```typescript
export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  PROPOSAL = 'proposal',
  WON = 'won',
  LOST = 'lost',
}
```

### libs/models/src/lib/libs/leads/lead.model.ts

```typescript
import { LeadSource } from './lead-source.enum';
import { LeadStatus } from './lead-status.enum';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  company?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: 'enum', enum: LeadSource })
  source: LeadSource;

  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.NEW })
  status: LeadStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  value: number;

  @Column({ type: 'text', default: '' })
  notes: string;

  @Column({ type: 'date', nullable: true })
  nextFollowUp?: string;

  @Column({ default: false })
  isAutoDiscovered: boolean;

  @Column({ type: 'simple-array', nullable: true })
  searchKeywords?: string[];

  @Column({ nullable: true })
  assignedTo?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### libs/models/src/lib/libs/leads/create-lead.dto.ts

```typescript
import { IsString, IsEmail, IsOptional, IsEnum, IsNumber, IsBoolean, IsDateString, IsArray, Min } from 'class-validator';
import { LeadSource } from './lead-source.enum';
import { LeadStatus } from './lead-status.enum';

export class CreateLeadDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(LeadSource)
  source: LeadSource;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus = LeadStatus.NEW;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number = 0;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUp?: string;

  @IsOptional()
  @IsBoolean()
  isAutoDiscovered?: boolean = false;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  searchKeywords?: string[];
}
```

### libs/models/src/lib/libs/leads/update-lead.dto.ts

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}
```

### libs/models/src/lib/libs/leads/index.ts

```typescript
export * from './lead.model';
export * from './lead-source.enum';
export * from './lead-status.enum';
export * from './create-lead.dto';
export * from './update-lead.dto';
```

---

## Constants (libs/constants)

### libs/constants/src/lib/libs/leads/lead-commands.ts

```typescript
export const LeadCommands = {
  FIND_ALL: 'lead.findAll',
  FIND_ONE: 'lead.findOne',
  CREATE: 'lead.create',
  UPDATE: 'lead.update',
  DELETE: 'lead.delete',
  GET_STATS: 'lead.getStats',
  SEARCH: 'lead.search',
} as const;
```

### Add to libs/constants/src/index.ts

```typescript
export { LeadCommands } from './lib/libs/leads';
```

### Add to libs/constants/src/lib/libs/service.tokens.ts

```typescript
LEAD_SERVICE: 'LEAD_SERVICE',
```

---

## Permissions

Add to permissions system:
```typescript
'leads.read'
'leads.create'
'leads.update'
'leads.delete'
'leads.search'
```

---

## Frontend

### Setup (Nx Tooling)

```bash
# Generate the frontend app
nx generate @nx/angular:application lead-tracker-ui --directory=apps/lead-tracker-ui

# Generate E2E tests
nx generate @nx/playwright:configuration lead-tracker-ui-e2e
```

### Routes

```typescript
// apps/lead-tracker-ui/src/app/app.routes.ts

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'leads',
    loadComponent: () =>
      import('./pages/leads/leads.component').then(m => m.LeadsComponent),
  },
  {
    path: 'search-config',
    loadComponent: () =>
      import('./pages/search-config/search-config.component').then(m => m.SearchConfigComponent),
  },
];
```

### Services

#### Leads Service

```typescript
// apps/lead-tracker-ui/src/app/services/leads.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Lead, LeadStats, CreateLeadDto, UpdateLeadDto } from '@optimistic-tanuki/models';

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly apiUrl = '/api/leads';

  constructor(private http: HttpClient) {}

  findAll(status?: string, source?: string): Observable<Lead[]> {
    const params: any = {};
    if (status) params.status = status;
    if (source) params.source = source;
    return this.http.get<Lead[]>(this.apiUrl, { params });
  }

  findOne(id: string): Observable<Lead> {
    return this.http.get<Lead>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateLeadDto): Observable<Lead> {
    return this.http.post<Lead>(this.apiUrl, dto);
  }

  update(id: string, dto: UpdateLeadDto): Observable<Lead> {
    return this.http.put<Lead>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getStats(): Observable<LeadStats> {
    return this.http.get<LeadStats>(`${this.apiUrl}/stats/overview`);
  }
}
```

### Components

#### Dashboard Component

```typescript
// apps/lead-tracker-ui/src/app/pages/dashboard/dashboard.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LeadsService } from '../../services/leads.service';
import { LeadStats } from '@optimistic-tanuki/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard">
      <h2>Lead Tracker Dashboard</h2>

      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Leads</h3>
          <div class="value">{{ stats?.total || 0 }}</div>
        </div>
        <div class="stat-card">
          <h3>Auto-Discovered</h3>
          <div class="value">{{ stats?.autoDiscovered || 0 }}</div>
        </div>
        <div class="stat-card">
          <h3>Pipeline Value</h3>
          <div class="value">\${{ (stats?.totalValue || 0) | number }}</div>
        </div>
        <div class="stat-card">
          <h3>Follow-ups Due</h3>
          <div class="value warning">{{ stats?.followUpsDue || 0 }}</div>
        </div>
        <div class="stat-card">
          <h3>Won</h3>
          <div class="value success">{{ stats?.byStatus?.won || 0 }}</div>
        </div>
      </div>

      <div class="actions">
        <a routerLink="/leads" class="btn-primary">View All Leads</a>
        <a routerLink="/search-config" class="btn-secondary">Search Config</a>
      </div>

      <div class="recent-leads">
        <h3>Recent Leads</h3>
        @if (recentLeads.length === 0) {
          <p class="empty">No leads yet. Add your first lead!</p>
        } @else {
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Status</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              @for (lead of recentLeads; track lead.id) {
                <tr>
                  <td>{{ lead.name }}</td>
                  <td>{{ lead.company || '-' }}</td>
                  <td><span class="status-badge" [class]="lead.status">{{ lead.status }}</span></td>
                  <td>\${{ lead.value | number }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
  styles: [`
    .dashboard { padding: 20px; }
    h2 { color: #4ecdc4; margin-bottom: 20px; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 15px;
    }
    .stat-card h3 { color: #888; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
    .stat-card .value { font-size: 28px; font-weight: bold; color: #4ecdc4; }
    .stat-card .value.warning { color: #f39c12; }
    .stat-card .value.success { color: #27ae60; }
    .actions { display: flex; gap: 10px; margin-bottom: 30px; }
    .btn-primary {
      background: #4ecdc4; color: #000; padding: 10px 20px;
      border-radius: 6px; text-decoration: none; font-weight: bold;
    }
    .btn-secondary {
      background: #333; color: #888; padding: 10px 20px;
      border-radius: 6px; text-decoration: none;
    }
    table { width: 100%; border-collapse: collapse; background: #1a1a1a; border-radius: 12px; overflow: hidden; }
    th { background: #252525; padding: 12px; text-align: left; color: #888; font-size: 12px; }
    td { padding: 12px; border-bottom: 1px solid #333; }
    .status-badge {
      padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;
    }
    .status-badge.new { background: #2d5a27; color: #9fef90; }
    .status-badge.contacted { background: #5a4e27; color: #efdf90; }
    .status-badge.proposal { background: #273e5a; color: #90b9ef; }
    .status-badge.won { background: #4ecdc4; color: #000; }
    .status-badge.lost { background: #5a2727; color: #ef9090; }
    .empty { color: #888; font-style: italic; }
  `],
})
export class DashboardComponent implements OnInit {
  stats: LeadStats | null = null;
  recentLeads: any[] = [];

  constructor(private leadsService: LeadsService) {}

  ngOnInit() {
    this.leadsService.getStats().subscribe(stats => this.stats = stats);
    this.leadsService.findAll().subscribe(leads => {
      this.recentLeads = leads.slice(0, 5);
    });
  }
}
```

#### Leads List Component

```typescript
// apps/lead-tracker-ui/src/app/pages/leads/leads.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeadsService } from '../../services/leads.service';
import { Lead, LeadStatus, CreateLeadDto } from '@optimistic-tanuki/models';

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="leads-page">
      <div class="header">
        <h2>Leads</h2>
        <button class="btn-primary" (click)="showAddForm = true">+ Add Lead</button>
      </div>

      <div class="filters">
        <button
          *ngFor="let status of statuses"
          [class.active]="currentFilter === status"
          (click)="filterByStatus(status)"
          class="filter-btn"
        >
          {{ status | titlecase }}
        </button>
      </div>

      @if (showAddForm) {
        <div class="add-form">
          <h3>Add New Lead</h3>
          <div class="form-row">
            <div class="form-group">
              <label>Name</label>
              <input type="text" [(ngModel)]="newLead.name" placeholder="Contact name">
            </div>
            <div class="form-group">
              <label>Company</label>
              <input type="text" [(ngModel)]="newLead.company" placeholder="Company name">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="newLead.email" placeholder="email@example.com">
            </div>
            <div class="form-group">
              <label>Source</label>
              <select [(ngModel)]="newLead.source">
                <option value="upwork">Upwork</option>
                <option value="linkedin">LinkedIn</option>
                <option value="referral">Referral</option>
                <option value="cold">Cold</option>
                <option value="local">Local</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Value ($)</label>
              <input type="number" [(ngModel)]="newLead.value" placeholder="5000">
            </div>
            <div class="form-group">
              <label>Follow-up Date</label>
              <input type="date" [(ngModel)]="newLead.nextFollowUp">
            </div>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea [(ngModel)]="newLead.notes" rows="3" placeholder="Notes..."></textarea>
          </div>
          <div class="form-actions">
            <button class="btn-secondary" (click)="showAddForm = false">Cancel</button>
            <button class="btn-primary" (click)="addLead()">Save</button>
          </div>
        </div>
      }

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Company</th>
            <th>Source</th>
            <th>Value</th>
            <th>Status</th>
            <th>Follow-up</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (lead of filteredLeads; track lead.id) {
            <tr [class.due-soon]="isDueSoon(lead)">
              <td>{{ lead.name }}</td>
              <td>{{ lead.company || '-' }}</td>
              <td>{{ lead.source }}</td>
              <td>\${{ lead.value | number }}</td>
              <td>
                <select [(ngModel)]="lead.status" (change)="updateStatus(lead)">
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="proposal">Proposal</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </td>
              <td>{{ lead.nextFollowUp || '-' }}</td>
              <td>
                <button class="action-btn" (click)="deleteLead(lead.id)">Delete</button>
              </td>
            </tr>
          }
        </tbody>
      </table>

      @if (filteredLeads.length === 0) {
        <p class="empty">No leads found. Add your first lead!</p>
      }
    </div>
  `,
  styles: [`
    .leads-page { padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    h2 { color: #4ecdc4; }
    .filters { display: flex; gap: 10px; margin-bottom: 20px; }
    .filter-btn { background: #333; color: #888; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
    .filter-btn.active { background: #4ecdc4; color: #000; }
    .btn-primary { background: #4ecdc4; color: #000; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
    .btn-secondary { background: #333; color: #888; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
    .add-form {
      background: #1a1a1a; border: 1px solid #333; border-radius: 12px;
      padding: 20px; margin-bottom: 20px;
    }
    .add-form h3 { color: #4ecdc4; margin-bottom: 15px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; color: #888; margin-bottom: 5px; font-size: 13px; }
    .form-group input, .form-group select, .form-group textarea {
      width: 100%; background: #252525; border: 1px solid #444; border-radius: 6px;
      padding: 10px; color: #fff;
    }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; }
    table { width: 100%; border-collapse: collapse; background: #1a1a1a; border-radius: 12px; overflow: hidden; }
    th { background: #252525; padding: 12px; text-align: left; color: #888; font-size: 12px; }
    td { padding: 12px; border-bottom: 1px solid #333; }
    tr.due-soon { background: #3a2a1a; }
    select { background: #252525; border: 1px solid #444; color: #fff; padding: 5px; border-radius: 4px; }
    .action-btn { background: transparent; border: 1px solid #444; color: #888; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
    .empty { color: #888; text-align: center; padding: 40px; font-style: italic; }
  `],
})
export class LeadsComponent implements OnInit {
  leads: Lead[] = [];
  filteredLeads: Lead[] = [];
  currentFilter = 'all';
  showAddForm = false;
  statuses = ['all', 'new', 'contacted', 'proposal', 'won', 'lost'];
  newLead: Partial<CreateLeadDto> = {
    source: 'upwork' as any,
    status: 'new' as any,
    value: 0,
  };

  constructor(private leadsService: LeadsService) {}

  ngOnInit() {
    this.loadLeads();
  }

  loadLeads() {
    this.leadsService.findAll().subscribe(leads => {
      this.leads = leads;
      this.applyFilter();
    });
  }

  filterByStatus(status: string) {
    this.currentFilter = status;
    this.applyFilter();
  }

  applyFilter() {
    if (this.currentFilter === 'all') {
      this.filteredLeads = this.leads;
    } else {
      this.filteredLeads = this.leads.filter(l => l.status === this.currentFilter);
    }
  }

  addLead() {
    this.leadsService.create(this.newLead as CreateLeadDto).subscribe(() => {
      this.showAddForm = false;
      this.newLead = { source: 'upwork' as any, status: 'new' as any, value: 0 };
      this.loadLeads();
    });
  }

  updateStatus(lead: Lead) {
    this.leadsService.update(lead.id, { status: lead.status }).subscribe();
  }

  deleteLead(id: string) {
    if (confirm('Delete this lead?')) {
      this.leadsService.delete(id).subscribe(() => this.loadLeads());
    }
  }

  isDueSoon(lead: Lead): boolean {
    if (!lead.nextFollowUp) return false;
    if (lead.status === 'won' || lead.status === 'lost') return false;
    return new Date(lead.nextFollowUp) <= new Date();
  }
}
```

#### Search Config Component

```typescript
// apps/lead-tracker-ui/src/app/pages/search-config/search-config.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-search-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-config">
      <h2>Search Configuration</h2>

      <div class="config-section">
        <h3>Search Keywords</h3>
        <div class="keywords">
          @for (keyword of config.keywords; track keyword) {
            <span class="keyword-tag">
              {{ keyword }}
              <button (click)="removeKeyword(keyword)">&times;</button>
            </span>
          }
        </div>
        <div class="add-keyword">
          <input type="text" [(ngModel)]="newKeyword" placeholder="Add keyword...">
          <button class="btn-primary" (click)="addKeyword()">Add</button>
        </div>
      </div>

      <div class="config-section">
        <h3>Settings</h3>
        <div class="form-row">
          <div class="form-group">
            <label>Search Interval (minutes)</label>
            <input type="number" [(ngModel)]="searchIntervalMinutes">
          </div>
          <div class="form-group">
            <label>Min Budget ($)</label>
            <input type="number" [(ngModel)]="config.minBudget">
          </div>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" [(ngModel)]="config.autoSearch">
            Enable Auto-Search
          </label>
        </div>
      </div>

      <div class="actions">
        <button class="btn-secondary" (click)="runManualSearch()">Run Search Now</button>
        <button class="btn-primary" (click)="saveConfig()">Save Config</button>
      </div>

      @if (lastSearchResult) {
        <div class="search-result">
          <h3>Last Search Result</h3>
          <p>Found {{ lastSearchResult.newLeads }} new leads</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .search-config { padding: 20px; max-width: 600px; }
    h2 { color: #4ecdc4; margin-bottom: 20px; }
    .config-section {
      background: #1a1a1a; border: 1px solid #333; border-radius: 12px;
      padding: 20px; margin-bottom: 20px;
    }
    .config-section h3 { color: #4ecdc4; margin-bottom: 15px; }
    .keywords { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px; }
    .keyword-tag {
      background: #333; color: #888; padding: 5px 10px; border-radius: 4px;
      display: flex; align-items: center; gap: 5px;
    }
    .keyword-tag button { background: none; border: none; color: #888; cursor: pointer; font-size: 16px; }
    .add-keyword { display: flex; gap: 10px; }
    .add-keyword input { flex: 1; background: #252525; border: 1px solid #444; border-radius: 6px; padding: 10px; color: #fff; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; color: #888; margin-bottom: 5px; font-size: 13px; }
    .form-group input[type="number"], .form-group input[type="text"] {
      width: 100%; background: #252525; border: 1px solid #444; border-radius: 6px;
      padding: 10px; color: #fff;
    }
    .form-group input[type="checkbox"] { margin-right: 8px; }
    .actions { display: flex; gap: 10px; }
    .btn-primary { background: #4ecdc4; color: #000; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
    .btn-secondary { background: #333; color: #888; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
    .search-result { background: #1a2a1a; border: 1px solid #2d5a27; border-radius: 12px; padding: 20px; margin-top: 20px; }
    .search-result h3 { color: #9fef90; margin-bottom: 10px; }
  `],
})
export class SearchConfigComponent implements OnInit {
  config: any = {
    keywords: [],
    minBudget: 1000,
    autoSearch: true,
    searchInterval: 3600000,
  };
  newKeyword = '';
  searchIntervalMinutes = 60;
  lastSearchResult: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get('/api/search/config').subscribe((config: any) => {
      this.config = config;
      this.searchIntervalMinutes = config.searchInterval / 60000;
    });
  }

  addKeyword() {
    if (this.newKeyword.trim()) {
      this.config.keywords.push(this.newKeyword.trim());
      this.newKeyword = '';
    }
  }

  removeKeyword(keyword: string) {
    this.config.keywords = this.config.keywords.filter((k: string) => k !== keyword);
  }

  saveConfig() {
    this.config.searchInterval = this.searchIntervalMinutes * 60000;
    this.http.put('/api/search/config', this.config).subscribe(() => {
      alert('Config saved!');
    });
  }

  runManualSearch() {
    this.http.post('/api/search/run', {}).subscribe((result: any) => {
      this.lastSearchResult = result;
    });
  }
}
```

---

## File Checklist (Updated)

### Generated with Nx
- [ ] `apps/lead-tracker/` — `nx generate @nx/node:application lead-tracker`
- [ ] `apps/lead-tracker-ui/` — `nx generate @nx/angular:application lead-tracker-ui`
- [ ] `apps/lead-tracker-e2e/` — `nx generate @nx/playwright:configuration`
- [ ] `apps/lead-tracker-ui-e2e/` — `nx generate @nx/playwright:configuration`

### Created Manually (Backend)
- [ ] `apps/lead-tracker/src/controllers/leads/leads.controller.ts`
- [ ] `apps/lead-tracker/src/services/leads.service.ts`
- [ ] `apps/gateway/src/controllers/leads/leads.controller.ts`

### Created Manually (Frontend)
- [ ] `apps/lead-tracker-ui/src/app/app.routes.ts`
- [ ] `apps/lead-tracker-ui/src/app/services/leads.service.ts`
- [ ] `apps/lead-tracker-ui/src/app/pages/dashboard/dashboard.component.ts`
- [ ] `apps/lead-tracker-ui/src/app/pages/leads/leads.component.ts`
- [ ] `apps/lead-tracker-ui/src/app/pages/search-config/search-config.component.ts`

### Modified
- [ ] `libs/models/src/index.ts`
- [ ] `libs/constants/src/index.ts`
- [ ] `libs/constants/src/lib/libs/service.tokens.ts`
- [ ] `apps/gateway/src/app/app.module.ts`
- [ ] `apps/gateway/src/config.ts`

---

*Spec Version: 3.0 (Final)*  
*March 2026*
