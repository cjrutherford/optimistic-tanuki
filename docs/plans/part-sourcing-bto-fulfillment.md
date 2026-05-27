# Part Sourcing and BTO Fulfillment Plan

## Objective

Complete order fulfillment pipeline for the system-configurator application, integrating part sourcing (multi-supplier aggregation) with build-to-order (BTO) manufacturing and delivery, enabling consistent supply chain and seamless customer experience from configuration to delivery.

---

## Overview

### Problem Statement

The system-configurator needs to:

1. Source parts from multiple suppliers (PCPartPicker, Newegg, Amazon, distributor APIs)
2. Aggregate pricing and availability across sources
3. Generate quotes with live pricing
4. Track orders through build lifecycle
5. Manage fulfillment (in-house or outsourced assembly)
6. Provide customer visibility

### Solution

Integrated pipeline:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Part Sourcing           Order Lifecycle           Fulfillment      │
│  ─────────────          ───────────────          ───────────      │
│                                                                 │
│  ┌───────────┐        ┌───────────┐        ┌───────────┐       │
│  │ Supplier  │        │   Quote   │        │   Parts   │       │
│  │ Adapters  │──────▶ │  Request  │──────▶ │  Reserve │       │
│  └───────────┘        └───────────┘        └───────────┘       │
│        │                    │                    │             │
│        ▼                    ▼                    ▼             │
│  ┌───────────┐        ┌───────────┐        ┌───────────┐       │
│  │  Price   │        │   Quote   │        │    PO    │       │
│  │ Aggregation│     │  Generated│──────▶ │ Submission│       │
│  └───────────┘        └───────────┘        └───────────┘       │
│        │                    │                    │             │
│        ▼                    ▼                    ▼             │
│  ┌───────────┐        ┌───────────┐        ┌───────────┐       │
│  │  Stock   │        │  Order   │        │  Build   │       │
│  │  Monitor │──────▶ │ Confirmed│──────▶ │ Assembly │       │
│  └───────────┘        └───────────┘        └───────────┘       │
│                                              │             │
│                                              ▼             │
│                                    ┌───────────┐       │
│                                    │    QC    │───────▶ Ship
│                                    └───────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/system-configurator-api                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Part Sourcing Layer                                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  │
│  │  │ PCPartPicker│  │   Newegg   │  │  Amazon   │    │  │
│  │  │  Adapter   │  │  Adapter   │  │  Adapter  │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │  │
│  │        │              │              │                │    │
│  │        └────────────┬┴────────────┘                │    │
│  │                     ▼                               │    │
│  │            ┌───────────────┐                      │    │
│  │            │  Normalizer │                      │    │
│  │            └───────────────┘                      │    │
│  └─────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Aggregation Layer                                      │  │
│  │  ┌───────────────┐  ┌───────────────┐                  │    │
│  │  │ PartAggSvc   │  │ PriceSvc    │                  │    │
│  │  └───────────────┘  └───────────────┘                  │    │
│  └─────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Order Management Layer                                 │  │
│  │  ┌───────────────┐  ┌───────────────┐                  │    │
│  │  │  BtoOrder   │  │ BtoPricing   │                  │    │
│  │  │   Service   │  │   Service    │                  │    │
│  │  └───────────────┘  └───────────────┘                  │    │
│  │        │                │                              │    │
│  │        └──────────────┴────────────────────         │    │
│  │                     ▼                               │    │
│  │            ┌───────────────┐                      │    │
│  │            │ BtoFulfill  │                      │    │
│  │            │   Service   │                      │    │
│  │            └───────────────┘                      │    │
│  └─────────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Supplier Sources

### Source Overview

Multi-source aggregation for all part types. Each source type determines sync methodology.

| Source Type | Description | Rate Limit | Auth Required |
|------------|-------------|-----------|--------------|
| scrape     | HTML scraping via fetch | 10 req/min | No |
| api        | REST API integration | Varies | API key |
| dropship   | Direct fulfillment partner | Varies | Account |

### Enumerated Sources

#### Primary Component Sources

| Source ID | Name | Type | Categories | Base URL |
|----------|------|------|------------|----------|
| pcpartpicker | PCPartPicker | scrape | cpu, ram, storage, gpu, motherboard, psu, cooling | https://pcpartpicker.com |
| newegg | Newegg | scrape | cpu, ram, storage, gpu, motherboard, psu, cooling | https://newegg.com |
| amazon | Amazon | scrape | cpu, ram, storage, gpu, peripherals, cables | https://amazon.com |
| bhphotovideo | B&H Photo | scrape | cpu, ram, storage, gpu, peripherals | https://bhphotovideo.com |
| bestbuy | Best Buy | scrape | cpu, ram, storage, gpu, peripherals | https://bestbuy.com |

#### Specialized Sources

| Source ID | Name | Type | Categories | Base URL |
|----------|------|------|------|------------|----------|
| octopart | Octopart | api | cpu, ram, storage, gpu, motherboard, psu, cooling | https://octopart.com |
| digikey | DigiKey | api | cpu, ram, storage, psu, cooling, cables | https://digikey.com |
| mouser | Mouser | api | cpu, ram, storage, gpu, motherboard, psu, cooling | https://mouser.com |

#### 3D Printed Case Sources

| Source ID | Name | Type | Categories | Base URL |
|----------|------|------|------------|----------|
| thingiverse | Thingiverse | scrape | case (printable) | https://thingiverse.com |
| printables | Printables | scrape | case (printable) | https://printables.com |
| cults3d | Cults3D | scrape | case (printable) | https://cults3d.com |
| instructables | Instructables | scrape | case (printable), peripherals | https://instructables.com |
| makerworld | MakerWorld | scrape | case (printable) | https://makerworld.com |

#### Single-Board Computer Sources

| Source ID | Name | Type | Categories | Base URL |
|----------|------|------|------------|----------|
| raspberrypi | Raspberry Pi | scrape | cpu (arm), case | https://raspberrypi.com |
| argon40 | Argon40 | scrape | case | https://argon40.com |
| pimoroni | Pimoroni | scrape | cpu (arm), case | https://pimoroni.com |
| thepihut | The Pi Hut | scrape | cpu (arm), case, peripherals | https://thepihut.com |

#### Peripherals and Networking Sources

| Source ID | Name | Type | Categories | Base URL |
|----------|------|------|------------|----------|
| newassoc | New Association | scrape | peripherals | https://newassoc.com |
| startech | StarTech | scrape | networking, cables | https://startech.com |
| cables | Cables | scrape | cables | https://cables.com |

---

## Part Categories

### System Configurator Categories

| Category    | Description                        | Primary Sources               | 3D/SBC Sources |
| ----------- | ---------------------------------- | ----------------------------| ----------------|
| cpu         | Processors (ARM, x86)              | pcpartpicker, newegg, amazon  | raspberrypi, pimoroni |
| ram         | Memory (SODIMM, DIMM)              | pcpartpicker, newegg, digikey | raspberrypi |
| storage     | NVMe, SATA, USB                    | pcpartpicker, newegg, bhphoto  | raspberrypi |
| gpu         | Discrete accelerators              | pcpartpicker, newegg, bestbuy | - |
| motherboard | Mainboards (Mini-ITX, ATX)         | pcpartpicker, newegg, mouser | pimoroni |
| case        | Enclosures (commercial)            | pcpartpicker, newegg, bhphoto | argon40, pimoroni |
| case-3d     | Enclosures (printable)            | thingiverse, printables, cults3d | makerworld |
| psu         | Power supply units                 | pcpartpicker, newegg, digikey | - |
| cooling     | Air and liquid cooling             | pcpartpicker, newegg, mouser | - |
| cables      | Data and power cables            | startech, cables, digikey | - |
| peripherals | KB, mouse, monitor               | amazon, bestbuy, newassoc | argon40, pimoroni |
| networking  | NICs, switches                   | startech, bhphoto | - |
| os          | Operating system profiles         | Direct integration          | - |

### Chassis Tiers

| Tier | Size    | Form Factor                      | Use Cases       |
| ---- | ------- | -------------------------------- | --------------- |
| XS   | Compact | Raspberry Pi 5 or Comparable SBC | cloud, dev, nas |
| S    | Small   | Mini PC / NUC                    | cloud, nas      |
| M    | Medium  | Console / Slim                   | cloud, nas      |
| L    | Large   | Full Tower                       | cloud, nas      |

---

## Types and Schemas

### Supplier Source Entity

```typescript
// File: apps/system-configurator-api/src/hardware/entities/supplier-source.entity.ts

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('sc_supplier_sources')
export class SupplierSourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  sourceId!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  sourceType!: 'scrape' | 'api' | 'dropship';

  @Column({ type: 'varchar', length: 255 })
  baseUrl!: string;

  @Column({ type: 'text', nullable: true })
  apiKey!: string | null;

  @Column({ type: 'jsonb', default: {} })
  headers!: Record<string, string>;

  @Column({ type: 'int', default: 10 })
  rateLimit!: number;

  @Column({ type: 'int', default: 60 })
  rateLimitInterval!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'idle' })
  syncStatus!: 'idle' | 'syncing' | 'error';

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

### Hardware Part Entity

```typescript
// File: apps/system-configurator-api/src/hardware/entities/hardware-part.entity.ts

import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PartCategory = 'cpu' | 'ram' | 'storage' | 'gpu' | 'motherboard' | 'case' | 'psu' | 'cooling' | 'cables' | 'peripherals' | 'networking' | 'os';

@Entity('sc_hardware_parts')
@Index(['category', 'isActive'])
@Index(['slug'], { unique: true })
export class HardwarePartEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  slug!: string;

  @Column({
    type: 'varchar',
    length: 16,
    enum: ['cpu', 'ram', 'storage', 'gpu', 'motherboard', 'case', 'psu', 'cooling', 'cables', 'peripherals', 'networking', 'os'],
  })
  category!: PartCategory;

  @Column({ type: 'varchar', length: 64, nullable: true })
  vendor!: string | null;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'int', default: 0 })
  basePrice!: number;

  @Column({ type: 'int', default: 0 })
  sellingPrice!: number;

  @Column({ type: 'jsonb', default: {} })
  specs!: Record<string, string | number | boolean>;

  @Column({ type: 'jsonb', default: [] })
  compatibleChassisSlugs!: string[];

  @Column({ type: 'jsonb', default: [] })
  compatibleTiers!: ('XS' | 'S' | 'M' | 'L')[];

  @Column({ type: 'boolean', default: true })
  inStock!: boolean;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', nullable: true })
  lowestPrice!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lowestPriceSupplier!: string | null;

  @Column({ type: 'int', nullable: true })
  averagePrice!: number | null;

  @Column({ type: 'varchar', length: 32, default: 'curated' })
  sourceType!: 'curated' | 'scraped' | 'api' | 'dropship';

  @Column({ type: 'varchar', length: 64, nullable: true })
  externalSource!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalId!: string | null;

  @Column({ type: 'text', nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'seeded' })
  syncStatus!: 'seeded' | 'synced' | 'syncing' | 'error';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

### Supplier Part Entity

```typescript
// File: apps/system-configurator-api/src/hardware/entities/supplier-part.entity.ts

import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { SupplierSourceEntity } from './supplier-source.entity';
import { HardwarePartEntity } from './hardware-part.entity';

@Entity('sc_supplier_parts')
@Index(['supplierId', 'externalId'])
@Index(['partId', 'lastCheckedAt'])
export class SupplierPartEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  supplierId!: string;

  @ManyToOne(() => SupplierSourceEntity)
  @JoinColumn({ name: 'supplierId' })
  supplier!: SupplierSourceEntity;

  @Column({ type: 'uuid' })
  partId!: string;

  @ManyToOne(() => HardwarePartEntity)
  @JoinColumn({ name: 'partId' })
  part!: HardwarePartEntity;

  @Column({ type: 'varchar', length: 255 })
  externalId!: string;

  @Column({ type: 'text', nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'int' })
  price!: number;

  @Column({ type: 'int', nullable: true })
  originalPrice!: number | null;

  @Column({ type: 'varchar', length: 32, default: 'unknown' })
  stockStatus!: 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder' | 'unknown';

  @Column({ type: 'int', nullable: true })
  quantity!: number | null;

  @Column({ type: 'timestamp', nullable: true })
  lastCheckedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

### BTO Order Entity

```typescript
// File: apps/system-configurator-api/src/hardware/entities/bto-order.entity.ts

import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BtoOrderLineItem } from './bto-order-line.entity';
import { BtoAssemblyRecord } from './bto-assembly.entity';
import { BtoShippingRecord } from './bto-shipping.entity';

export type BtoOrderStatus = 'QUOTE_REQUESTED' | 'QUOTED' | 'ORDER_CONFIRMED' | 'PARTS_RESERVED' | 'PARTS_ORDERED' | 'BUILDING' | 'QC' | 'READY_TO_SHIP' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

@Entity('sc_bto_orders')
@Index(['customerId', 'status'])
@Index(['orderNumber'], { unique: true })
export class BtoOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  orderNumber!: string;

  @Column({ type: 'varchar', length: 64 })
  customerId!: string;

  @Column({ type: 'varchar', length: 255 })
  customerEmail!: string;

  @Column({
    type: 'varchar',
    length: 32,
    enum: ['QUOTE_REQUESTED', 'QUOTED', 'ORDER_CONFIRMED', 'PARTS_RESERVED', 'PARTS_ORDERED', 'BUILDING', 'QC', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    default: 'QUOTE_REQUESTED',
  })
  status!: BtoOrderStatus;

  @Column({
    type: 'varchar',
    length: 8,
    enum: ['XS', 'S', 'M', 'L'],
  })
  chassisTier!: 'XS' | 'S' | 'M' | 'L';

  @Column({ type: 'varchar', length: 64 })
  chassisSlug!: string;

  @Column({ type: 'varchar', length: 32 })
  useCase!: string;

  @Column({ type: 'varchar', length: 255 })
  label!: string;

  @Column({ type: 'text', nullable: true })
  customerNotes!: string | null;

  @Column({ type: 'text', nullable: true })
  internalNotes!: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    enum: ['in_house', 'outsourced'],
    default: 'in_house',
  })
  assemblyMode!: 'in_house' | 'outsourced';

  @Column({ type: 'varchar', length: 64, nullable: true })
  assemblerId!: string | null;

  @Column({ type: 'int', default: 0 })
  totalPrice!: number;

  @Column({ type: 'int', default: 0 })
  partsCost!: number;

  @Column({ type: 'int', default: 0 })
  assemblyCost!: number;

  @Column({ type: 'int', default: 0 })
  shippingCost!: number;

  @Column({ type: 'int', default: 14 })
  estimatedBuildDays!: number;

  @Column({ type: 'timestamp', nullable: true })
  estimatedDelivery!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  quoteExpiresAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  quotedPrice!: number | null;

  @OneToMany(() => BtoOrderLineItem, (item) => item.order)
  lineItems!: BtoOrderLineItem[];

  @OneToMany(() => BtoAssemblyRecord, (record) => record.order)
  assemblyRecords!: BtoAssemblyRecord[];

  @OneToMany(() => BtoShippingRecord, (record) => record.order)
  shippingRecords!: BtoShippingRecord[];

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  startedBuildingAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedBuildingAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

### BTO Order Line Item Entity

```typescript
// File: apps/system-configurator-api/src/hardware/entities/bto-order-line.entity.ts

import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { BtoOrderEntity } from './bto-order.entity';
import { HardwarePartEntity } from './hardware-part.entity';

export type LineItemStatus = 'pending' | 'reserved' | 'ordered' | 'received' | 'installed' | 'substituted' | 'skipped';

@Entity('sc_bto_order_lines')
@Index(['orderId', 'status'])
export class BtoOrderLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => BtoOrderEntity, (order) => order.lineItems)
  @JoinColumn({ name: 'orderId' })
  order!: BtoOrderEntity;

  @Column({ type: 'uuid' })
  partId!: string;

  @ManyToOne(() => HardwarePartEntity)
  @JoinColumn({ name: 'partId' })
  part!: HardwarePartEntity;

  @Column({ type: 'varchar', length: 16 })
  category!: string;

  @Column({ type: 'varchar', length: 255 })
  partName!: string;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ type: 'int', default: 0 })
  unitPrice!: number;

  @Column({ type: 'int', default: 0 })
  lineTotal!: number;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'pending',
  })
  status!: LineItemStatus;

  @Column({ type: 'uuid', nullable: true })
  preferredSupplierId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  actualSupplierId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  supplierPartId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  supplierOrderId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  supplierEtd!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  receivedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  substitutedPartId!: string | null;

  @Column({ type: 'int', nullable: true })
  actualCost!: number | null;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

### BTO Assembly Record Entity

```typescript
// File: apps/system-configurator-api/src/hardware/entities/bto-assembly.entity.ts

import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { BtoOrderEntity } from './bto-order.entity';

export type AssemblyStage = 'prebuild' | 'assembly' | 'cabling' | 'bios' | 'storage' | 'os' | 'testing' | 'packaging';

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

@Entity('sc_bto_assembly_records')
@Index(['orderId', 'stage'])
export class BtoAssemblyRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => BtoOrderEntity, (order) => order.assemblyRecords)
  @JoinColumn({ name: 'orderId' })
  order!: BtoOrderEntity;

  @Column({
    type: 'varchar',
    length: 32,
    enum: ['prebuild', 'assembly', 'cabling', 'bios', 'storage', 'os', 'testing', 'packaging'],
  })
  stage!: AssemblyStage;

  @Column({ type: 'int' })
  stepNumber!: number;

  @Column({
    type: 'varchar',
    length: 16,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped'],
  })
  status!: StageStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  assigneeId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  externalAssemblerId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  checklistResults!: Record<string, boolean> | null;

  @Column({ type: 'jsonb', default: [] })
  photos!: string[];

  @Column({ type: 'int', nullable: true })
  timeSpentMinutes!: number | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

### BTO Shipping Record Entity

```typescript
// File: apps/system-configurator-api/src/hardware/entities/bto-shipping.entity.ts

import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { BtoOrderEntity } from './bto-order.entity';

export type ShippingStatus = 'label_created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned';

export interface ShippingAddress {
  name: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

@Entity('sc_bto_shipping_records')
@Index(['orderId'])
export class BtoShippingRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => BtoOrderEntity, (order) => order.shippingRecords)
  @JoinColumn({ name: 'orderId' })
  order!: BtoOrderEntity;

  @Column({ type: 'varchar', length: 64 })
  carrier!: string;

  @Column({ type: 'varchar', length: 128 })
  trackingNumber!: string;

  @Column({ type: 'text', nullable: true })
  trackingUrl!: string | null;

  @Column({ type: 'jsonb' })
  address!: ShippingAddress;

  @Column({
    type: 'varchar',
    length: 32,
    enum: ['label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'returned'],
    default: 'label_created',
  })
  status!: ShippingStatus;

  @Column({ type: 'int', nullable: true })
  weightGrams!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  dimensions!: { l: number; w: number; h: number } | null;

  @Column({ type: 'int', default: 0 })
  shippingCost!: number;

  @Column({ type: 'int', default: 0 })
  insuranceCost!: number;

  @Column({ type: 'boolean', default: false })
  signatureRequired!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  estimatedDelivery!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  proofOfDelivery!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  receivedBy!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

---

## Services

### Supplier Adapter Interface

```typescript
// File: apps/system-configurator-api/src/hardware/adapters/base.adapter.ts

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder';

export type PartCategory = 'cpu' | 'ram' | 'storage' | 'gpu' | 'motherboard' | 'case' | 'psu' | 'cooling';

export interface SupplierProduct {
  externalId: string;
  name: string;
  price: number;
  originalPrice?: number;
  sourceUrl: string;
  vendor?: string;
  stockStatus?: StockStatus;
  specs?: Record<string, string>;
  imageUrl?: string;
}

export interface SupplierStock {
  externalId: string;
  price: number;
  originalPrice?: number;
  stockStatus: StockStatus;
  quantity?: number;
  lastCheckedAt: Date;
}

export interface SupplierAdapter {
  readonly sourceId: string;
  readonly name: string;

  fetchProducts(category: PartCategory): Promise<SupplierProduct[]>;
  fetchProduct(externalId: string): Promise<SupplierProduct | null>;
  checkStock(externalId: string): Promise<SupplierStock>;
}
```

### PCPartPicker Adapter

```typescript
// File: apps/system-configurator-api/src/hardware/adapters/pcpartpicker.adapter.ts

import { Injectable } from '@nestjs/common';
import { SupplierAdapter, SupplierProduct, SupplierStock, PartCategory, StockStatus } from './base.adapter';

@Injectable()
export class PcPartPickerAdapter implements SupplierAdapter {
  readonly sourceId = 'pcpartpicker';
  readonly name = 'PCPartPicker';

  private readonly baseUrl = 'https://pcpartpicker.com';
  private readonly categoryPaths: Record<string, string> = {
    cpu: '/products/cpu/',
    ram: '/products/memory/',
    storage: '/products/internal-hard-drive/',
    gpu: '/products/video-card/',
  };

  private readonly headers = {
    'user-agent': 'Mozilla/5.0 (compatible; HAI-Bot/1.0)',
    accept: 'text/html,application/xhtml+xml',
  };

  async fetchProducts(category: PartCategory): Promise<SupplierProduct[]> {
    const path = this.categoryPaths[category];
    if (!path) return [];

    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: this.headers,
    });

    if (!response.ok) return [];

    const html = await response.text();
    return this.parseProducts(html);
  }

  async fetchProduct(externalId: string): Promise<SupplierProduct | null> {
    const url = `${this.baseUrl}/product/${externalId}`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) return null;

    const html = await response.text();
    return this.parseProductDetail(html, externalId);
  }

  async checkStock(externalId: string): Promise<SupplierStock> {
    const product = await this.fetchProduct(externalId);
    return {
      externalId,
      price: product?.price ?? 0,
      originalPrice: product?.originalPrice,
      stockStatus: product?.stockStatus ?? 'unknown',
      lastCheckedAt: new Date(),
    };
  }

  private parseProducts(html: string): SupplierProduct[] {
    const products: SupplierProduct[] = [];
    const regex = /href="(\/product\/([^"]+))"[^>]*>([^<]{4,200})<\/a>/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null) {
      const sourceUrl = `${this.baseUrl}${match[1]}`;
      const externalId = match[2];
      const name = match[3]?.replace(/\s+/g, ' ').trim();

      const snippet = html.slice(Math.max(0, match.index - 100), match.index + 400);
      const priceMatch = snippet.match(/\$([0-9,]+(?:\.[0-9]{2})?)/);
      const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) * 100 : 0;

      if (name.length > 4 && price > 0) {
        products.push({
          externalId,
          name,
          price,
          sourceUrl,
          vendor: name.split(' ')[0],
        });
      }
    }

    return products.slice(0, 50);
  }

  private parseProductDetail(html: string, externalId: string): SupplierProduct | null {
    const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const priceMatch = html.match(/\$([0-9,]+(?:\.[0-9]{2})?)/);

    return {
      externalId,
      name: nameMatch?.[1]?.trim() ?? externalId,
      price: priceMatch ? Number(priceMatch[1].replace(/,/g, '')) * 100 : 0,
      sourceUrl: `${this.baseUrl}/product/${externalId}`,
      stockStatus: 'unknown',
    };
  }
}
```

### Part Aggregation Service

```typescript
// File: apps/system-configurator-api/src/hardware/services/part-aggregation.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HardwarePartEntity, PartCategory } from '../entities/hardware-part.entity';
import { SupplierPartEntity } from '../entities/supplier-part.entity';
import { SupplierAdapter, SupplierProduct } from '../adapters/base.adapter';

@Injectable()
export class PartAggregationService {
  constructor(
    @InjectRepository(HardwarePartEntity)
    private readonly partRepo: Repository<HardwarePartEntity>,
    @InjectRepository(SupplierPartEntity)
    private readonly supplierPartRepo: Repository<SupplierPartEntity>,
    private readonly adapters: SupplierAdapter[]
  ) {}

  async syncParts(category: PartCategory): Promise<SyncResult> {
    const results = { synced: 0, failed: 0, errors: [] as string[] };

    for (const adapter of this.adapters) {
      try {
        const products = await adapter.fetchProducts(category);
        for (const product of products) {
          await this.upsertPart(product, adapter.sourceId, category);
          results.synced++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${adapter.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return results;
  }

  async getLowestPrice(partId: string): Promise<PriceResult | null> {
    const supplierParts = await this.supplierPartRepo.find({
      where: { partId },
      order: { price: 'ASC' },
      take: 1,
    });

    if (!supplierParts.length) return null;

    return {
      price: supplierParts[0].price,
      supplierId: supplierParts[0].supplierId,
      sourceUrl: supplierParts[0].sourceUrl,
      inStock: supplierParts[0].stockStatus !== 'out_of_stock',
    };
  }

  async getAveragePrice(partId: string): Promise<number | null> {
    const result = await this.supplierPartRepo.createQueryBuilder('sp').select('AVG(sp.price)', 'avg').where('sp.partId = :partId', { partId }).getRawOne();

    return result?.avg ? Math.round(result.avg) : null;
  }

  private async upsertPart(product: SupplierProduct, sourceId: string, category: PartCategory): Promise<void> {
    const slug = this.generateSlug(product.name);

    let part = await this.partRepo.findOne({ where: { slug } });

    if (!part) {
      part = this.partRepo.create({
        slug,
        category,
        name: product.name,
        vendor: product.vendor,
        basePrice: product.price,
        sellingPrice: product.price,
        specs: product.specs ?? {},
        sourceType: 'scraped',
        externalSource: sourceId,
        externalId: product.externalId,
        sourceUrl: product.sourceUrl,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
      });
    } else {
      part.lastSyncedAt = new Date();
      part.syncStatus = 'synced';
    }

    await this.partRepo.save(part);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 64);
  }
}

interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

interface PriceResult {
  price: number;
  supplierId: string;
  sourceUrl: string | null;
  inStock: boolean;
}
```

### BTO Order Service

```typescript
// File: apps/system-configurator-api/src/hardware/services/bto-order.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BtoOrderEntity, BtoOrderStatus } from '../entities/bto-order.entity';
import { BtoOrderLineItem } from '../entities/bto-order-line.entity';
import { HardwarePartEntity } from '../entities/hardware-part.entity';
import { PartAggregationService } from './part-aggregation.service';

@Injectable()
export class BtoOrderService {
  constructor(
    @InjectRepository(BtoOrderEntity)
    private readonly orderRepo: Repository<BtoOrderEntity>,
    @InjectRepository(BtoOrderLineItem)
    private readonly lineItemRepo: Repository<BtoOrderLineItem>,
    @InjectRepository(HardwarePartEntity)
    private readonly partRepo: Repository<HardwarePartEntity>,
    private readonly parts: PartAggregationService
  ) {}

  async createOrder(config: BtoConfiguration): Promise<BtoOrderEntity> {
    const order = this.orderRepo.create({
      orderNumber: this.generateOrderNumber(),
      customerId: 'anonymous',
      customerEmail: '',
      status: 'QUOTE_REQUESTED',
      chassisTier: config.tier,
      chassisSlug: config.chassisSlug,
      useCase: config.useCase,
      label: config.label,
      customerNotes: config.notes,
    });

    const saved = await this.orderRepo.save(order);

    for (const selection of config.parts) {
      const part = await this.partRepo.findOne({
        where: { slug: selection.partSlug },
      });

      if (part) {
        const lowest = await this.parts.getLowestPrice(part.id);
        const lineItem = this.lineItemRepo.create({
          orderId: saved.id,
          partId: part.id,
          category: part.category,
          partName: part.name,
          quantity: selection.quantity ?? 1,
          unitPrice: lowest?.price ?? part.sellingPrice,
          lineTotal: (lowest?.price ?? part.sellingPrice) * (selection.quantity ?? 1),
          status: 'pending',
          preferredSupplierId: lowest?.supplierId ?? null,
        });
        await this.lineItemRepo.save(lineItem);
      }
    }

    return this.orderRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['lineItems'],
    });
  }

  async generateQuote(orderId: string): Promise<BtoPriceBreakdown> {
    const order = await this.orderRepo.findOneOrFail({
      where: { id: orderId },
      relations: ['lineItems'],
    });

    const partsCost = order.lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const assemblyCost = this.calculateAssemblyCost(order.chassisTier);
    const subtotal = partsCost + assemblyCost;
    const margin = Math.round(subtotal * 0.15);
    const total = subtotal + margin;

    order.partsCost = partsCost;
    order.assemblyCost = assemblyCost;
    order.totalPrice = total + order.shippingCost;
    order.quotedPrice = total;
    order.quoteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    order.status = 'QUOTED';
    await this.orderRepo.save(order);

    return {
      chassisCost: 0,
      partsCost,
      assemblyCost,
      margin,
      subtotal,
      shippingEstimate: 0,
      total,
      currency: 'USD',
      validUntil: order.quoteExpiresAt?.toISOString(),
    };
  }

  async confirmOrder(orderId: string, customerEmail: string): Promise<BtoOrderEntity> {
    const order = await this.orderRepo.findOneOrFail({
      where: { id: orderId },
      relations: ['lineItems'],
    });

    order.customerEmail = customerEmail;
    order.status = 'PARTS_RESERVED';
    order.confirmedAt = new Date();
    order.estimatedDelivery = this.calculateDeliveryDate(order);
    await this.orderRepo.save(order);

    return order;
  }

  async transitionStatus(orderId: string, newStatus: BtoOrderStatus): Promise<BtoOrderEntity> {
    const order = await this.orderRepo.findOneOrFail({ where: { id: orderId } });

    this.validateTransition(order.status, newStatus);

    order.status = newStatus;
    this.setTimestamps(order, newStatus);
    await this.orderRepo.save(order);

    return order;
  }

  private generateOrderNumber(): string {
    const prefix = 'BTO';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  private validateTransition(from: BtoOrderStatus, to: BtoOrderStatus): void {
    const valid: Record<BtoOrderStatus, BtoOrderStatus[]> = {
      QUOTE_REQUESTED: ['QUOTED', 'CANCELLED'],
      QUOTED: ['ORDER_CONFIRMED', 'CANCELLED'],
      ORDER_CONFIRMED: ['PARTS_RESERVED', 'CANCELLED'],
      PARTS_RESERVED: ['PARTS_ORDERED', 'CANCELLED'],
      PARTS_ORDERED: ['BUILDING', 'CANCELLED'],
      BUILDING: ['QC', 'CANCELLED'],
      QC: ['READY_TO_SHIP'],
      READY_TO_SHIP: ['SHIPPED'],
      SHIPPED: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    };

    if (!valid[from].includes(to)) {
      throw new Error(`Invalid transition: ${from} -> ${to}`);
    }
  }

  private setTimestamps(order: BtoOrderEntity, status: BtoOrderStatus): void {
    switch (status) {
      case 'ORDER_CONFIRMED':
        order.confirmedAt = new Date();
        break;
      case 'BUILDING':
        order.startedBuildingAt = new Date();
        break;
      case 'BUILDING':
        order.completedBuildingAt = new Date();
        break;
      case 'DELIVERED':
        order.deliveredAt = new Date();
        break;
    }
  }

  private calculateAssemblyCost(tier: 'XS' | 'S' | 'M' | 'L'): number {
    const costs = { XS: 2500, S: 5000, M: 10000, L: 15000 };
    return costs[tier];
  }

  private calculateDeliveryDate(order: BtoOrderEntity): Date {
    const date = new Date();
    date.setDate(date.getDate() + order.estimatedBuildDays);
    return date;
  }
}

interface BtoConfiguration {
  tier: 'XS' | 'S' | 'M' | 'L';
  chassisSlug: string;
  useCase: string;
  label: string;
  parts: { partSlug: string; quantity?: number }[];
  notes?: string;
}

interface BtoPriceBreakdown {
  chassisCost: number;
  partsCost: number;
  assemblyCost: number;
  margin: number;
  subtotal: number;
  shippingEstimate: number;
  total: number;
  currency: string;
  validUntil?: string;
}
```

---

## API Endpoints

### Parts API

#### GET /api/parts

List parts with filtering.

**Query Parameters:**

- `category` - Filter by category
- `tier` - Filter by compatible tier
- `minPrice` / `maxPrice` - Price range (cents)
- `inStock` - Only in-stock parts
- `page` / `limit` - Pagination

**Response:**

```typescript
{
  success: true,
  data: {
    items: HardwarePartEntity[],
    pagination: { page, limit, total, totalPages }
  }
}
```

#### GET /api/parts/:slug

Get part with supplier options.

**Response:**

```typescript
{
  success: true,
  data: {
    part: HardwarePartEntity,
    suppliers: SupplierPartEntity[],
    lowestPrice: { price, supplier, url, inStock },
    averagePrice: number
  }
}
```

#### POST /api/parts/sync

Trigger part sync.

**Request:**

```typescript
{ category?: PartCategory, force?: boolean }
```

---

### BTO Orders API

#### POST /api/bto/orders

Create new BTO order with quote.

**Request:**

```typescript
{
  config: {
    tier: 'M',
    chassisSlug: 'm-cloud',
    useCase: 'cloud',
    label: 'Development Workstation',
    parts: [
      { partSlug: 'm-cpu-ryzen-7700', quantity: 1 },
      { partSlug: 'm-ram-64-ddr5', quantity: 1 },
    ]
  }
}
```

**Response:**

```typescript
{
  success: true,
  data: {
    orderId: string,
    orderNumber: 'BTO-ABCD1234-EFGH',
    quote: BtoPriceBreakdown,
    validUntil: '2026-04-28T00:00:00.000Z'
  }
}
```

#### GET /api/bto/orders/:orderId

Get order details.

**Response:**

```typescript
{
  success: true,
  data: {
    order: BtoOrderEntity,
    lineItems: BtoOrderLineItem[],
    assembly: BtoAssemblyRecord[],
    shipping: BtoShippingRecord[]
  }
}
```

#### POST /api/bto/orders/:orderId/confirm

Confirm order (captures payment).

**Request:**

```typescript
{
  customerEmail: string,
  shippingAddress: ShippingAddress,
  paymentMethod: string,
  paymentToken: string
}
```

#### GET /api/bto/orders/:orderId/status

Get customer-visible status.

**Response:**

```typescript
{
  success: true,
  data: {
    orderNumber: string,
    status: BtoOrderStatus,
    statusLabel: string,
    estimatedDelivery: string,
    timeline: { status, timestamp, description }[]
  }
}
```

#### POST /api/bto/orders/:orderId/transition

Internal: transition order status.

**Request:**

```typescript
{ status: BtoOrderStatus, notes?: string }
```

---

## File Structure

```
apps/system-configurator-api/src/
├── hardware/
│   ├── entities/
│   │   ├── supplier-source.entity.ts
│   │   ├── hardware-part.entity.ts
│   │   ├── supplier-part.entity.ts
│   │   ├── chassis.entity.ts
│   │   ├── case-option.entity.ts
│   │   ├── bto-order.entity.ts
│   │   ├── bto-order-line.entity.ts
│   │   ├── bto-assembly.entity.ts
│   │   └── bto-shipping.entity.ts
│   ├── adapters/
│   │   ├── base.adapter.ts
│   │   └── pcpartpicker.adapter.ts
│   ├── services/
│   │   ├── part-aggregation.service.ts
│   │   ├── part-sync.service.ts
│   │   ├── bto-order.service.ts
│   │   ├── bto-pricing.service.ts
│   │   └── bto-shipping.service.ts
│   ├── controllers/
│   │   ├── parts.controller.ts
│   │   ├── suppliers.controller.ts
│   │   ├── bto-orders.controller.ts
│   │   └── bto-tracking.controller.ts
│   └── types/
│       ├── bto-configuration.types.ts
│       └── bto-qc-checklist.ts
```

---

## Order State Machine

```
QUOTE_REQUESTED
      │
      ▼
    QUOTED ◀──────────────────────────────┐
      │                                  │
      ▼                                  │
ORDER_CONFIRMED                           │
      │                                  │
      ▼                                  │
 PARTS_RESERVED                          │
      │                                  │
      ▼                                  │
 PARTS_ORDERED ──── (submit POs) ────────┤
      │                                  │
      ▼                                  │
   BUILDING ◀────────────────────────────┤
      │                                  │
      ▼                                  │
      QC ────────────────────────────────►│
      │                                  │
      ▼                                  │
 READY_TO_SHIP                           │
      │                                  │
      ▼                                  │
    SHIPPED                              │
      │                                  │
      ▼                                  │
   DELIVERED
```

**Transitions:**

- Any state → CANCELLED (before PARTS_ORDERED)
- BUILDING ↔ QC (rework loop)

---

## QC Checklist

```typescript
interface QcChecklist {
  post: { cpuRecognized: boolean; ramDetected: boolean; storageVisible: boolean };
  performance: { benchmarkScore: number; minScore: number; passed: boolean };
  thermal: { maxTempCpu: number; maxTempGpu: number; underThrottle: boolean };
  network: { speed: number; latency: number };
  storage: { readSpeed: number; writeSpeed: number; passed: boolean };
  visual: { noDamage: boolean; cablesNeat: boolean; fansSpinning: boolean };
}
```

---

## Implementation Phases

### Phase 1: Part Sourcing Foundation

- [ ] Create supplier entities
- [ ] Implement adapter interface
- [ ] Add PCPartPicker adapter
- [ ] Create aggregation service
- [ ] Add parts API endpoints

### Phase 2: Part Catalog Expansion

- [ ] Add motherboard, PSU, cooling scraping
- [ ] Add Newegg adapter
- [ ] Implement stock monitoring
- [ ] Create price alerts

### Phase 3: BTO Order Management

- [ ] Create BTO order entities
- [ ] Implement order service
- [ ] Add order API endpoints
- [ ] Create quote generation

### Phase 4: Fulfillment Pipeline

- [ ] Add line item tracking
- [ ] Implement parts reservation
- [ ] Add PO submission service
- [ ] Create assembly tracking

### Phase 5: Shipping and QC

- [ ] Add shipping records
- [ ] Implement label generation
- [ ] Create QC checklist
- [ ] Add tracking webhooks

### Phase 6: Customer Portal

- [ ] Add status endpoint
- [ ] Create timeline view
- [ ] Add notifications
- [ ] Create tracking widget

---

## Testing Strategy

1. **Unit tests**: Services, adapters
2. **Integration tests**: API endpoints
3. **E2E tests**: Complete order flow
4. **Load tests**: Concurrent syncs/orders
