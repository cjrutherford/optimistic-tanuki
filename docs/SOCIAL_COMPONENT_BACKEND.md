# Social Component Backend Implementation

## Overview

Complete backend infrastructure for persisting and retrieving component instances in social posts. Enables the ComponentInjection TipTap extension to save component data separately from post content, allowing proper reconstruction in viewers.

## Architecture

### Data Flow

```
Social Compose Editor
    ↓
ComponentInjection Extension (TipTap)
    ↓
getInjectedComponents() → ComponentData[]
    ↓
componentsChanged event emitted
    ↓
Parent Component saves post + components
    ↓
RPC call to Social Service
    ↓
SocialComponentController (MessagePattern)
    ↓
SocialComponentService (CRUD)
    ↓
SocialComponent Repository
    ↓
PostgreSQL (social_components table)
```

### Viewing Flow

```
Social Viewer loads post
    ↓
RPC call: FIND_SOCIAL_COMPONENTS_BY_POST
    ↓
SocialComponentService.findByPostId()
    ↓
Returns ComponentData[]
    ↓
Viewer matches instanceId in DOM
    ↓
Dynamically creates Angular components
    ↓
Replaces placeholders with real components
```

## Implementation Details

### 1. Entity

**File**: `apps/social/src/entities/social-component.entity.ts`

```typescript
@Entity('social_components')
@Index(['postId', 'instanceId'], { unique: true })
export class SocialComponent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  postId: string;

  @Column({ type: 'varchar', length: 255 })
  instanceId: string;

  @Column({ type: 'varchar', length: 100 })
  componentType: string;

  @Column('jsonb')
  componentData: Record<string, any>;

  @Column('integer')
  position: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Post, post => post.components, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;
}
```

**Key Features**:
- Unique constraint on (postId, instanceId)
- JSONB for flexible component data
- CASCADE delete with post
- Timestamp tracking

### 2. Service

**File**: `apps/social/src/app/services/social-component.service.ts`

#### Methods

##### create(dto: CreateSocialComponentDto)
Creates a new component instance.

**Validation**:
- Post must exist
- instanceId must be unique per post

**Returns**: `SocialComponentDto`

**Errors**:
- NotFoundException: Post not found
- BadRequestException: Duplicate instanceId
- RpcException: Database errors

##### findByPostId(postId: string)
Gets all components for a post, ordered by position.

**Returns**: `SocialComponentDto[]`

**Errors**:
- RpcException: Query errors

##### findOne(id: string)
Gets a single component by ID.

**Returns**: `SocialComponentDto`

**Errors**:
- NotFoundException: Component not found
- RpcException: Query errors

##### update(id: string, dto: UpdateSocialComponentDto)
Updates component data or position.

**Returns**: `SocialComponentDto`

**Errors**:
- NotFoundException: Component not found
- RpcException: Update errors

##### remove(id: string)
Deletes a component.

**Returns**: void

**Errors**:
- NotFoundException: Component not found
- RpcException: Delete errors

##### removeByPostId(postId: string)
Deletes all components for a post (bulk operation).

**Returns**: void

**Errors**:
- RpcException: Delete errors

##### findByQuery(query: SocialComponentQueryDto)
Flexible query by multiple criteria.

**Query Fields**:
- id
- postId
- instanceId
- componentType

**Returns**: `SocialComponentDto[]` (ordered by position)

**Errors**:
- RpcException: Query errors

### 3. Controller

**File**: `apps/social/src/app/app.controller.ts`

#### RPC Endpoints

| Command | Handler | Payload | Returns |
|---------|---------|---------|---------|
| `CREATE_SOCIAL_COMPONENT` | `createSocialComponent()` | `CreateSocialComponentDto` | `SocialComponentDto` |
| `FIND_SOCIAL_COMPONENT` | `findOneSocialComponent()` | `{ id: string }` | `SocialComponentDto` |
| `FIND_SOCIAL_COMPONENTS_BY_POST` | `getComponentsForPost()` | `{ postId: string }` | `SocialComponentDto[]` |
| `UPDATE_SOCIAL_COMPONENT` | `updateSocialComponent()` | `{ id, dto }` | `SocialComponentDto` |
| `DELETE_SOCIAL_COMPONENT` | `deleteSocialComponent()` | `{ id: string }` | `void` |
| `DELETE_SOCIAL_COMPONENTS_BY_POST` | `deleteComponentsByPost()` | `{ postId: string }` | `void` |
| `FIND_SOCIAL_COMPONENTS_BY_QUERY` | `findComponentsByQuery()` | `SocialComponentQueryDto` | `SocialComponentDto[]` |

#### Usage Example

```typescript
// From another service via RPC
const components = await this.socialClient.send(
  { cmd: SocialComponentCommands.FIND_BY_POST },
  { postId: 'abc-123' }
).toPromise();
```

### 4. DTOs

**Location**: `libs/models/src/lib/libs/social/social-component.ts`

#### CreateSocialComponentDto
```typescript
{
  postId: string;          // Required, UUID
  instanceId: string;      // Required, max 255 chars
  componentType: string;   // Required, max 100 chars
  componentData: Record;   // Required, any JSON object
  position: number;        // Required, >= 0
}
```

#### UpdateSocialComponentDto
```typescript
{
  componentData?: Record;  // Optional
  position?: number;       // Optional, >= 0
}
```

#### SocialComponentQueryDto
```typescript
{
  id?: string;            // Optional
  postId?: string;        // Optional
  instanceId?: string;    // Optional
  componentType?: string; // Optional
}
```

#### SocialComponentDto
```typescript
{
  id: string;
  postId: string;
  instanceId: string;
  componentType: string;
  componentData: Record;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### 5. Migration

**File**: `apps/social/migrations/1770000000000-create-social-components-table.ts`

#### Up Migration
```sql
CREATE TABLE "social_components" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "postId" uuid NOT NULL,
  "instanceId" character varying(255) NOT NULL,
  "componentType" character varying(100) NOT NULL,
  "componentData" jsonb NOT NULL,
  "position" integer NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_social_components_id" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IDX_social_components_post_instance" 
ON "social_components" ("postId", "instanceId");

ALTER TABLE "social_components" 
ADD CONSTRAINT "FK_social_components_postId" 
FOREIGN KEY ("postId") REFERENCES "post"("id") 
ON DELETE CASCADE ON UPDATE NO ACTION;
```

#### Down Migration
```sql
ALTER TABLE "social_components" 
DROP CONSTRAINT "FK_social_components_postId";

DROP INDEX "IDX_social_components_post_instance";

DROP TABLE "social_components";
```

## Database Schema

### Table: social_components

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated |
| postId | UUID | NOT NULL, FK | Reference to post |
| instanceId | VARCHAR(255) | NOT NULL, UNIQUE per post | DOM element ID |
| componentType | VARCHAR(100) | NOT NULL | Component identifier |
| componentData | JSONB | NOT NULL | Component properties |
| position | INTEGER | NOT NULL | Order in post |
| createdAt | TIMESTAMP | NOT NULL | Auto-generated |
| updatedAt | TIMESTAMP | NOT NULL | Auto-updated |

### Indexes

- **Primary Key**: id
- **Unique Index**: (postId, instanceId)
- **Foreign Key**: postId → post(id) CASCADE DELETE

### Relationships

```
Post (1) ──< (many) SocialComponent
```

When a Post is deleted, all its SocialComponents are automatically deleted (CASCADE).

## Integration Guide

### Frontend: Social Compose

#### 1. Add ComponentInjection Extension

```typescript
import { ComponentInjection } from '@optimistic-tanuki/compose-lib';

// In component
editor = new Editor({
  extensions: [
    // ... other extensions
    ComponentInjection.configure({
      onComponentsChanged: (components) => {
        this.injectedComponents = components;
      }
    })
  ]
});
```

#### 2. Emit Components on Save

```typescript
@Output() componentsChanged = new EventEmitter<InjectedComponentData[]>();

onSavePost() {
  const components = this.editor.commands.getInjectedComponents();
  const content = this.editor.getHTML();
  
  this.postSubmitted.emit({
    title: this.title,
    content: content,
    components: components  // NEW
  });
}
```

#### 3. Parent Component Saves

```typescript
async onPostSubmitted(data) {
  // Save post
  const post = await this.postService.create({
    title: data.title,
    content: data.content,
    // ... other fields
  });

  // Save components
  for (const component of data.components) {
    await this.socialComponentService.create({
      postId: post.id,
      instanceId: component.instanceId,
      componentType: component.componentType,
      componentData: component.componentData,
      position: component.position || 0
    });
  }
}
```

### Frontend: Social Viewer

#### 1. Load Components

```typescript
async ngOnInit() {
  // Load post
  this.post = await this.postService.findOne(this.postId);
  
  // Load components
  this.components = await this.socialComponentService.findByPostId(this.postId);
  
  // Reconstruct after view init
}
```

#### 2. Reconstruct Components

```typescript
ngAfterViewInit() {
  this.reconstructComponents();
}

private reconstructComponents() {
  // Find placeholder elements
  const placeholders = this.contentElement.nativeElement
    .querySelectorAll('[data-injected-component]');

  placeholders.forEach((placeholder: HTMLElement) => {
    const instanceId = placeholder.getAttribute('data-instance-id');
    
    // Find matching component data
    const componentData = this.components.find(
      c => c.instanceId === instanceId
    );

    if (componentData) {
      // Create component dynamically
      const ComponentClass = COMPONENT_MAP[componentData.componentType];
      const componentRef = this.viewContainerRef.createComponent(ComponentClass);
      
      // Set inputs
      Object.keys(componentData.componentData).forEach(key => {
        componentRef.instance[key] = componentData.componentData[key];
      });
      
      // Replace placeholder
      placeholder.innerHTML = '';
      placeholder.appendChild(componentRef.location.nativeElement);
    }
  });
}
```

## Testing

### Unit Tests

#### Service Tests

```typescript
describe('SocialComponentService', () => {
  it('should create component', async () => {
    const dto = {
      postId: 'post-123',
      instanceId: 'btn-456',
      componentType: 'button',
      componentData: { text: 'Click' },
      position: 0
    };
    
    const result = await service.create(dto);
    expect(result.id).toBeDefined();
    expect(result.instanceId).toBe('btn-456');
  });

  it('should prevent duplicate instanceId', async () => {
    // Create first
    await service.create(dto);
    
    // Try duplicate
    await expect(service.create(dto))
      .rejects.toThrow(BadRequestException);
  });

  it('should find by post id', async () => {
    const results = await service.findByPostId('post-123');
    expect(results).toBeInstanceOf(Array);
    expect(results[0].position).toBeLessThanOrEqual(results[1].position);
  });
});
```

#### Controller Tests

```typescript
describe('AppController', () => {
  it('should handle CREATE_SOCIAL_COMPONENT', async () => {
    const result = await controller.createSocialComponent(createDto);
    expect(result.id).toBeDefined();
  });

  it('should handle FIND_BY_POST', async () => {
    const results = await controller.getComponentsForPost('post-123');
    expect(results).toBeInstanceOf(Array);
  });
});
```

### Integration Tests

#### Database Tests

```typescript
describe('SocialComponent Integration', () => {
  it('should cascade delete components with post', async () => {
    // Create post with components
    const post = await createPost();
    await createComponent({ postId: post.id });
    
    // Delete post
    await deletePost(post.id);
    
    // Verify components deleted
    const components = await findByPostId(post.id);
    expect(components).toHaveLength(0);
  });

  it('should enforce unique constraint', async () => {
    const dto = {
      postId: 'post-123',
      instanceId: 'duplicate',
      // ...
    };
    
    await create(dto);
    await expect(create(dto)).rejects.toThrow();
  });
});
```

### E2E Tests

```typescript
describe('Social Component E2E', () => {
  it('should complete full workflow', async () => {
    // 1. Create post with components
    const post = await createPost();
    const component = await createComponent({ postId: post.id });
    
    // 2. Retrieve components
    const components = await findByPostId(post.id);
    expect(components).toHaveLength(1);
    
    // 3. Update component
    await updateComponent(component.id, { position: 5 });
    
    // 4. Verify update
    const updated = await findOne(component.id);
    expect(updated.position).toBe(5);
    
    // 5. Delete component
    await deleteComponent(component.id);
    
    // 6. Verify deletion
    const remaining = await findByPostId(post.id);
    expect(remaining).toHaveLength(0);
  });
});
```

## Deployment

### Migration

```bash
# Development
pnpm run migration:run -- -c social

# Production
# Include in deployment pipeline
# Run before app starts
```

### Verification

```sql
-- Check table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'social_components';

-- Check constraints
SELECT * FROM information_schema.table_constraints
WHERE table_name = 'social_components';

-- Check indexes
SELECT * FROM pg_indexes
WHERE tablename = 'social_components';
```

## Performance Considerations

### Indexes

- (postId, instanceId) UNIQUE index for fast lookups
- position used in ORDER BY - consider index if many components per post

### JSONB

- Supports GIN indexes for fast JSON queries
- Consider adding if querying componentData frequently:

```sql
CREATE INDEX idx_component_data ON social_components USING GIN (componentData);
```

### Queries

All service methods are optimized:
- Single queries (no N+1)
- Proper ordering (database-side)
- Index usage on foreign keys

## Security

### Validation

- DTOs use class-validator decorators
- Post existence checked before component creation
- Duplicate prevention via unique constraint

### Access Control

- RPC endpoints require authentication (via gateway)
- Row-level security can be added if needed

### Data Sanitization

- JSONB prevents SQL injection
- Component data validated before storage
- No eval() or dangerous operations

## Troubleshooting

### Common Issues

#### "Post not found"
```typescript
// Ensure post exists before creating component
const post = await postService.findOne(postId);
if (!post) throw new NotFoundException();
```

#### "Duplicate instanceId"
```typescript
// Use unique instanceIds per post
const instanceId = `${componentType}-${Date.now()}-${Math.random()}`;
```

#### "Components not loading in viewer"
```typescript
// Check RPC connection
await this.client.send(cmd, payload).toPromise();

// Verify instanceId matches DOM
console.log('DOM instanceId:', element.getAttribute('data-instance-id'));
console.log('Component instanceId:', component.instanceId);
```

## Next Steps

1. **Update Social Compose**
   - Integrate ComponentInjection extension
   - Emit componentsChanged event
   - Save components on post submit

2. **Update Social Viewer**
   - Load components via RPC
   - Reconstruct components dynamically
   - Handle component lifecycle

3. **Testing**
   - Write unit tests
   - Run integration tests
   - Perform E2E testing

4. **Documentation**
   - Update API docs
   - Add usage examples
   - Document best practices

## References

- BlogComponent implementation (apps/blogging)
- ComponentInjection extension (libs/compose-lib)
- DTOs (libs/models)
- Commands (libs/constants)
