# HARDWARE PORTAL — Technical Specification

## Purpose
A microservice for hardware configuration and sales, integrated into the existing Optimistic Tanuki gateway.

---

## Setup (Nx Tooling)

```bash
# Generate the microservice app
nx generate @nx/node:application hardware-service --directory=apps/hardware-service

# Generate the frontend app
nx generate @nx/angular:application hardware-configurator --directory=apps/hardware-configurator

# Generate E2E tests
nx generate @nx/playwright:configuration hardware-service-e2e
nx generate @nx/playwright:configuration hardware-configurator-e2e
```

---

## Monorepo Structure

```
optimistic-tanuki/
├── apps/
│   ├── gateway/                    # EXISTING: API gateway (add hardware controllers here)
│   ├── hardware-service/          # NEW: Microservice (generated with Nx)
│   ├── hardware-configurator/     # NEW: Frontend (generated with Nx)
│   ├── hardware-service-e2e/      # NEW: E2E tests (generated with Nx)
│   └── hardware-configurator-e2e/ # NEW: E2E tests (generated with Nx)
│
├── libs/
│   ├── models/                    # EXISTING: Add hardware models here
│   ├── constants/                 # EXISTING: Add hardware commands here
│   └── (existing libs)            # Reuse common-ui, etc.
```

---

## Configuration

### Gateway Config (apps/gateway/src/config.ts)

```typescript
export const loadConfig = () => ({
  // ... existing config
  services: {
    // ... existing services
    hardware: {
      host: process.env.HARDWARE_SERVICE_HOST || 'localhost',
      port: Number(process.env.HARDWARE_SERVICE_PORT) || 3021,
    },
  },
});
```

### YAML Override

Config values in YAML are defaults. Environment variables override:
```yaml
# config.yaml (if exists)
services:
  hardware:
    host: localhost
    port: 3021
```

```bash
# Environment override
HARDWARE_SERVICE_HOST=192.168.1.100
HARDWARE_SERVICE_PORT=3021
```

---

## Microservice (apps/hardware-service/)

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
        port: Number(config.get('listenPort')) || 3021,
      },
    }
  );
  
  await app.listen().then(() => {
    Logger.log('Hardware Service listening on port: ' + (config.get('listenPort') || 3021));
  });
}

bootstrap();
```

### Controllers

#### Chassis Controller

```typescript
// apps/hardware-service/src/controllers/chassis/chassis.controller.ts

import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChassisService } from '../../services/chassis.service';
import { HardwareCommands, ChassisType, ChassisUseCase } from '@optimistic-tanuki/models';

@Controller()
export class ChassisController {
  constructor(private readonly chassisService: ChassisService) {}

  @MessagePattern({ cmd: HardwareCommands.FIND_ALL_CHASSIS })
  async findAll(@Payload() filters?: { type?: ChassisType; useCase?: ChassisUseCase }) {
    return this.chassisService.findAll(filters);
  }

  @MessagePattern({ cmd: HardwareCommands.FIND_CHASSIS_BY_ID })
  async findById(@Payload() data: { id: string }) {
    return this.chassisService.findById(data.id);
  }

  @MessagePattern({ cmd: HardwareCommands.GET_COMPATIBLE_COMPONENTS })
  async getCompatible(@Payload() data: { chassisId: string }) {
    return this.chassisService.getCompatibleComponents(data.chassisId);
  }
}
```

#### Components Controller

```typescript
// apps/hardware-service/src/controllers/components/components.controller.ts

import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ComponentsService } from '../../services/components.service';
import { HardwareCommands, ComponentType } from '@optimistic-tanuki/models';

@Controller()
export class ComponentsController {
  constructor(private readonly componentsService: ComponentsService) {}

  @MessagePattern({ cmd: HardwareCommands.FIND_ALL_COMPONENTS })
  async findAll(@Payload() data: { type: ComponentType; chassisId?: string }) {
    return this.componentsService.findAll(data.type, data.chassisId);
  }

  @MessagePattern({ cmd: HardwareCommands.FIND_COMPONENT_BY_ID })
  async findById(@Payload() data: { id: string }) {
    return this.componentsService.findById(data.id);
  }
}
```

#### Pricing Controller

```typescript
// apps/hardware-service/src/controllers/pricing/pricing.controller.ts

import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PricingService } from '../../services/pricing.service';
import { HardwareCommands, ConfigurationDto } from '@optimistic-tanuki/models';

@Controller()
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @MessagePattern({ cmd: HardwareCommands.CALCULATE_PRICE })
  async calculatePrice(@Payload() dto: ConfigurationDto) {
    return this.pricingService.calculatePrice(dto);
  }

  @MessagePattern({ cmd: HardwareCommands.CALCULATE_DETAILED_PRICE })
  async calculateDetailed(@Payload() dto: ConfigurationDto) {
    return this.pricingService.calculateDetailedPrice(dto);
  }
}
```

#### Orders Controller

```typescript
// apps/hardware-service/src/controllers/orders/orders.controller.ts

import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrdersService } from '../../services/orders.service';
import { HardwareCommands, CreateOrderDto } from '@optimistic-tanuki/models';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @MessagePattern({ cmd: HardwareCommands.CREATE_ORDER })
  async create(@Payload() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @MessagePattern({ cmd: HardwareCommands.FIND_ALL_ORDERS })
  async findAll() {
    return this.ordersService.findAll();
  }

  @MessagePattern({ cmd: HardwareCommands.FIND_ORDER_BY_ID })
  async findById(@Payload() data: { id: string }) {
    return this.ordersService.findById(data.id);
  }

  @MessagePattern({ cmd: HardwareCommands.UPDATE_ORDER_STATUS })
  async updateStatus(@Payload() data: { id: string; status: string }) {
    return this.ordersService.updateStatus(data.id, data.status);
  }
}
```

### Services

#### Chassis Service

```typescript
// apps/hardware-service/src/services/chassis.service.ts

import { Injectable } from '@nestjs/common';
import { Chassis, ChassisType, ChassisUseCase, CHASSIS_CATALOG, Component } from '@optimistic-tanuki/models';
import { ComponentsService } from './components.service';

@Injectable()
export class ChassisService {
  constructor(private readonly componentsService: ComponentsService) {}

  async findAll(filters?: { type?: ChassisType; useCase?: ChassisUseCase }): Promise<Chassis[]> {
    let chassis = CHASSIS_CATALOG;
    if (filters?.type) {
      chassis = chassis.filter(c => c.type === filters.type);
    }
    if (filters?.useCase) {
      chassis = chassis.filter(c => c.useCase === filters.useCase);
    }
    return chassis;
  }

  async findById(id: string): Promise<Chassis | undefined> {
    return CHASSIS_CATALOG.find(c => c.id === id);
  }

  async getCompatibleComponents(chassisId: string) {
    return {
      cpu: this.componentsService.findAll('cpu', chassisId),
      ram: this.componentsService.findAll('ram', chassisId),
      storage: this.componentsService.findAll('storage', chassisId),
      gpu: this.componentsService.findAll('gpu', chassisId),
    };
  }
}
```

#### Pricing Service

```typescript
// apps/hardware-service/src/services/pricing.service.ts

import { Injectable } from '@nestjs/common';
import {
  ConfigurationDto,
  PriceBreakdown,
  DetailedPriceBreakdown,
  CHASSIS_CATALOG,
  CPU_CATALOG,
  RAM_CATALOG,
  STORAGE_CATALOG,
  GPU_CATALOG,
} from '@optimistic-tanuki/models';

const MARKUPS = {
  chassis: 0.25,
  cpu: 0.15,
  ram: 0.20,
  storage: 0.25,
  gpu: 0.10,
  accessories: 0.30,
};

const ASSEMBLY_FEES = { xs: 25, s: 50, m: 50, l: 100 };

@Injectable()
export class PricingService {
  calculatePrice(config: ConfigurationDto): PriceBreakdown {
    const chassis = CHASSIS_CATALOG.find(c => c.id === config.chassisId);
    const cpu = CPU_CATALOG.find(c => c.id === config.cpuId);
    const ram = RAM_CATALOG.find(c => c.id === config.ramId);
    
    let storagePrice = 0;
    for (const id of config.storageIds) {
      const s = STORAGE_CATALOG.find(st => st.id === id);
      if (s) storagePrice += s.basePrice * (1 + MARKUPS.storage);
    }

    const gpu = config.gpuId ? GPU_CATALOG.find(g => g.id === config.gpuId) : null;
    const assemblyFee = ASSEMBLY_FEES[config.chassisType.toLowerCase()] || 50;

    const chassisPrice = chassis ? chassis.basePrice * (1 + MARKUPS.chassis) : 0;
    const cpuPrice = cpu ? cpu.basePrice * (1 + MARKUPS.cpu) : 0;
    const ramPrice = ram ? ram.basePrice * (1 + MARKUPS.ram) : 0;
    const gpuPrice = gpu ? gpu.basePrice * (1 + MARKUPS.gpu) : 0;

    return {
      chassisPrice: Math.round(chassisPrice * 100) / 100,
      cpuPrice: Math.round(cpuPrice * 100) / 100,
      ramPrice: Math.round(ramPrice * 100) / 100,
      storagePrice: Math.round(storagePrice * 100) / 100,
      gpuPrice: Math.round(gpuPrice * 100) / 100,
      casePrice: 0,
      accessoriesPrice: 0,
      assemblyFee,
      totalPrice: Math.round((chassisPrice + cpuPrice + ramPrice + storagePrice + gpuPrice + assemblyFee) * 100) / 100,
    };
  }

  calculateDetailedPrice(config: ConfigurationDto): DetailedPriceBreakdown {
    // Similar to calculatePrice but includes markup breakdown
    // Internal use only - never expose to customer
    const priceBreakdown = this.calculatePrice(config);
    // ... calculate detailed breakdown with markup percentages
    return { ...priceBreakdown, components: [], totalBasePrice: 0, totalMarkup: 0, profitMargin: 0 };
  }
}
```

---

## Gateway Integration (Existing Gateway)

### Controller (apps/gateway/src/controllers/hardware/chassis.controller.ts)

```typescript
import { Controller, Get, Param, Query, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ServiceTokens, HardwareCommands, ChassisType, ChassisUseCase } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { Public } from '../../decorators/public.decorator';

@ApiTags('hardware-chassis')
@Controller('hardware/chassis')
export class HardwareChassisController {
  constructor(
    @Inject(ServiceTokens.HARDWARE_SERVICE)
    private readonly hardwareClient: ClientProxy,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all chassis options' })
  @ApiQuery({ name: 'type', enum: ChassisType, required: false })
  @ApiQuery({ name: 'useCase', enum: ChassisUseCase, required: false })
  async findAll(
    @Query('type') type?: ChassisType,
    @Query('useCase') useCase?: ChassisUseCase,
  ) {
    return firstValueFrom(
      this.hardwareClient.send({ cmd: HardwareCommands.FIND_ALL_CHASSIS }, { type, useCase }),
    );
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get chassis by ID' })
  async findById(@Param('id') id: string) {
    return firstValueFrom(
      this.hardwareClient.send({ cmd: HardwareCommands.FIND_CHASSIS_BY_ID }, { id }),
    );
  }

  @Get(':id/compatible')
  @Public()
  @ApiOperation({ summary: 'Get compatible components' })
  async getCompatible(@Param('id') id: string) {
    return firstValueFrom(
      this.hardwareClient.send({ cmd: HardwareCommands.GET_COMPATIBLE_COMPONENTS }, { chassisId: id }),
    );
  }
}
```

### Pricing Controller

```typescript
// apps/gateway/src/controllers/hardware/pricing.controller.ts

import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ServiceTokens, HardwareCommands, ConfigurationDto } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { Public } from '../../decorators/public.decorator';

@ApiTags('hardware-pricing')
@Controller('hardware/pricing')
export class HardwarePricingController {
  constructor(
    @Inject(ServiceTokens.HARDWARE_SERVICE)
    private readonly hardwareClient: ClientProxy,
  ) {}

  @Post('calculate')
  @Public()
  @ApiOperation({ summary: 'Calculate price (customer-facing)' })
  async calculatePrice(@Body() dto: ConfigurationDto) {
    return firstValueFrom(
      this.hardwareClient.send({ cmd: HardwareCommands.CALCULATE_PRICE }, dto),
    );
  }
}
```

### Module Registration

```typescript
// In apps/gateway/src/app/app.module.ts

// Add to controllers array
HardwareChassisController,
HardwareComponentsController,
HardwareConfigController,
HardwareOrdersController,
HardwarePricingController,

// Add to providers array
{
  provide: ServiceTokens.HARDWARE_SERVICE,
  useFactory: (configService: ConfigService) => {
    const serviceConfig = configService.get<TcpServiceConfig>('services.hardware');
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

### Chassis Type Enum

```typescript
// libs/models/src/lib/libs/hardware/chassis-type.enum.ts

export enum ChassisType {
  XS = 'XS',  // Raspberry Pi 5 ONLY
  S = 'S',    // Mini PC
  M = 'M',    // Console size
  L = 'L',    // Full tower
}
```

### Chassis Use Case Enum

```typescript
// libs/models/src/lib/libs/hardware/chassis-usecase.enum.ts

export enum ChassisUseCase {
  CLOUD = 'cloud',
  NAS = 'nas',
  DEV = 'dev',
  HYBRID = 'hybrid',
  ENTERPRISE = 'enterprise',
}
```

### Chassis Model

```typescript
// libs/models/src/lib/libs/hardware/chassis.model.ts

export interface ChassisSpecifications {
  formFactor: string;
  maxPower: string;
  noiseLevel: string;
  dimensions: string;
}

export interface Chassis {
  id: string;
  type: ChassisType;
  useCase: ChassisUseCase;
  name: string;
  description: string;
  basePrice: number;
  specifications: ChassisSpecifications;
}
```

### Component Model

```typescript
// libs/models/src/lib/libs/hardware/component.model.ts

export interface Component {
  id: string;
  type: ComponentType;
  name: string;
  description: string;
  basePrice: number;
  sellingPrice: number;
  specs: Record<string, string | number>;
  compatibleWith: string[];
  inStock: boolean;
}
```

### Configuration DTO

```typescript
// libs/models/src/lib/libs/hardware/configuration.dto.ts

import { IsString, IsArray, IsOptional, IsEnum } from 'class-validator';
import { ChassisType } from './chassis-type.enum';
import { ChassisUseCase } from './chassis-usecase.enum';

export class ConfigurationDto {
  @IsString() chassisId: string;
  @IsEnum(ChassisType) chassisType: ChassisType;
  @IsEnum(ChassisUseCase) useCase: ChassisUseCase;
  @IsString() cpuId: string;
  @IsString() ramId: string;
  @IsArray() @IsString({ each: true }) storageIds: string[];
  @IsOptional() @IsString() gpuId?: string;
  @IsOptional() @IsString() caseId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) accessories?: string[];
}
```

### Order Model

```typescript
// libs/models/src/lib/libs/hardware/order.model.ts

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  ASSEMBLING = 'assembling',
  SHIPPING = 'shipping',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface Order {
  id: string;
  configuration: ConfigurationDto;
  priceBreakdown: PriceBreakdown;
  shippingAddress: ShippingAddress;
  customerEmail: string;
  status: OrderStatus;
  estimatedDelivery?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Constants (libs/constants)

### Hardware Commands

```typescript
// libs/constants/src/lib/libs/hardware/hardware-commands.ts

export const HardwareCommands = {
  FIND_ALL_CHASSIS: 'hardware.findAllChassis',
  FIND_CHASSIS_BY_ID: 'hardware.findChassisById',
  GET_COMPATIBLE_COMPONENTS: 'hardware.getCompatibleComponents',
  FIND_ALL_COMPONENTS: 'hardware.findAllComponents',
  FIND_COMPONENT_BY_ID: 'hardware.findComponentById',
  VALIDATE_CONFIG: 'hardware.validateConfig',
  CALCULATE_PRICE: 'hardware.calculatePrice',
  CALCULATE_DETAILED_PRICE: 'hardware.calculateDetailedPrice',
  CREATE_ORDER: 'hardware.createOrder',
  FIND_ALL_ORDERS: 'hardware.findAllOrders',
  FIND_ORDER_BY_ID: 'hardware.findOrderById',
  UPDATE_ORDER_STATUS: 'hardware.updateOrderStatus',
} as const;
```

### Service Token

```typescript
// Add to libs/constants/src/lib/libs/service.tokens.ts
HARDWARE_SERVICE: 'HARDWARE_SERVICE',
```

---

## Frontend (apps/hardware-configurator/)

### Setup (Nx Tooling)

```bash
nx generate @nx/angular:application hardware-configurator
```

### Routes

```typescript
// apps/hardware-configurator/src/app/app.routes.ts

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'configure/:chassisId',
    loadComponent: () =>
      import('./pages/configure/configure.component').then(m => m.ConfigureComponent),
  },
  {
    path: 'review',
    loadComponent: () =>
      import('./pages/review/review.component').then(m => m.ReviewComponent),
  },
  {
    path: 'checkout',
    loadComponent: () =>
      import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent),
  },
  {
    path: 'confirmation/:orderId',
    loadComponent: () =>
      import('./pages/confirmation/confirmation.component').then(m => m.ConfirmationComponent),
  },
];
```

### Services

#### Hardware Service

```typescript
// apps/hardware-configurator/src/app/services/hardware.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Chassis,
  Component,
  ConfigurationDto,
  PriceBreakdown,
  Order,
  CreateOrderDto,
} from '@optimistic-tanuki/models';

@Injectable({ providedIn: 'root' })
export class HardwareService {
  constructor(private http: HttpClient) {}

  getChassis(type?: string, useCase?: string): Observable<Chassis[]> {
    const params: any = {};
    if (type) params.type = type;
    if (useCase) params.useCase = useCase;
    return this.http.get<Chassis[]>('/api/hardware/chassis', { params });
  }

  getChassisById(id: string): Observable<Chassis> {
    return this.http.get<Chassis>(`/api/hardware/chassis/${id}`);
  }

  getCompatibleComponents(chassisId: string): Observable<{
    cpu: Component[];
    ram: Component[];
    storage: Component[];
    gpu: Component[];
  }> {
    return this.http.get<any>(`/api/hardware/chassis/${chassisId}/compatible`);
  }

  calculatePrice(config: ConfigurationDto): Observable<PriceBreakdown> {
    return this.http.post<PriceBreakdown>('/api/hardware/pricing/calculate', config);
  }

  createOrder(order: CreateOrderDto): Observable<Order> {
    return this.http.post<Order>('/api/hardware/orders', order);
  }

  getOrder(id: string): Observable<Order> {
    return this.http.get<Order>(`/api/hardware/orders/${id}`);
  }
}
```

### Components

#### Landing Component (Chassis Selection)

```typescript
// apps/hardware-configurator/src/app/pages/landing/landing.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HardwareService } from '../../services/hardware.service';
import { Chassis } from '@optimistic-tanuki/models';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="landing">
      <h1>Build Your Personal Cloud</h1>
      <p class="subtitle">Choose a chassis to get started</p>

      <div class="chassis-grid">
        @for (chassis of chassisOptions; track chassis.id) {
          <div class="chassis-card" (click)="selectChassis(chassis.id)">
            <div class="chassis-type">{{ chassis.type }}</div>
            <h3>{{ chassis.name }}</h3>
            <p>{{ chassis.description }}</p>
            <div class="price">Starting at \${{ chassis.basePrice | number }}</div>
            <div class="specs">
              <div><strong>Form:</strong> {{ chassis.specifications.formFactor }}</div>
              <div><strong>Power:</strong> {{ chassis.specifications.maxPower }}</div>
              <div><strong>Noise:</strong> {{ chassis.specifications.noiseLevel }}</div>
            </div>
            <button class="select-btn">Configure →</button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .landing { padding: 40px 20px; max-width: 1200px; margin: 0 auto; text-align: center; }
    h1 { color: #4ecdc4; margin-bottom: 10px; }
    .subtitle { color: #888; margin-bottom: 40px; }
    .chassis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .chassis-card {
      background: #1a1a1a; border: 1px solid #333; border-radius: 12px;
      padding: 20px; cursor: pointer; transition: all 0.2s; text-align: left;
    }
    .chassis-card:hover { border-color: #4ecdc4; transform: translateY(-2px); }
    .chassis-type {
      display: inline-block; background: #4ecdc4; color: #000;
      padding: 4px 8px; border-radius: 4px; font-size: 12px;
      font-weight: bold; margin-bottom: 10px;
    }
    .chassis-card h3 { color: #fff; margin: 0 0 10px; }
    .chassis-card p { color: #888; font-size: 14px; margin: 0 0 15px; }
    .price { color: #4ecdc4; font-size: 18px; font-weight: bold; margin-bottom: 15px; }
    .specs { font-size: 12px; color: #666; margin-bottom: 15px; }
    .specs div { margin: 4px 0; }
    .select-btn {
      width: 100%; background: transparent; color: #4ecdc4;
      border: 1px solid #4ecdc4; padding: 10px; border-radius: 6px;
      cursor: pointer; font-weight: bold;
    }
    .select-btn:hover { background: #4ecdc4; color: #000; }
  `],
})
export class LandingComponent implements OnInit {
  chassisOptions: Chassis[] = [];

  constructor(private hardwareService: HardwareService, private router: Router) {}

  ngOnInit() {
    this.hardwareService.getChassis().subscribe(chassis => {
      this.chassisOptions = chassis;
    });
  }

  selectChassis(chassisId: string) {
    this.router.navigate(['/configure', chassisId]);
  }
}
```

#### Configure Component (Component Selection)

```typescript
// apps/hardware-configurator/src/app/pages/configure/configure.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HardwareService } from '../../services/hardware.service';
import { Chassis, Component as HwComponent, ConfigurationDto, PriceBreakdown } from '@optimistic-tanuki/models';

@Component({
  selector: 'app-configure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="configure">
      <h2>Configure Your System</h2>
      <p class="chassis-name">{{ chassis?.name }}</p>

      @if (loading) {
        <div class="loading">Loading components...</div>
      } @else {
        <div class="config-grid">
          <!-- CPU Selection -->
          <div class="config-section">
            <h3>🧠 Processor (CPU)</h3>
            <div class="component-list">
              @for (cpu of components.cpu; track cpu.id) {
                <div
                  class="component-item"
                  [class.selected]="selectedCpu === cpu.id"
                  (click)="selectCpu(cpu.id)"
                >
                  <div class="component-name">{{ cpu.name }}</div>
                  <div class="component-desc">{{ cpu.description }}</div>
                  <div class="component-price">
                    {{ cpu.basePrice === 0 ? 'Included' : ('$' + (cpu.basePrice * 1.15 | number:'1.0-0')) }}
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- RAM Selection -->
          <div class="config-section">
            <h3>💾 Memory (RAM)</h3>
            <div class="component-list">
              @for (ram of components.ram; track ram.id) {
                <div
                  class="component-item"
                  [class.selected]="selectedRam === ram.id"
                  (click)="selectRam(ram.id)"
                >
                  <div class="component-name">{{ ram.name }}</div>
                  <div class="component-desc">{{ ram.description }}</div>
                  <div class="component-price">
                    {{ ram.basePrice === 0 ? 'Included' : ('$' + (ram.basePrice * 1.20 | number:'1.0-0')) }}
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Storage Selection -->
          <div class="config-section">
            <h3>💿 Storage</h3>
            <div class="component-list">
              @for (storage of components.storage; track storage.id) {
                <div
                  class="component-item"
                  [class.selected]="selectedStorage.includes(storage.id)"
                  (click)="toggleStorage(storage.id)"
                >
                  <div class="component-name">{{ storage.name }}</div>
                  <div class="component-desc">{{ storage.description }}</div>
                  <div class="component-price">
                    {{ storage.basePrice === 0 ? 'Included' : ('$' + (storage.basePrice * 1.25 | number:'1.0-0')) }}
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- GPU Selection -->
          <div class="config-section">
            <h3>🎮 Graphics (GPU)</h3>
            <div class="component-list">
              @for (gpu of components.gpu; track gpu.id) {
                <div
                  class="component-item"
                  [class.selected]="selectedGpu === gpu.id"
                  (click)="selectGpu(gpu.id)"
                >
                  <div class="component-name">{{ gpu.name }}</div>
                  <div class="component-desc">{{ gpu.description }}</div>
                  <div class="component-price">
                    {{ gpu.basePrice === 0 ? 'Included' : ('$' + (gpu.basePrice * 1.10 | number:'1.0-0')) }}
                  </div>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Price Summary -->
        <div class="price-summary">
          <h3>Configuration Summary</h3>
          @if (priceBreakdown) {
            <div class="price-row">
              <span>Chassis</span>
              <span>\${{ priceBreakdown.chassisPrice | number:'1.2-2' }}</span>
            </div>
            <div class="price-row">
              <span>CPU</span>
              <span>\${{ priceBreakdown.cpuPrice | number:'1.2-2' }}</span>
            </div>
            <div class="price-row">
              <span>RAM</span>
              <span>\${{ priceBreakdown.ramPrice | number:'1.2-2' }}</span>
            </div>
            <div class="price-row">
              <span>Storage</span>
              <span>\${{ priceBreakdown.storagePrice | number:'1.2-2' }}</span>
            </div>
            <div class="price-row">
              <span>GPU</span>
              <span>\${{ priceBreakdown.gpuPrice | number:'1.2-2' }}</span>
            </div>
            <div class="price-row">
              <span>Assembly</span>
              <span>\${{ priceBreakdown.assemblyFee | number:'1.2-2' }}</span>
            </div>
            <div class="price-row total">
              <span>Total</span>
              <span>\${{ priceBreakdown.totalPrice | number:'1.2-2' }}</span>
            </div>
          }
          <button
            class="review-btn"
            [disabled]="!canProceed"
            (click)="goToReview()"
          >
            Review Configuration →
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .configure { padding: 20px; max-width: 1000px; margin: 0 auto; }
    h2 { color: #4ecdc4; text-align: center; }
    .chassis-name { text-align: center; color: #888; margin-bottom: 30px; }
    .loading { text-align: center; color: #888; padding: 40px; }
    .config-grid { display: grid; gap: 20px; margin-bottom: 30px; }
    .config-section {
      background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 20px;
    }
    .config-section h3 { color: #4ecdc4; margin: 0 0 15px; font-size: 16px; }
    .component-list { display: grid; gap: 10px; }
    .component-item {
      background: #252525; border: 1px solid #444; border-radius: 8px;
      padding: 12px; cursor: pointer; transition: all 0.2s;
    }
    .component-item:hover { border-color: #4ecdc4; }
    .component-item.selected { border-color: #4ecdc4; background: #1a3a36; }
    .component-name { color: #fff; font-weight: bold; margin-bottom: 4px; }
    .component-desc { color: #888; font-size: 12px; margin-bottom: 4px; }
    .component-price { color: #4ecdc4; font-weight: bold; }
    .price-summary {
      background: #1a1a1a; border: 1px solid #4ecdc4; border-radius: 12px;
      padding: 20px; position: sticky; bottom: 20px;
    }
    .price-summary h3 { color: #4ecdc4; margin: 0 0 15px; }
    .price-row {
      display: flex; justify-content: space-between; padding: 8px 0;
      border-bottom: 1px solid #333; color: #ccc;
    }
    .price-row.total {
      border-bottom: none; font-weight: bold; font-size: 18px;
      color: #4ecdc4; padding-top: 15px;
    }
    .review-btn {
      width: 100%; background: #4ecdc4; color: #000; border: none;
      padding: 15px; border-radius: 8px; font-size: 16px; font-weight: bold;
      cursor: pointer; margin-top: 15px;
    }
    .review-btn:disabled { background: #333; color: #666; cursor: not-allowed; }
  `],
})
export class ConfigureComponent implements OnInit {
  chassisId = '';
  chassis: Chassis | null = null;
  components: { cpu: HwComponent[]; ram: HwComponent[]; storage: HwComponent[]; gpu: HwComponent[] } = {
    cpu: [], ram: [], storage: [], gpu: []
  };
  loading = true;
  selectedCpu = '';
  selectedRam = '';
  selectedStorage: string[] = [];
  selectedGpu = 'gpu-none';
  priceBreakdown: PriceBreakdown | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private hardwareService: HardwareService,
  ) {}

  ngOnInit() {
    this.chassisId = this.route.snapshot.params['chassisId'];
    this.hardwareService.getChassisById(this.chassisId).subscribe(chassis => {
      this.chassis = chassis;
    });
    this.hardwareService.getCompatibleComponents(this.chassisId).subscribe(components => {
      this.components = components;
      this.loading = false;
      if (components.cpu.length > 0) this.selectedCpu = components.cpu[0].id;
      if (components.ram.length > 0) this.selectedRam = components.ram[0].id;
      if (components.storage.length > 0) this.selectedStorage = [components.storage[0].id];
      this.updatePrice();
    });
  }

  selectCpu(id: string) { this.selectedCpu = id; this.updatePrice(); }
  selectRam(id: string) { this.selectedRam = id; this.updatePrice(); }
  toggleStorage(id: string) {
    const index = this.selectedStorage.indexOf(id);
    if (index > -1) this.selectedStorage.splice(index, 1);
    else this.selectedStorage.push(id);
    this.updatePrice();
  }
  selectGpu(id: string) { this.selectedGpu = id; this.updatePrice(); }

  updatePrice() {
    const config: ConfigurationDto = {
      chassisId: this.chassisId,
      chassisType: this.chassis?.type || 'XS' as any,
      useCase: this.chassis?.useCase || 'cloud' as any,
      cpuId: this.selectedCpu,
      ramId: this.selectedRam,
      storageIds: this.selectedStorage,
      gpuId: this.selectedGpu,
    };
    this.hardwareService.calculatePrice(config).subscribe(price => {
      this.priceBreakdown = price;
    });
  }

  get canProceed(): boolean {
    return this.selectedCpu !== '' && this.selectedRam !== '' && this.selectedStorage.length > 0;
  }

  goToReview() {
    const config = {
      chassisId: this.chassisId,
      cpuId: this.selectedCpu,
      ramId: this.selectedRam,
      storageIds: this.selectedStorage,
      gpuId: this.selectedGpu,
      priceBreakdown: this.priceBreakdown,
    };
    localStorage.setItem('hardwareConfig', JSON.stringify(config));
    this.router.navigate(['/review']);
  }
}
```

#### Review Component

```typescript
// apps/hardware-configurator/src/app/pages/review/review.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="review">
      <h2>Review Your Configuration</h2>

      @if (config) {
        <div class="review-grid">
          <div class="review-section">
            <h3>Configuration Details</h3>
            <div class="detail-row">
              <span class="label">Chassis:</span>
              <span>{{ config.chassisId }}</span>
            </div>
            <div class="detail-row">
              <span class="label">CPU:</span>
              <span>{{ config.cpuId }}</span>
            </div>
            <div class="detail-row">
              <span class="label">RAM:</span>
              <span>{{ config.ramId }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Storage:</span>
              <span>{{ config.storageIds.join(', ') }}</span>
            </div>
            <div class="detail-row">
              <span class="label">GPU:</span>
              <span>{{ config.gpuId || 'Integrated' }}</span>
            </div>
          </div>

          <div class="price-section">
            <h3>Price Breakdown</h3>
            @if (config.priceBreakdown) {
              <div class="price-row">
                <span>Chassis</span>
                <span>\${{ config.priceBreakdown.chassisPrice | number:'1.2-2' }}</span>
              </div>
              <div class="price-row">
                <span>CPU</span>
                <span>\${{ config.priceBreakdown.cpuPrice | number:'1.2-2' }}</span>
              </div>
              <div class="price-row">
                <span>RAM</span>
                <span>\${{ config.priceBreakdown.ramPrice | number:'1.2-2' }}</span>
              </div>
              <div class="price-row">
                <span>Storage</span>
                <span>\${{ config.priceBreakdown.storagePrice | number:'1.2-2' }}</span>
              </div>
              <div class="price-row">
                <span>GPU</span>
                <span>\${{ config.priceBreakdown.gpuPrice | number:'1.2-2' }}</span>
              </div>
              <div class="price-row total">
                <span>Total</span>
                <span>\${{ config.priceBreakdown.totalPrice | number:'1.2-2' }}</span>
              </div>
            }
          </div>
        </div>

        <div class="actions">
          <button class="back-btn" (click)="goBack()">← Edit Configuration</button>
          <button class="checkout-btn" (click)="goToCheckout()">Proceed to Checkout →</button>
        </div>
      } @else {
        <p class="no-config">No configuration found. Please start over.</p>
        <button (click)="goHome()">Start Over</button>
      }
    </div>
  `,
  styles: [`
    .review { padding: 20px; max-width: 800px; margin: 0 auto; }
    h2 { color: #4ecdc4; text-align: center; margin-bottom: 30px; }
    .review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .review-section, .price-section {
      background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 20px;
    }
    h3 { color: #4ecdc4; margin: 0 0 15px; font-size: 16px; }
    .detail-row, .price-row {
      display: flex; justify-content: space-between; padding: 8px 0;
      border-bottom: 1px solid #333; color: #ccc;
    }
    .detail-row:last-child, .price-row:last-child { border-bottom: none; }
    .label { color: #888; }
    .price-row.total {
      font-weight: bold; font-size: 18px; color: #4ecdc4;
      border-top: 2px solid #4ecdc4; margin-top: 10px; padding-top: 15px;
    }
    .actions { display: flex; gap: 15px; justify-content: center; }
    .back-btn {
      background: transparent; color: #888; border: 1px solid #888;
      padding: 12px 24px; border-radius: 8px; cursor: pointer;
    }
    .checkout-btn {
      background: #4ecdc4; color: #000; border: none; padding: 12px 24px;
      border-radius: 8px; font-weight: bold; cursor: pointer;
    }
    .no-config { color: #888; text-align: center; }
  `],
})
export class ReviewComponent implements OnInit {
  config: any = null;

  constructor(private router: Router) {}

  ngOnInit() {
    const stored = localStorage.getItem('hardwareConfig');
    if (stored) this.config = JSON.parse(stored);
  }

  goBack() {
    if (this.config) this.router.navigate(['/configure', this.config.chassisId]);
  }

  goToCheckout() {
    this.router.navigate(['/checkout']);
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
```

#### Checkout Component

```typescript
// apps/hardware-configurator/src/app/pages/checkout/checkout.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HardwareService } from '../../services/hardware.service';
import { CreateOrderDto } from '@optimistic-tanuki/models';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="checkout">
      <h2>Checkout</h2>

      @if (config) {
        <div class="checkout-grid">
          <div class="form-section">
            <h3>Shipping Information</h3>
            <form (ngSubmit)="submitOrder()">
              <div class="form-group">
                <label>Name</label>
                <input type="text" [(ngModel)]="shippingAddress.name" name="name" required>
              </div>
              <div class="form-group">
                <label>Street Address</label>
                <input type="text" [(ngModel)]="shippingAddress.street" name="street" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>City</label>
                  <input type="text" [(ngModel)]="shippingAddress.city" name="city" required>
                </div>
                <div class="form-group">
                  <label>State</label>
                  <input type="text" [(ngModel)]="shippingAddress.state" name="state" required>
                </div>
                <div class="form-group">
                  <label>ZIP</label>
                  <input type="text" [(ngModel)]="shippingAddress.zip" name="zip" required>
                </div>
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" [(ngModel)]="customerEmail" name="email" required>
              </div>

              <div class="order-summary">
                <h4>Order Summary</h4>
                <div class="summary-row">
                  <span>Configuration:</span>
                  <span>{{ config.chassisId }}</span>
                </div>
                <div class="summary-row total">
                  <span>Total:</span>
                  <span>\${{ config.priceBreakdown.totalPrice | number:'1.2-2' }}</span>
                </div>
              </div>

              <button type="submit" class="submit-btn" [disabled]="submitting">
                {{ submitting ? 'Processing...' : 'Place Order' }}
              </button>
            </form>
          </div>
        </div>
      } @else {
        <p class="no-config">No configuration found. Please start over.</p>
        <button (click)="goHome()">Start Over</button>
      }
    </div>
  `,
  styles: [`
    .checkout { padding: 20px; max-width: 600px; margin: 0 auto; }
    h2 { color: #4ecdc4; text-align: center; margin-bottom: 30px; }
    .form-section {
      background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 20px;
    }
    h3 { color: #4ecdc4; margin: 0 0 20px; }
    .form-group { margin-bottom: 15px; }
    label { display: block; color: #888; margin-bottom: 5px; font-size: 14px; }
    input, textarea {
      width: 100%; background: #252525; border: 1px solid #444; border-radius: 6px;
      padding: 10px; color: #fff; font-size: 14px;
    }
    input:focus, textarea:focus { border-color: #4ecdc4; outline: none; }
    .form-row { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; }
    .order-summary {
      background: #252525; border-radius: 8px; padding: 15px; margin: 20px 0;
    }
    h4 { color: #fff; margin: 0 0 10px; }
    .summary-row {
      display: flex; justify-content: space-between; padding: 8px 0;
      border-bottom: 1px solid #333; color: #ccc;
    }
    .summary-row:last-child { border-bottom: none; }
    .summary-row.total {
      font-weight: bold; font-size: 18px; color: #4ecdc4;
      border-top: 2px solid #4ecdc4; margin-top: 10px; padding-top: 15px;
    }
    .submit-btn {
      width: 100%; background: #4ecdc4; color: #000; border: none;
      padding: 15px; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;
    }
    .submit-btn:disabled { background: #333; color: #666; cursor: not-allowed; }
    .no-config { color: #888; text-align: center; }
  `],
})
export class CheckoutComponent implements OnInit {
  config: any = null;
  shippingAddress = { name: '', street: '', city: '', state: '', zip: '', country: 'US' };
  customerEmail = '';
  submitting = false;

  constructor(private router: Router, private hardwareService: HardwareService) {}

  ngOnInit() {
    const stored = localStorage.getItem('hardwareConfig');
    if (stored) this.config = JSON.parse(stored);
  }

  submitOrder() {
    if (!this.config) return;
    this.submitting = true;

    const order: CreateOrderDto = {
      configuration: {
        chassisId: this.config.chassisId,
        chassisType: this.config.chassisId.split('-')[0].toUpperCase() as any,
        useCase: this.config.chassisId.split('-')[1] as any,
        cpuId: this.config.cpuId,
        ramId: this.config.ramId,
        storageIds: this.config.storageIds,
        gpuId: this.config.gpuId,
      },
      shippingAddress: this.shippingAddress,
      customerEmail: this.customerEmail,
    };

    this.hardwareService.createOrder(order).subscribe({
      next: (result) => {
        localStorage.removeItem('hardwareConfig');
        this.router.navigate(['/confirmation', result.id]);
      },
      error: () => {
        this.submitting = false;
        alert('Failed to create order. Please try again.');
      },
    });
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
```

#### Confirmation Component

```typescript
// apps/hardware-configurator/src/app/pages/confirmation/confirmation.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HardwareService } from '../../services/hardware.service';
import { Order } from '@optimistic-tanuki/models';

@Component({
  selector: 'app-confirmation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirmation">
      @if (order) {
        <div class="success-icon">✓</div>
        <h2>Order Confirmed!</h2>
        <p class="order-id">Order ID: {{ order.id }}</p>

        <div class="details-card">
          <h3>Order Details</h3>
          <div class="detail-row">
            <span>Configuration:</span>
            <span>{{ order.configuration.chassisId }}</span>
          </div>
          <div class="detail-row">
            <span>Status:</span>
            <span class="status">{{ order.status }}</span>
          </div>
          <div class="detail-row">
            <span>Total:</span>
            <span class="total">\${{ order.priceBreakdown.totalPrice | number:'1.2-2' }}</span>
          </div>
          @if (order.estimatedDelivery) {
            <div class="detail-row">
              <span>Estimated Delivery:</span>
              <span>{{ order.estimatedDelivery | date:'mediumDate' }}</span>
            </div>
          }
        </div>

        <div class="next-steps">
          <h3>What Happens Next</h3>
          <ol>
            <li>You'll receive a confirmation email shortly</li>
            <li>We'll order the components for your build</li>
            <li>Assembly will begin once components arrive</li>
            <li>You'll receive shipping notification when ready</li>
          </ol>
        </div>

        <div class="actions">
          <button (click)="goHome()">Back to Home</button>
        </div>
      } @else if (loading) {
        <div class="loading">Loading order details...</div>
      } @else {
        <div class="error">
          <p>Order not found</p>
          <button (click)="goHome()">Back to Home</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .confirmation { padding: 40px 20px; max-width: 600px; margin: 0 auto; text-align: center; }
    .success-icon {
      width: 80px; height: 80px; background: #4ecdc4; color: #000;
      font-size: 40px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; margin: 0 auto 20px;
    }
    h2 { color: #4ecdc4; margin-bottom: 10px; }
    .order-id { color: #888; margin-bottom: 30px; }
    .details-card, .next-steps {
      background: #1a1a1a; border: 1px solid #333; border-radius: 12px;
      padding: 20px; margin-bottom: 20px; text-align: left;
    }
    h3 { color: #4ecdc4; margin: 0 0 15px; font-size: 16px; }
    .detail-row {
      display: flex; justify-content: space-between; padding: 8px 0;
      border-bottom: 1px solid #333; color: #ccc;
    }
    .detail-row:last-child { border-bottom: none; }
    .status { text-transform: capitalize; color: #f39c12; }
    .total { color: #4ecdc4; font-weight: bold; }
    .next-steps ol { color: #ccc; padding-left: 20px; }
    .next-steps li { margin: 10px 0; }
    .actions { display: flex; gap: 15px; justify-content: center; margin-top: 30px; }
    .actions button {
      background: #4ecdc4; color: #000; border: none; padding: 12px 24px;
      border-radius: 8px; font-weight: bold; cursor: pointer;
    }
    .loading, .error { color: #888; padding: 40px; }
  `],
})
export class ConfirmationComponent implements OnInit {
  order: Order | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private hardwareService: HardwareService,
  ) {}

  ngOnInit() {
    const orderId = this.route.snapshot.params['orderId'];
    this.hardwareService.getOrder(orderId).subscribe({
      next: (order) => {
        this.order = order;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
```

---

## File Checklist (Updated)

### Generated with Nx
- [ ] `apps/hardware-service/` — `nx generate @nx/node:application hardware-service`
- [ ] `apps/hardware-configurator/` — `nx generate @nx/angular:application hardware-configurator`
- [ ] `apps/hardware-service-e2e/` — `nx generate @nx/playwright:configuration`
- [ ] `apps/hardware-configurator-e2e/` — `nx generate @nx/playwright:configuration`

### Created Manually (Backend)
- [ ] `apps/hardware-service/src/controllers/` (all controllers)
- [ ] `apps/hardware-service/src/services/` (all services)
- [ ] `apps/hardware-service/src/data/` (catalogs)
- [ ] `apps/gateway/src/controllers/hardware/` (gateway controllers)

### Created Manually (Frontend)
- [ ] `apps/hardware-configurator/src/app/app.routes.ts`
- [ ] `apps/hardware-configurator/src/app/services/hardware.service.ts`
- [ ] `apps/hardware-configurator/src/app/pages/landing/landing.component.ts`
- [ ] `apps/hardware-configurator/src/app/pages/configure/configure.component.ts`
- [ ] `apps/hardware-configurator/src/app/pages/review/review.component.ts`
- [ ] `apps/hardware-configurator/src/app/pages/checkout/checkout.component.ts`
- [ ] `apps/hardware-configurator/src/app/pages/confirmation/confirmation.component.ts`

### Created Manually (Libs)
- [ ] `libs/models/src/lib/libs/hardware/` (all models + DTOs)
- [ ] `libs/constants/src/lib/libs/hardware/hardware-commands.ts`

### Modified
- [ ] `libs/models/src/index.ts`
- [ ] `libs/constants/src/index.ts`
- [ ] `libs/constants/src/lib/libs/service.tokens.ts`
- [ ] `apps/gateway/src/app/app.module.ts`
- [ ] `apps/gateway/src/config.ts`

---

## Permissions

```typescript
'hardware.chassis.read'
'hardware.components.read'
'hardware.config.validate'
'hardware.orders.create'
'hardware.orders.read'
'hardware.orders.update'
'hardware.pricing.internal'  // Admin-only
```

---

## File Checklist

### Generated with Nx
- [ ] `apps/hardware-service/` — `nx generate @nx/node:application hardware-service`
- [ ] `apps/hardware-configurator/` — `nx generate @nx/angular:application hardware-configurator`
- [ ] `apps/hardware-service-e2e/` — `nx generate @nx/playwright:configuration`
- [ ] `apps/hardware-configurator-e2e/` — `nx generate @nx/playwright:configuration`

### Created Manually (in generated structure)
- [ ] `apps/hardware-service/src/controllers/` (all controllers)
- [ ] `apps/hardware-service/src/services/` (all services)
- [ ] `apps/hardware-service/src/data/` (catalogs)
- [ ] `apps/gateway/src/controllers/hardware/` (gateway controllers)
- [ ] `libs/models/src/lib/libs/hardware/` (all models + DTOs)
- [ ] `libs/constants/src/lib/libs/hardware/hardware-commands.ts`

### Modified
- [ ] `libs/models/src/index.ts`
- [ ] `libs/constants/src/index.ts`
- [ ] `libs/constants/src/lib/libs/service.tokens.ts`
- [ ] `apps/gateway/src/app/app.module.ts`
- [ ] `apps/gateway/src/config.ts`

---

## Chassis Catalog (Static Data)

```typescript
// apps/hardware-service/src/data/chassis-catalog.ts

export const CHASSIS_CATALOG: Chassis[] = [
  {
    id: 'xs-cloud',
    type: ChassisType.XS,
    useCase: ChassisUseCase.CLOUD,
    name: 'XS Personal Cloud',
    description: 'Raspberry Pi 5 based personal cloud',
    basePrice: 299,
    specifications: {
      formFactor: 'Raspberry Pi 5',
      maxPower: '25W',
      noiseLevel: 'Silent',
      dimensions: '85mm x 56mm x 17mm',
    },
  },
  // ... more chassis
];
```

---

*Spec Version: 3.0 (Final)*  
*March 2026*
