# Client-Interface Social Network Enhancement Plan

This document outlines detailed implementation plans for transforming `@apps/client-interface/` into a first-class, polished social network. It includes all 10 original development goals plus the additional requirements for unified error handling and chat UI migration.

## General organizational notes:

1. each data domain has specific context throughout the entire stack meaning that for each layer in the stack, there are specific implementation details which are:

   - UI (usually an angular app)
   - UI-service (in the containing UI app)
   - UI-models (ui-models library)
   - backend DTO's (models library)
   - Gateway Controller (gateway app)
   - Microservice commands (constants library)
   - Microservice controller (specific app)
   - Microservice service (in specific app)
   - Database entites (in specific app)

2. always write unit tests to account for changes.
3. New components related to a paradigm (specific use-case) should be created in a collective ui-library (ending with -ui and using the angular:library generator)
4. New components should implement the theme and personality implementations from the theme-lib library.
5. when importing scss from other projects in the workspace, use `@optimistic-tanuki/<library>/<path>/<to>/<file>` with the `stylePreprocessorOptions.includePaths` key is set for the project being imported. Otherwise, write specific mixings and DO NOT cross project import SCSS.

---

## Table of Contents

1. [Remove Angular Material & Adopt Custom Design System](#1-remove-angular-material--adopt-custom-design-system)
2. [Notifications System](#2-notifications-system)
3. [Search & Discovery](#3-search--discovery)
4. [Direct Messaging Enhancements](#4-direct-messaging-enhancements)
5. [User Privacy & Safety](#5-user-privacy--safety)
6. [User Activity & History](#6-user-activity--history)
7. [Profile Enhancements](#7-profile-enhancements)
8. [Content Features](#8-content-features)
9. [UI/UX Polish](#9-uiux-polish)
10. [Performance Optimization](#10-performance-optimization)
11. [Accessibility Improvements](#11-accessibility-improvements)
12. [Unified Error Handling with Message Pattern](#12-unified-error-handling-with-message-pattern)
13. [Chat UI Migration to @libs/chat-ui](#13-chat-ui-migration-to-libschat-ui)

---

## 1. Remove Angular Material & Adopt Custom Design System

### Overview

This section outlines the complete removal of Angular Material (`@angular/material`) from the `@apps/client-interface/` application and its replacement with the project's custom design system provided through `@libs/theme-lib/` and `@libs/theme-ui/` libraries.

### Why Remove Angular Material?

1. **Inconsistent Design** - Angular Material components have their own visual identity that doesn't match the app's custom theming
2. **Bundle Size** - Removing Angular Material significantly reduces the application bundle size
3. **Custom Theming** - The custom design system allows full control over colors, typography, and spacing
4. **Maintenance** - Reduces dependency on two theming systems

### Available Design System Components

The project already has a comprehensive design system in place:

#### From `@libs/common-ui`:

- **ButtonComponent** - Primary, secondary, outlined, text variants
- **CardComponent** - Content cards with variants
- **SpinnerComponent** - Loading indicators
- **GridComponent** - Responsive grid layouts
- **TableComponent** - Data tables with sorting/pagination
- **TileComponent** - Grid tiles
- **PaginationComponent** - Pagination controls
- **AccordionComponent** - Collapsible panels
- **ListComponent** - List views
- **HeadingComponent** - Typography headings
- **ModalComponent** - Modal dialogs
- **NotificationComponent** - Toast notifications
- **GlassContainerComponent** - Glassmorphism containers
- **HeroSectionComponent** - Hero sections
- **ContentSectionComponent** - Content sections

#### From `@libs/theme-lib`:

- **ThemeService** - Runtime theme management
- **ThemeColors** - Color token types
- **ThemeGradients** - Gradient definitions

#### From `@libs/theme-ui`:

- **ThemeDesignerComponent** - Theme customization UI
- **PaletteSelectorComponent** - Color palette selection
- **PersonalitySelectorComponent** - Theme personality selection
- **PaletteManagerComponent** - Palette management

### Migration Steps

#### Step 1: Remove Angular Material Dependencies ✅ COMPLETED

**File: `apps/client-interface/project.json`**

Remove Angular Material from build options:

```json
{
  "build": {
    "options": {
      "styles": [
        "apps/client-interface/src/styles.scss"
        // REMOVED: "@angular/material/prebuilt-themes/azure-blue.css"
      ]
    }
  }
}
```

**File: `apps/client-interface/src/styles.scss`**

> No changes needed - file was already clean (no Angular Material imports)

**File: `package.json`**

> Removed `@angular/material` from dependencies

#### Step 2: Update Module Imports

Replace Angular Material module imports with workspace design system components:

| Angular Material           | Replace With                                              |
| -------------------------- | --------------------------------------------------------- |
| `MatButtonModule`          | `ButtonComponent` from `@optimistic-tanuki/common-ui`     |
| `MatIconModule`            | Use inline SVG icons or create IconComponent              |
| `MatInputModule`           | `TextInputComponent` from `@optimistic-tanuki/form-ui`    |
| `MatCardModule`            | `CardComponent` from `@optimistic-tanuki/common-ui`       |
| `MatDialogModule`          | `ModalComponent` from `@optimistic-tanuki/common-ui`      |
| `MatMenuModule`            | `DropdownComponent` from `@optimistic-tanuki/common-ui`   |
| `MatTabsModule`            | `TabsComponent` from `@optimistic-tanuki/common-ui`       |
| `MatBadgeModule`           | `BadgeComponent` from `@optimistic-tanuki/common-ui`      |
| `MatChipsModule`           | Create `ChipComponent` (or use BadgeComponent)            |
| `MatProgressSpinnerModule` | `SpinnerComponent` from `@optimistic-tanuki/common-ui`    |
| `MatRadioModule`           | `RadioButtonComponent` from `@optimistic-tanuki/form-ui`  |
| `MatCheckboxModule`        | `CheckboxComponent` from `@optimistic-tanuki/form-ui`     |
| `MatListModule`            | `ListComponent` from `@optimistic-tanuki/common-ui`       |
| `MatFormFieldModule`       | Use `TextInputComponent` + custom wrapper                 |
| `MatDatepickerModule`      | Create `DatePickerComponent`                              |
| `MatSelectModule`          | `SelectComponent` from `@optimistic-tanuki/form-ui`       |
| `MatTooltipModule`         | Create `TooltipDirective`                                 |
| `MatSnackBarModule`        | Use `MessageService` from `@optimistic-tanuki/message-ui` |
| `MatSidenavModule`         | Create `SideNavComponent`                                 |
| `MatToolbarModule`         | Create `ToolbarComponent`                                 |
| `MatExpansionModule`       | `AccordionComponent` from `@optimistic-tanuki/common-ui`  |
| `MatTableModule`           | `TableComponent` from `@optimistic-tanuki/common-ui`      |
| `MatPaginatorModule`       | `PaginationComponent` from `@optimistic-tanuki/common-ui` |
| `MatTextarea`              | `TextAreaComponent` from `@optimistic-tanuki/form-ui`     |
| `MatImageUpload`           | `ImageUploadComponent` from `@optimistic-tanuki/form-ui`  |

#### Step 3: Use Existing Workspace Components

The following components already exist in the workspace:

**From `@optimistic-tanuki/form-ui`:**

- `TextInputComponent` - Text input field
- `TextAreaComponent` - Text area input
- `CheckboxComponent` - Checkbox input
- `RadioButtonComponent` - Radio button/radio group
- `SelectComponent` - Select dropdown
- `ImageUploadComponent` - Image upload with preview

**From `@optimistic-tanuki/common-ui`:**

- `ButtonComponent` - Primary, secondary, outlined, text variants
- `CardComponent` - Content cards
- `SpinnerComponent` - Loading indicators
- `GridComponent` - Responsive grid layouts
- `TableComponent` - Data tables with sorting/pagination
- `TileComponent` - Grid tiles
- `PaginationComponent` - Pagination controls
- `AccordionComponent` - Collapsible panels
- `ListComponent` - List views
- `HeadingComponent` - Typography headings
- `ModalComponent` - Modal dialogs
- `NotificationComponent` - Toast notifications
- `GlassContainerComponent` - Glassmorphism containers
- `HeroSectionComponent` - Hero sections
- `ContentSectionComponent` - Content sections
- `BadgeComponent` - Badge/counter display
- `TabsComponent` - Tab navigation
- `DropdownComponent` - Dropdown menus

**From `@optimistic-tanuki/theme-lib`:**

- `ThemeService` - Runtime theme management
- `ThemeColors` - Color token types
- `ThemeGradients` - Gradient definitions

**From `@optimistic-tanuki/theme-ui`:**

- `ThemeDesignerComponent` - Theme customization UI
- `PaletteSelectorComponent` - Color palette selection
- `PersonalitySelectorComponent` - Theme personality selection

#### Step 4: Create Missing Design System Components

Components that need to be created (not available in workspace):

**File: `libs/common-ui/src/lib/common-ui/icon/icon.component.ts`**

```typescript
import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type IconName = 'search' | 'home' | 'settings' | 'person' | 'notifications' | 'favorite' | 'chat' | 'share' | 'edit' | 'delete' | 'visibility' | 'verified' | 'location' | 'work' | 'email' | 'phone' | 'calendar' | 'image' | 'video' | 'link' | 'tag' | 'bookmark' | 'flag' | 'check' | 'close' | 'menu' | 'more-vertical' | 'arrow-back' | 'arrow-forward' | 'arrow-drop-down' | 'add' | 'remove' | 'filter' | 'sort' | 'refresh' | 'upload' | 'download' | 'copy' | 'cut';

@Component({
  selector: 'otui-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg [attr.viewBox]="'0 0 24 24'" [attr.fill]="fill()" [attr.stroke]="stroke()" [attr.stroke-width]="strokeWidth()" class="icon">
      <ng-container [ngSwitch]="name()">
        <ng-container *ngSwitchCase="'search'">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </ng-container>
        <ng-container *ngSwitchCase="'home'">
          <path d="m3 9 9-5 12 5 12 5 12"></path>
          <polyline points="9 22 9 12 20 12 20 15 3 15 3 9"></polyline>
        </ng-container>
        <!-- Add more icons as needed -->
        <ng-container *ngSwitchDefault>
          <circle cx="12" cy="12" r="10"></circle>
        </ng-container>
      </ng-container>
    </svg>
  `,
  styles: [
    `
      .icon {
        width: 24px;
        height: 24px;
        display: inline-block;
      }
    `,
  ],
})
export class IconComponent {
  @Input() name = signal<IconName>('search');
  @Input() size = signal(24);
  @Input() fill = signal('none');
  @Input() stroke = signal('currentColor');
  @Input() strokeWidth = signal(2);
}
```

**File: `libs/common-ui/src/lib/common-ui/tooltip/tooltip.directive.ts`**

```typescript
import { Directive, Input, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[otuiTooltip]',
  standalone: true,
})
export class TooltipDirective {
  @Input() otuiTooltip = '';
  @Input() tooltipPosition = 'top';

  private tooltipEl: HTMLElement | null = null;

  constructor(private el: ElementRef) {}

  @HostListener('mouseenter')
  onMouseEnter() {
    this.showTooltip();
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.hideTooltip();
  }

  private showTooltip() {
    if (this.tooltipEl) return;

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'otui-tooltip';
    this.tooltipEl.textContent = this.otuiTooltip;
    document.body.appendChild(this.tooltipEl);

    const rect = this.el.nativeElement.getBoundingClientRect();
    this.tooltipEl.style.position = 'fixed';

    switch (this.tooltipPosition) {
      case 'top':
        this.tooltipEl.style.bottom = `${window.innerHeight - rect.top + 8}px`;
        this.tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
        break;
      case 'bottom':
        this.tooltipEl.style.top = `${rect.bottom + 8}px`;
        this.tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
        break;
    }

    this.tooltipEl.style.transform = 'translateX(-50%)';
  }

  private hideTooltip() {
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
  }
}
```

**File: `libs/common-ui/src/lib/common-ui/chip/chip.component.ts`**

```typescript
import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-chip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="chip" [class]="variant()" [class.deletable]="deletable()">
      <ng-content></ng-content>
      @if (deletable()) {
      <button class="chip-delete" (click)="onDelete($event)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12"></path>
        </svg>
      </button>
      }
    </span>
  `,
  styles: [
    `
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 13px;
        font-weight: 500;
        background: var(--primary-alpha);
        color: var(--primary);
        &.secondary {
          background: var(--secondary-alpha);
          color: var(--secondary);
        }
        &.success {
          background: var(--success);
          color: white;
        }
        &.warning {
          background: var(--warning);
          color: black;
        }
        &.error {
          background: var(--error);
          color: white;
        }
        &.deletable {
          padding-right: 4px;
        }
      }
      .chip-delete {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border: none;
        background: transparent;
        border-radius: 50%;
        cursor: pointer;
        &:hover {
          background: rgba(0, 0, 0, 0.1);
        }
        svg {
          width: 12px;
          height: 12px;
        }
      }
    `,
  ],
})
export class ChipComponent {
  @Input() variant = signal<'primary' | 'secondary' | 'success' | 'warning' | 'error'>('primary');
  @Input() deletable = signal(false);
  @Output() delete = new EventEmitter<void>();

  onDelete(event: Event) {
    event.stopPropagation();
    this.delete.emit();
  }
}
```

**File: `libs/common-ui/src/lib/common-ui/datepicker/datepicker.component.ts`**

```typescript
import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'otui-datepicker',
  standalone: true,
  imports: [CommonModule, TextInputComponent],
  template: `
    <div class="datepicker">
      <otui-text-input [label]="label()" [placeholder]="placeholder()" [value]="displayValue()" (valueChange)="onInputChange($event)" (focus)="showCalendar = true"></otui-text-input>

      @if (showCalendar) {
      <div class="calendar-dropdown">
        <div class="calendar-header">
          <button (click)="previousMonth()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <span>{{ currentMonth | date : 'MMMM yyyy' }}</span>
          <button (click)="nextMonth()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        <div class="calendar-grid">
          @for (day of daysOfMonth(); track $index) {
          <button class="day" [class.other-month]="!day.currentMonth" [class.selected]="isSelected(day)" [disabled]="day.disabled" (click)="selectDate(day)">
            {{ day.date }}
          </button>
          }
        </div>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .datepicker {
        position: relative;
      }
      .calendar-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 12px;
        z-index: 100;
      }
      .calendar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        button {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 4px;
        }
        svg {
          width: 20px;
          height: 20px;
        }
      }
      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
      }
      .day {
        padding: 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 4px;
        &:hover {
          background: var(--hover-bg);
        }
        &.selected {
          background: var(--primary);
          color: white;
        }
        &.other-month {
          color: var(--muted);
        }
        &.disabled {
          opacity: 0.3;
          pointer-events: none;
        }
      }
    `,
  ],
})
export class DatePickerComponent {
  @Input() label = signal('');
  @Input() placeholder = signal('Select date');
  @Input() minDate: Date | null = null;
  @Input() maxDate: Date | null = null;
  @Output() dateChange = new EventEmitter<Date>();

  selectedDate = signal<Date | null>(null);
  showCalendar = false;
  currentMonth = new Date();
  displayValue = signal('');
  daysOfMonth = signal<{ date: number; currentMonth: boolean; disabled: boolean }[]>([]);

  ngOnInit() {
    this.generateDays();
  }

  private generateDays() {
    // Generate calendar days logic
  }

  selectDate(day: { date: number; currentMonth: boolean; disabled: boolean }) {
    if (day.disabled) return;
    // Set selected date
  }

  previousMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1);
    this.generateDays();
  }

  nextMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1);
    this.generateDays();
  }

  onInputChange(value: string) {
    this.displayValue.set(value);
  }

  isSelected(day: any): boolean {
    return false;
  }
}
```

standalone: true,
imports: [CommonModule],
template: `  <div class="input-wrapper" [class.disabled]="disabled()" [class.error]="error()">
      @if (label()) {
      <label class="input-label">{{ label() }}</label>
      }
      <div class="input-container">
        <input [type]="type()" [placeholder]="placeholder()" [disabled]="disabled()" [value]="value()" (input)="onInput($event)" (blur)="onBlur()" class="input-field" />
        @if (prefixIcon()) {
        <span class="input-icon prefix">{{ prefixIcon() }}</span>
        } @if (suffixIcon()) {
        <span class="input-icon suffix">{{ suffixIcon() }}</span>
        }
      </div>
      @if (error()) {
      <span class="input-error">{{ error() }}</span>
      } @else if (hint()) {
      <span class="input-hint">{{ hint() }}</span>
      }
    </div>`,
styles: [
`
.input-wrapper {
display: flex;
flex-direction: column;
gap: 4px;
}
.input-label {
font-size: 14px;
font-weight: 500;
color: var(--foreground);
}
.input-container {
position: relative;
display: flex;
align-items: center;
}
.input-field {
width: 100%;
padding: 10px 14px;
border: 1px solid var(--border);
border-radius: 8px;
background: var(--surface);
color: var(--foreground);
font-size: 14px;
transition: border-color 0.2s, box-shadow 0.2s;

        &:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-alpha);
        }

        &::placeholder {
          color: var(--muted);
        }
      }
      .disabled .input-field {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .error .input-field {
        border-color: var(--error);
      }
      .input-error {
        font-size: 12px;
        color: var(--error);
      }
      .input-hint {
        font-size: 12px;
        color: var(--muted);
      }
      .input-icon {
        position: absolute;
        color: var(--muted);
        &.prefix {
          left: 12px;
        }
        &.suffix {
          right: 12px;
        }
      }
    `,

],
})
export class InputComponent {
@Input() label = signal('');
@Input() placeholder = signal('');
@Input() type = signal<'text' | 'email' | 'password' | 'number' | 'search'>('text');
@Input() disabled = signal(false);
@Input() error = signal('');
@Input() hint = signal('');
@Input() prefixIcon = signal('');
@Input() suffixIcon = signal('');
@Input() value = signal('');

@Output() valueChange = new EventEmitter<string>();
@Output() blur = new EventEmitter<void>();

onInput(event: Event) {
const value = (event.target as HTMLInputElement).value;
this.value.set(value);
this.valueChange.emit(value);
}

onBlur() {
this.blur.emit();
}
}

````

**File: `libs/common-ui/src/lib/common-ui/dropdown/dropdown.component.ts`**

```typescript
import { Component, Input, Output, EventEmitter, signal, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-dropdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dropdown-container" (click)="toggle()">
      <button class="dropdown-trigger" [class.active]="isOpen()">
        @if (triggerLabel()) {
        <span>{{ triggerLabel() }}</span>
        }
        <ng-content select="[dropdown-trigger]"></ng-content>
        <span class="dropdown-arrow" [class.open]="isOpen()">▼</span>
      </button>

      @if (isOpen()) {
      <div class="dropdown-menu" (click)="$event.stopPropagation()">
        <ng-content></ng-content>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .dropdown-container {
        position: relative;
        display: inline-block;
      }
      .dropdown-trigger {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        color: var(--foreground);
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: var(--hover-bg);
        }
        &.active {
          border-color: var(--primary);
        }
      }
      .dropdown-arrow {
        font-size: 10px;
        transition: transform 0.2s;
        &.open {
          transform: rotate(180deg);
        }
      }
      .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        min-width: 180px;
        margin-top: 4px;
        padding: 4px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
      }
    `,
  ],
})
export class DropdownComponent {
  @Input() triggerLabel = signal('');
  isOpen = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  constructor(private elRef: ElementRef) {}

  toggle() {
    this.isOpen.update((v) => !v);
  }

  close() {
    this.isOpen.set(false);
  }
}
````

**File: `libs/common-ui/src/lib/common-ui/dropdown/dropdown-item.directive.ts`**

```typescript
import { Directive, Input, Output, EventEmitter } from '@angular/core';

@Directive({
  selector: '[otuiDropdownItem]',
  standalone: true,
})
export class DropdownItemDirective {
  @Input() disabled = false;
  @Output() selected = new EventEmitter<void>();

  onClick() {
    if (!this.disabled) {
      this.selected.emit();
    }
  }
}
```

**File: `libs/common-ui/src/lib/common-ui/tabs/tabs.component.ts`**

```typescript
import { Component, Input, Output, EventEmitter, signal, ChildrenOutletContexts } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tabs-container">
      <div class="tabs-header" role="tablist">
        @for (tab of tabs(); track tab.id; let i = $index) {
        <button class="tab-item" [class.active]="activeTab() === tab.id" (click)="selectTab(tab.id)" role="tab" [attr.aria-selected]="activeTab() === tab.id">
          {{ tab.label }}
          @if (tab.badge) {
          <span class="tab-badge">{{ tab.badge }}</span>
          }
        </button>
        }
      </div>
      <div class="tabs-content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [
    `
      .tabs-container {
        display: flex;
        flex-direction: column;
      }
      .tabs-header {
        display: flex;
        border-bottom: 1px solid var(--border);
        gap: 4px;
      }
      .tab-item {
        padding: 12px 20px;
        border: none;
        background: transparent;
        color: var(--muted);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        position: relative;
        transition: color 0.2s;

        &:hover {
          color: var(--foreground);
        }
        &.active {
          color: var(--primary);
          &::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--primary);
          }
        }
      }
      .tab-badge {
        margin-left: 6px;
        padding: 2px 6px;
        border-radius: 10px;
        background: var(--primary);
        color: white;
        font-size: 11px;
      }
      .tabs-content {
        padding: 16px 0;
      }
    `,
  ],
})
export class TabsComponent {
  @Input() tabs = signal<{ id: string; label: string; badge?: number }[]>([]);
  @Input() activeTab = signal('');
  @Output() tabChange = new EventEmitter<string>();

  selectTab(id: string) {
    this.activeTab.set(id);
    this.tabChange.emit(id);
  }
}
```

**File: `libs/common-ui/src/lib/common-ui/badge/badge.component.ts`**

```typescript
import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [class]="variant()" [class.dot]="dot()">
      @if (!dot()) {
      {{ content() }}
      }
    </span>
  `,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 6px;
        border-radius: 9px;
        font-size: 11px;
        font-weight: 600;

        &.primary {
          background: var(--primary);
          color: white;
        }
        &.secondary {
          background: var(--secondary);
          color: white;
        }
        &.success {
          background: var(--success);
          color: white;
        }
        &.warning {
          background: var(--warning);
          color: black;
        }
        &.error {
          background: var(--error);
          color: white;
        }
        &.dot {
          min-width: 8px;
          width: 8px;
          height: 8px;
          padding: 0;
          border-radius: 50%;
        }
      }
    `,
  ],
})
export class BadgeComponent {
  @Input() content = signal('');
  @Input() variant = signal<'primary' | 'secondary' | 'success' | 'warning' | 'error'>('primary');
  @Input() dot = signal(false);
}
```

#### Step 4: Update All Component Imports

Update all imports in the client-interface app. Here's an example pattern:

**Before:**

```typescript
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
```

**After:**

```typescript
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
// Use inline SVG icons or custom IconComponent
import { CardComponent } from '@optimistic-tanuki/common-ui';
```

#### Step 5: Global Styles Update

**File: `apps/client-interface/src/styles.scss`**

```scss
// Design tokens from theme-lib
:root {
  --primary: #{$primary};
  --primary-alpha: #{$primary-alpha};
  --secondary: #{$secondary};
  --foreground: #{$foreground};
  --background: #{$background};
  --surface: #{$surface};
  --border: #{$border};
  --muted: #{$muted};
  --hover-bg: #{$hover-bg};
  --error: #ff4444;
  --warning: #ffbb33;
  --success: #00c851;
}

// Typography
body {
  font-family: var(--font-family, system-ui, sans-serif);
  font-size: 14px;
  line-height: 1.5;
  color: var(--foreground);
  background: var(--background);
}

// Utility classes (replacing Material utilities)
.flex {
  display: flex;
}
.flex-col {
  flex-direction: column;
}
.items-center {
  align-items: center;
}
.justify-between {
  justify-content: space-between;
}
.gap-2 {
  gap: 8px;
}
.gap-4 {
  gap: 16px;
}
.p-2 {
  padding: 8px;
}
.p-4 {
  padding: 16px;
}
.m-0 {
  margin: 0;
}
.rounded {
  border-radius: 8px;
}
.rounded-full {
  border-radius: 9999px;
}

// Focus styles (for accessibility)
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

### Implementation Priority

1. **Phase 1: Core Removal** ✅ COMPLETE - Remove Material from build, create essential replacements
   - [x] Remove from project.json
   - [x] Remove from package.json
   - [x] Create missing design system components (Step 4) - Created: IconComponent, TabsComponent, DropdownComponent, ChipComponent, TooltipDirective
   - [x] Update component imports (Step 5) - Replaced all Material imports with design system components
2. **Phase 2: Component Migration** - Update all existing components to use design system
3. **Phase 3: New Features** - Build new components using design system only

---

## 2. Notifications System

### Overview

Add a comprehensive notification system to drive user engagement. Users should be notified about interactions with their content, new followers, messages, and mentions.

### Frontend Library: @optimistic-tanuki/notification-ui

The notification system components are now centralized in the `@optimistic-tanuki/notification-ui` library.

#### Library Structure

**Files:**

- `libs/notification-ui/src/index.ts` - Main exports
- `libs/notification-ui/src/lib/notification.model.ts` - Notification types and interfaces
- `libs/notification-ui/src/lib/notification.service.ts` - Notification service for API calls
- `libs/notification-ui/src/lib/notification-bell/notification-bell.component.ts` - Bell icon with dropdown
- `libs/notification-ui/src/lib/notification-list/notification-list.component.ts` - Full notification list page

#### Library Exports

```typescript
// From @optimistic-tanuki/notification-ui
export * from './lib/notification.model'; // Notification, NotificationType, CreateNotificationDto
export * from './lib/notification.service'; // NotificationService
export * from './lib/notification-bell/notification-bell.component'; // NotificationBellComponent
export * from './lib/notification-list/notification-list.component'; // NotificationListComponent
```

#### Usage Example

```typescript
import { NotificationService, NotificationBellComponent, NotificationListComponent } from '@optimistic-tanuki/notification-ui';

// In your component
private notificationService = inject(NotificationService);

// Use the bell component
// <notif-notification-bell
//   [notifications]="notifications"
//   [unreadCount]="unreadCount"
//   (notificationClick)="handleNotificationClick($event)"
//   (onMarkAllRead)="handleMarkAllRead()"
// ></notif-notification-bell>

// Use the full page list
// <notif-notification-list
//   [notifications]="notifications"
//   [unreadCount]="unreadCount"
//   (notificationClick)="handleNotificationClick($event)"
//   (onMarkAllRead)="handleMarkAllRead()"
// ></notif-notification-list>
```

### Backend Requirements

#### 1.1 Database Entity

**File: `apps/social/src/entities/notification.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum NotificationType {
  LIKE = 'like',
  COMMENT = 'comment',
  FOLLOW = 'follow',
  MENTION = 'mention',
  MESSAGE = 'message',
  COMMUNITY_INVITE = 'community_invite',
  SYSTEM = 'system',
}

@Entity()
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recipientId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column()
  body: string;

  @Column({ nullable: true })
  senderId: string;

  @Column({ nullable: true })
  resourceType: string;

  @Column({ nullable: true })
  resourceId: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  actionUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

#### 1.2 Notification Service

**File: `apps/social/src/app/services/notification.service.ts`**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from '../../entities/notification.entity';

export interface CreateNotificationData {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  senderId?: string;
  resourceType?: string;
  resourceId?: string;
  actionUrl?: string;
}

@Injectable()
export class NotificationService {
  constructor(
    @Inject(getRepositoryToken(Notification))
    private readonly notificationRepo: Repository<Notification>
  ) {}

  async create(data: CreateNotificationData): Promise<Notification> {
    const notification = this.notificationRepo.create(data);
    return await this.notificationRepo.save(notification);
  }

  async findByRecipient(recipientId: string): Promise<Notification[]> {
    return await this.notificationRepo.find({
      where: { recipientId },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(id: string): Promise<void> {
    await this.notificationRepo.update(id, { isRead: true });
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    await this.notificationRepo.update({ recipientId, isRead: false }, { isRead: true });
  }

  async delete(id: string): Promise<void> {
    await this.notificationRepo.delete(id);
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    return await this.notificationRepo.count({
      where: { recipientId, isRead: false },
    });
  }
}
```

#### 1.3 Gateway Controller

**File: `apps/gateway/src/controllers/social/notification/notification.controller.ts`**

The gateway exposes the following endpoints:

| Method | Endpoint                                     | Description                         |
| ------ | -------------------------------------------- | ----------------------------------- |
| GET    | `/api/notifications/:profileId`              | Get all notifications for a profile |
| GET    | `/api/notifications/:profileId/unread-count` | Get unread notification count       |
| POST   | `/api/notifications`                         | Create a new notification           |
| PUT    | `/api/notifications/:notificationId/read`    | Mark a notification as read         |
| PUT    | `/api/notifications/:profileId/read-all`     | Mark all notifications as read      |
| DELETE | `/api/notifications/:notificationId`         | Delete a notification               |

#### 1.4 Message Pattern Commands

**File: `libs/constants/src/lib/libs/social.ts`**

```typescript
export const NotificationCommands = {
  CREATE: 'CREATE_NOTIFICATION',
  FIND: 'FIND_NOTIFICATION',
  FIND_BY_RECIPIENT: 'FIND_NOTIFICATIONS_BY_RECIPIENT',
  MARK_READ: 'MARK_NOTIFICATION_READ',
  MARK_ALL_READ: 'MARK_ALL_NOTIFICATIONS_READ',
  DELETE: 'DELETE_NOTIFICATION',
  GET_UNREAD_COUNT: 'GET_UNREAD_NOTIFICATION_COUNT',
};
```

### Integration with Existing Services

#### Vote Service Notification Trigger

**In `apps/social/src/app/services/vote.service.ts`:**

```typescript
// After saving a vote, create notification
if (post.profileId !== currentUserId) {
  this.notificationService
    .create({
      recipientId: post.profileId,
      type: NotificationType.LIKE,
      title: 'New Like',
      body: `${currentUserName} liked your post`,
      senderId: currentUserId,
      resourceType: 'post',
      resourceId: post.id,
      actionUrl: `/feed/post/${post.id}`,
    })
    .subscribe();
}
```

#### Comment Service Notification Trigger

**In `apps/social/src/app/services/comment.service.ts`:**

```typescript
// After creating a comment
if (post.profileId !== comment.profileId) {
  this.notificationService
    .create({
      recipientId: post.profileId,
      type: NotificationType.COMMENT,
      title: 'New Comment',
      body: `${commenterName} commented on your post`,
      senderId: comment.profileId,
      resourceType: 'post',
      resourceId: post.id,
      actionUrl: `/feed/post/${post.id}`,
    })
    .subscribe();
}

// Check for mentions in comment content
const mentions = this.extractMentions(comment.content);
mentions.forEach((mentionedId) => {
  this.notificationService
    .create({
      recipientId: mentionedId,
      type: NotificationType.MENTION,
      title: 'You were mentioned',
      body: `${commenterName} mentioned you in a comment`,
      senderId: comment.profileId,
      resourceType: 'post',
      resourceId: post.id,
      actionUrl: `/feed/post/${post.id}`,
    })
    .subscribe();
});
```

#### Follow Service Notification Trigger

**In `apps/social/src/app/services/follow.service.ts`:**

```typescript
// After creating a follow
if (followerId !== followeeId) {
  this.notificationService
    .create({
      recipientId: followeeId,
      type: NotificationType.FOLLOW,
      title: 'New Follower',
      body: `${followerName} started following you`,
      senderId: followerId,
      resourceType: 'profile',
      resourceId: followerId,
      actionUrl: `/profile/${followerId}`,
    })
    .subscribe();
}
```

### Route Addition

**File: `apps/client-interface/src/app/app.routes.ts`**

```typescript
{
  path: 'notifications',
  loadComponent: () =>
    import('./components/notifications/notifications-page.component').then(
      (m) => m.NotificationsPageComponent
    ),
  canActivate: [AuthGuard, ProfileGuard],
},
```

}
if (profile) {
this.notificationService.loadNotifications(profile.id);
}
this.filteredNotifications.set(this.notifications());
}

onTabChange(tabId: string) {
this.activeTab.set(tabId);
// Filter notifications based on tab
}

markAllRead() {
const profile = this.profileService.getCurrentUserProfile();
if (profile) {
this.notificationService.markAllAsRead(profile.id);
}
}
}

````

### Integration Points

#### 1.6 Trigger Notifications from Existing Services

Update existing services to trigger notifications:

**In `apps/social/src/app/services/vote.service.ts`:**

```typescript
// After saving a vote, create notification
if (post.profileId !== currentUserId) {
  this.notificationService
    .createNotification({
      recipientId: post.profileId,
      type: NotificationType.LIKE,
      title: 'New Like',
      body: `${currentUserName} liked your post`,
      senderId: currentUserId,
      resourceType: 'post',
      resourceId: post.id,
      actionUrl: `/feed/post/${post.id}`,
    })
    .subscribe();
}
````

**In `apps/social/src/app/services/comment.service.ts`:**

```typescript
// After creating a comment
if (post.profileId !== comment.profileId) {
  this.notificationService
    .createNotification({
      recipientId: post.profileId,
      type: NotificationType.COMMENT,
      title: 'New Comment',
      body: `${commenterName} commented on your post`,
      senderId: comment.profileId,
      resourceType: 'post',
      resourceId: post.id,
      actionUrl: `/feed/post/${post.id}`,
    })
    .subscribe();
}

// Check for mentions in comment content
const mentions = this.extractMentions(comment.content);
mentions.forEach((mentionedId) => {
  this.notificationService
    .createNotification({
      recipientId: mentionedId,
      type: NotificationType.MENTION,
      title: 'You were mentioned',
      body: `${commenterName} mentioned you in a comment`,
      senderId: comment.profileId,
      resourceType: 'post',
      resourceId: post.id,
      actionUrl: `/feed/post/${post.id}`,
    })
    .subscribe();
});
```

**In `apps/social/src/app/services/follow.service.ts`:**

```typescript
// After creating a follow
if (followerId !== followeeId) {
  this.notificationService
    .createNotification({
      recipientId: followeeId,
      type: NotificationType.FOLLOW,
      title: 'New Follower',
      body: `${followerName} started following you`,
      senderId: followerId,
      resourceType: 'profile',
      resourceId: followerId,
      actionUrl: `/profile/${followerId}`,
    })
    .subscribe();
}
```

### Route Addition

**File: `apps/client-interface/src/app/app.routes.ts`**

```typescript
{
  path: 'notifications',
  loadComponent: () =>
    import('./components/notifications/notifications-page.component').then(
      (m) => m.NotificationsPageComponent
    ),
  canActivate: [AuthGuard, ProfileGuard],
},
```

---

## 3. Search & Discovery

### Overview

Add global search functionality and an Explore page to help users discover new content, users, and communities.

### Frontend Library: @optimistic-tanuki/search-ui

The search system components should be centralized in a new `@optimistic-tanuki/search-ui` library following the pattern used by notification-ui.

#### Library Structure

**Files:**

- `libs/search-ui/src/index.ts` - Main exports
- `libs/search-ui/src/lib/search.model.ts` - Search types and interfaces
- `libs/search-ui/src/lib/search.service.ts` - Search service for API calls
- `libs/search-ui/src/lib/global-search/global-search.component.ts` - Global search dropdown component
- `libs/search-ui/src/lib/explore-page/explore-page.component.ts` - Explore/Discovery page

#### Library Exports

```typescript
// From @optimistic-tanuki/search-ui
export * from './lib/search.model'; // SearchResult, SearchResponse, SearchOptions
export * from './lib/search.service'; // SearchService
export * from './lib/global-search/global-search.component'; // GlobalSearchComponent
export * from './lib/explore-page/explore-page.component'; // ExplorePageComponent
```

#### Usage Example

```typescript
import { SearchService, GlobalSearchComponent, ExplorePageComponent } from '@optimistic-tanuki/search-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

// In your component
private searchService = inject(SearchService);
private themeService = inject(ThemeService);

// Use the global search component
// <search-global-search
//   [placeholder]="'Search for people, posts, communities...'"
/>
// ></search-global-search>

// Use the explore page
// <search-explore-page></search-explore-page>
```

### Backend Requirements

Following the platform patterns, the search functionality requires:

#### 3.1 Database Entity

**File: `apps/social/src/entities/search-history.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity()
@Index(['profileId', 'query'])
export class SearchHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  profileId: string;

  @Column()
  query: string;

  @Column({
    type: 'enum',
    enum: ['all', 'users', 'posts', 'communities'],
    default: 'all',
  })
  searchType: 'all' | 'users' | 'posts' | 'communities';

  @Column({ default: 0 })
  resultCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
```

#### 3.2 Microservice Service

**File: `apps/social/src/app/services/search.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { SearchHistory } from '../../entities/search-history.entity';

export interface SearchResult {
  type: 'user' | 'post' | 'community';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  highlight?: string;
}

export interface SearchResponse {
  users: SearchResult[];
  posts: SearchResult[];
  communities: SearchResult[];
  total: number;
}

export interface SearchOptions {
  type?: 'all' | 'users' | 'posts' | 'communities';
  limit?: number;
  offset?: number;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(SearchHistory)
    private readonly searchHistoryRepo: Repository<SearchHistory>,
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Community)
    private readonly communityRepo: Repository<Community>
  ) {}

  async search(query: string, options: SearchOptions = {}, profileId?: string): Promise<SearchResponse> {
    const { type = 'all', limit = 20, offset = 0 } = options;
    const results: SearchResponse = { users: [], posts: [], communities: [], total: 0 };

    if (type === 'all' || type === 'users') {
      results.users = await this.profileRepo.find({
        where: [{ profileName: ILike(`%${query}%`) }, { bio: ILike(`%${query}%`) }],
        take: limit,
        skip: offset,
        select: ['id', 'profileName', 'profilePic', 'bio'],
      });
    }

    if (type === 'all' || type === 'posts') {
      results.posts = await this.postRepo.find({
        where: [{ title: ILike(`%${query}%`) }, { content: ILike(`%${query}%`) }],
        take: limit,
        skip: offset,
        relations: ['profile'],
      });
    }

    if (type === 'all' || type === 'communities') {
      results.communities = await this.communityRepo.find({
        where: [{ name: ILike(`%${query}%`) }, { description: ILike(`%${query}%`) }],
        take: limit,
        skip: offset,
      });
    }

    results.total = results.users.length + results.posts.length + results.communities.length;

    if (profileId) {
      await this.saveSearchHistory(profileId, query, type, results.total);
    }

    return results;
  }

  async getTrending(limit: number = 10): Promise<SearchResult[]> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const posts = await this.postRepo.createQueryBuilder('post').leftJoinAndSelect('post.profile', 'profile').leftJoinAndSelect('post.votes', 'votes').leftJoinAndSelect('post.comments', 'comments').where('post.createdAt >= :date', { date: oneDayAgo }).orderBy('(votes.count + comments.count)', 'DESC').limit(limit).getMany();

    return posts.map((p) => ({
      type: 'post' as const,
      id: p.id,
      title: p.title,
      subtitle: p.profile?.profileName,
      highlight: p.content?.substring(0, 100),
    }));
  }

  async getSuggestedUsers(limit: number = 10, profileId: string): Promise<SearchResult[]> {
    const users = await this.profileRepo.createQueryBuilder('profile').leftJoin('follows', 'follow', 'follow.followeeId = profile.id AND follow.followerId = :profileId', { profileId }).where('follow.id IS NULL').andWhere('profile.id != :profileId', { profileId }).limit(limit).getMany();

    return users.map((u) => ({
      type: 'user' as const,
      id: u.id,
      title: u.profileName,
      subtitle: u.bio,
      imageUrl: u.profilePic,
    }));
  }

  async getSuggestedCommunities(limit: number = 10): Promise<SearchResult[]> {
    const communities = await this.communityRepo.find({
      take: limit,
      order: { memberCount: 'DESC' },
    });

    return communities.map((c) => ({
      type: 'community' as const,
      id: c.id,
      title: c.name,
      subtitle: c.description,
      imageUrl: c.imageUrl,
    }));
  }

  private async saveSearchHistory(profileId: string, query: string, searchType: string, resultCount: number): Promise<void> {
    const history = this.searchHistoryRepo.create({
      profileId,
      query,
      searchType: searchType as any,
      resultCount,
    });
    await this.searchHistoryRepo.save(history);
  }

  async getSearchHistory(profileId: string, limit: number = 10): Promise<SearchHistory[]> {
    return this.searchHistoryRepo.find({
      where: { profileId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
```

#### 3.3 Gateway Controller

**File: `apps/gateway/src/controllers/social/search/search.controller.ts`**

The gateway exposes the following endpoints:

| Method | Endpoint                            | Description                          |
| ------ | ----------------------------------- | ------------------------------------ |
| GET    | `/api/search`                       | Search for users, posts, communities |
| GET    | `/api/search/trending`              | Get trending posts                   |
| GET    | `/api/search/suggested-users`       | Get suggested users to follow        |
| GET    | `/api/search/suggested-communities` | Get suggested communities            |
| GET    | `/api/search/history`               | Get user's search history            |

#### 3.4 Message Pattern Commands

**File: `libs/constants/src/lib/libs/social.ts`**

```typescript
export const SearchCommands = {
  SEARCH: 'SEARCH',
  GET_TRENDING: 'GET_TRENDING_SEARCH',
  GET_SUGGESTED_USERS: 'GET_SUGGESTED_USERS',
  GET_SUGGESTED_COMMUNITIES: 'GET_SUGGESTED_COMMUNITIES',
  GET_SEARCH_HISTORY: 'GET_SEARCH_HISTORY',
};
```

### Frontend Components

#### 3.5 Global Search Component

**File: `libs/search-ui/src/lib/global-search/global-search.component.ts`**

```typescript
import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import { SearchService, SearchResult, SearchResponse } from '../search.service';
import { SpinnerComponent } from '@optimistic-tanuki/common-ui';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'search-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SpinnerComponent],
  template: `
    <div class="search-container" [style.--search-primary]="themeColors.primary">
      <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input type="text" [ngModel]="searchQuery()" (ngModelChange)="onSearchChange($event)" [placeholder]="placeholder()" class="search-input" />
        @if (isLoading()) {
        <otui-spinner diameter="20"></otui-spinner>
        } @if (searchQuery()) {
        <button class="icon-button clear-btn" (click)="clearSearch()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"></path>
          </svg>
        </button>
        }
      </div>

      @if (results() && (results().users.length > 0 || results().posts.length > 0 || results().communities.length > 0)) {
      <div class="search-results">
        @if (results().users.length > 0) {
        <div class="result-section">
          <h4>People</h4>
          @for (user of results().users; track user.id) {
          <a [routerLink]="['/profile', user.id]" class="result-item" (click)="clearSearch()">
            <img [src]="user.imageUrl || '/assets/default-avatar.png'" class="result-avatar" />
            <div class="result-info">
              <span class="result-title">{{ user.title }}</span>
              @if (user.subtitle) {
              <span class="result-subtitle">{{ user.subtitle }}</span>
              }
            </div>
          </a>
          }
        </div>
        } @if (results().communities.length > 0) {
        <div class="result-section">
          <h4>Communities</h4>
          @for (community of results().communities; track community.id) {
          <a [routerLink]="['/communities', community.id]" class="result-item" (click)="clearSearch()">
            <img [src]="community.imageUrl || '/assets/default-community.png'" class="result-avatar" />
            <div class="result-info">
              <span class="result-title">{{ community.title }}</span>
              @if (community.subtitle) {
              <span class="result-subtitle">{{ community.subtitle }}</span>
              }
            </div>
          </a>
          }
        </div>
        } @if (results().posts.length > 0) {
        <div class="result-section">
          <h4>Posts</h4>
          @for (post of results().posts; track post.id) {
          <a [routerLink]="['/feed/post', post.id]" class="result-item" (click)="clearSearch()">
            <svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <div class="result-info">
              <span class="result-title">{{ post.title }}</span>
              @if (post.highlight) {
              <span class="result-subtitle">{{ post.highlight }}...</span>
              }
            </div>
          </a>
          }
        </div>
        }
      </div>
      }
    </div>
  `,
  styles: [
    `
      .search-container {
        position: relative;
        width: 100%;
        max-width: 600px;
      }
      .search-input-wrapper {
        display: flex;
        align-items: center;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 8px 16px;
        transition: border-color 0.2s, box-shadow 0.2s;

        &:focus-within {
          border-color: var(--search-primary, var(--primary));
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--search-primary, var(--primary)) 20%, transparent);
        }
      }
      .search-icon {
        width: 20px;
        height: 20px;
        color: var(--muted);
        margin-right: 12px;
        flex-shrink: 0;
      }
      .search-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 14px;
        color: var(--foreground);
        outline: none;

        &::placeholder {
          color: var(--muted);
        }
      }
      .icon-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 50%;
        transition: background 0.2s;

        &:hover {
          background: var(--hover-bg);
        }
        svg {
          width: 16px;
          height: 16px;
        }
      }
      .clear-btn {
        margin-left: 8px;
      }
      .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        margin-top: 8px;
        max-height: 500px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      .result-section {
        padding: 12px 0;
        border-bottom: 1px solid var(--border);

        &:last-child {
          border-bottom: none;
        }

        h4 {
          margin: 0 16px 8px;
          font-size: 12px;
          text-transform: uppercase;
          color: var(--muted);
        }
      }
      .result-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        text-decoration: none;
        color: inherit;
        transition: background 0.2s;

        &:hover {
          background: var(--hover-bg);
        }
      }
      .result-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
      }
      .result-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--hover-bg);
        border-radius: 8px;
      }
      .result-info {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .result-title {
        font-weight: 500;
        font-size: 14px;
      }
      .result-subtitle {
        font-size: 12px;
        color: var(--muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class GlobalSearchComponent {
  @Input() placeholder = signal('Search for people, posts, communities...');
  @Output() searchResultClick = new EventEmitter<SearchResult>();

  private searchService = inject(SearchService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private searchSubject = new Subject<string>();

  searchQuery = signal('');
  results = signal<SearchResponse | null>(null);
  isLoading = signal(false);

  get themeColors(): ThemeColors {
    return this.themeService.getCurrentTheme();
  }

  constructor() {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.length < 2) {
            return of(null);
          }
          this.isLoading.set(true);
          return this.searchService.search(query);
        })
      )
      .subscribe({
        next: (results) => {
          this.results.set(results);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  onSearchChange(query: string) {
    this.searchQuery.set(query);
    if (query.length >= 2) {
      this.searchSubject.next(query);
    } else {
      this.results.set(null);
    }
  }

  clearSearch() {
    this.searchQuery.set('');
    this.results.set(null);
  }
}
```

#### 3.6 Explore Page Component

**File: `libs/search-ui/src/lib/explore-page/explore-page.component.ts`**

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SearchService, SearchResult } from '../search.service';
import { SpinnerComponent, CardComponent, ButtonComponent, TabsComponent } from '@optimistic-tanuki/common-ui';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'search-explore-page',
  standalone: true,
  imports: [CommonModule, RouterModule, SpinnerComponent, CardComponent, ButtonComponent, TabsComponent],
  template: `
    <div class="explore-page">
      <header class="page-header">
        <h1>Explore</h1>
        <p>Discover new people, communities, and trending content</p>
      </header>

      @if (isLoading()) {
      <div class="loading-container">
        <otui-spinner></otui-spinner>
      </div>
      } @else {
      <otui-tabs [tabs]="tabOptions" [activeTab]="activeTab()" (tabChange)="onTabChange($event)">
        <div class="content-grid">
          @for (post of trendingPosts(); track post.id) {
          <otui-card class="content-card" [clickable]="true" (click)="navigateTo(['/feed/post', post.id])">
            <div class="card-content">
              <h3>{{ post.title }}</h3>
              <p>{{ post.highlight }}</p>
            </div>
          </otui-card>
          }
        </div>

        <div class="people-grid">
          @for (user of suggestedUsers(); track user.id) {
          <div class="user-card">
            <img [src]="user.imageUrl || '/assets/default-avatar.png'" class="user-avatar" />
            <h4>{{ user.title }}</h4>
            <p>{{ user.subtitle }}</p>
            <otui-button variant="outlined" (click)="navigateTo(['/profile', user.id])">View Profile</otui-button>
          </div>
          }
        </div>

        <div class="communities-grid">
          @for (community of suggestedCommunities(); track community.id) {
          <otui-card class="community-card" [clickable]="true" (click)="navigateTo(['/communities', community.id])">
            <img [src]="community.imageUrl || '/assets/default-community.png'" class="community-image" />
            <div class="card-content">
              <h3>{{ community.title }}</h3>
              <p>{{ community.subtitle }}</p>
            </div>
          </otui-card>
          }
        </div>
      </otui-tabs>
      }
    </div>
  `,
  styles: [
    `
      .explore-page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px;
      }
      .page-header {
        margin-bottom: 32px;
        h1 {
          font-size: 32px;
          margin-bottom: 8px;
        }
        p {
          color: var(--muted);
        }
      }
      .content-grid,
      .people-grid,
      .communities-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 24px;
        padding: 24px 0;
      }
      .content-card,
      .community-card {
        cursor: pointer;
        transition: transform 0.2s;
        &:hover {
          transform: translateY(-4px);
        }
      }
      .user-card {
        text-align: center;
        padding: 24px;
        background: var(--surface);
        border-radius: 12px;
        border: 1px solid var(--border);
      }
      .user-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        margin-bottom: 16px;
      }
      .community-image {
        width: 100%;
        height: 120px;
        object-fit: cover;
        border-radius: 12px 12px 0 0;
      }
    `,
  ],
})
export class ExplorePageComponent implements OnInit {
  private searchService = inject(SearchService);
  private router = inject(Router);
  private themeService = inject(ThemeService);

  isLoading = signal(true);
  activeTab = signal('trending');
  trendingPosts = signal<SearchResult[]>([]);
  suggestedUsers = signal<SearchResult[]>([]);
  suggestedCommunities = signal<SearchResult[]>([]);

  tabOptions = [
    { id: 'trending', label: 'Trending' },
    { id: 'people', label: 'Suggested People' },
    { id: 'communities', label: 'Suggested Communities' },
  ];

  ngOnInit() {
    this.loadContent();
  }

  onTabChange(tabId: string) {
    this.activeTab.set(tabId);
  }

  navigateTo(path: string[]) {
    this.router.navigate(path);
  }

  private loadContent() {
    this.searchService.getTrending(10).subscribe({
      next: (posts) => {
        this.trendingPosts.set(posts);
        this.checkLoadingComplete();
      },
    });

    this.searchService.getSuggestedUsers(10).subscribe({
      next: (users) => {
        this.suggestedUsers.set(users);
        this.checkLoadingComplete();
      },
    });

    this.searchService.getSuggestedCommunities(10).subscribe({
      next: (communities) => {
        this.suggestedCommunities.set(communities);
        this.checkLoadingComplete();
      },
    });
  }

  private checkLoadingComplete() {
    if (this.trendingPosts().length > 0 || this.suggestedUsers().length > 0 || this.suggestedCommunities().length > 0) {
      this.isLoading.set(false);
    }
  }
}
```

### Route Addition

**File: `apps/client-interface/src/app/app.routes.ts`**

```typescript
{
  path: 'explore',
  loadComponent: () =>
    import('@optimistic-tanuki/search-ui').then(
      (m) => m.ExplorePageComponent
    ),
  canActivate: [AuthGuard, ProfileGuard],
},
```

---

## 3. Direct Messaging Enhancements

### Overview

Enhance the existing chat functionality with real-time features: read receipts, typing indicators, online status, and message reactions.

### Backend Requirements

#### 3.1 Enhanced Message Entity

**File: `apps/social/src/entities/chat-message.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity()
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @Column()
  senderId: string;

  @Column('text')
  content: string;

  @Column({ type: 'simple-array', nullable: true })
  reactions: string[]; // JSON array of { emoji: string, userId: string }

  @Column({ default: false })
  isEdited: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ type: 'simple-array', nullable: true })
  readBy: string[]; // Array of user IDs who have read the message

  @Column({
    type: 'enum',
    enum: ['chat', 'info', 'warning', 'system'],
    default: 'chat',
  })
  type: 'chat' | 'info' | 'warning' | 'system';

  @CreateDateColumn()
  createdAt: Date;
}
```

#### 3.2 Online Status Service

**File: `apps/social/src/app/services/presence.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

export interface UserPresence {
  userId: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeen: Date;
}

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private presences = new BehaviorSubject<Map<string, UserPresence>>(new Map());
  private socket: WebSocket;

  constructor(private http: HttpClient) {
    this.connectToPresenceSocket();
  }

  private connectToPresenceSocket() {
    this.socket = new WebSocket(`ws://localhost:3000/presence`);

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handlePresenceUpdate(data);
    };
  }

  private handlePresenceUpdate(data: { userId: string; status: string }) {
    const current = this.presences.value;
    current.set(data.userId, {
      userId: data.userId,
      status: data.status as any,
      lastSeen: new Date(),
    });
    this.presences.next(new Map(current));
  }

  updateStatus(status: 'online' | 'offline' | 'away' | 'busy') {
    this.socket?.send(JSON.stringify({ status }));
  }

  getPresence(userId: string): Observable<UserPresence | undefined> {
    return new Observable((observer) => {
      this.http.get<UserPresence>(`/api/presence/${userId}`).subscribe((presence) => {
        observer.next(presence);
        observer.complete();
      });
    });
  }

  getOnlineUsers(userIds: string[]): Observable<UserPresence[]> {
    return this.http.post<UserPresence[]>('/api/presence/batch', { userIds });
  }

  get allPresences$() {
    return this.presences.asObservable();
  }
}
```

#### 3.3 Typing Indicators via WebSocket

The typing indicator will be handled through the existing WebSocket connection. Add these events to the social-websocket service:

**File: `apps/client-interface/src/app/social-websocket.service.ts`**

```typescript
// Add to existing service
private typingIndicators = new Subject<{ conversationId: string; userId: string; isTyping: boolean }>();

sendTypingIndicator(conversationId: string, isTyping: boolean) {
  this.socket?.emit('typing', { conversationId, isTyping });
}

onTypingIndicator(): Observable<{ conversationId: string; userId: string; isTyping: boolean }> {
  return this.typingIndicators.asObservable();
}

// In socket event handlers:
this.socket.on('typing', (data) => {
  this.typingIndicators.next(data);
});
```

### Frontend Components

#### 3.4 Enhanced Chat Window

**File: `apps/client-interface/src/app/components/chat/enhanced-chat.component.ts`**

```typescript
import { Component, Input, Output, EventEmitter, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { ChatMessage } from '../chat.service';
import { PresenceService, UserPresence } from '../../presence.service';
import { SocialWebSocketService } from '../../social-websocket.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ButtonComponent, DropdownComponent } from '@optimistic-tanuki/common-ui';

interface EnhancedMessage extends ChatMessage {
  reactions: { emoji: string; users: string[] }[];
  readBy: string[];
  isEdited: boolean;
}

@Component({
  selector: 'app-enhanced-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, DropdownComponent],
  template: `
    <div class="chat-container">
      <!-- Chat Header with Online Status -->
      <div class="chat-header">
        <img [src]="contact.avatarUrl" class="contact-avatar" />
        <div class="contact-info">
          <h3>{{ contact.name }}</h3>
          <span class="status" [class]="presence()?.status || 'offline'">
            {{ getStatusText() }}
          </span>
        </div>
        <button class="icon-button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
          </svg>
        </button>
      </div>

      <!-- Messages List -->
      <div class="messages-list" #messagesContainer>
        @for (message of messages(); track message.id) {
          <div
            class="message"
            [class.sent]="message.senderId === currentUserId"
            [class.received]="message.senderId !== currentUserId"
          >
            <div class="message-content">
              <p>{{ message.content }}</p>

              <!-- Reactions Display -->
              @if (message.reactions?.length > 0) {
                <div class="reactions">
                  @for (reaction of message.reactions; track reaction.emoji) {
                    <button
                      class="reaction-badge"
                      [class.active]="reaction.users.includes(currentUserId)"
                      (click)="toggleReaction(message, reaction.emoji)"
                    >
                      {{ reaction.emoji }} {{ reaction.users.length }}
                    </button>
                  }
                  <button class="icon-button add-reaction" (click)="showEmojiPicker = !showEmojiPicker">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                      <line x1="9" y1="9" x2="9.01" y2="9"></line>
                      <line x1="15" y1="9" x2="15.01" y2="9"></line>
                    </svg>
                  </button>
                </div>
              }

              <!-- Message Meta -->
              <div class="message-meta">
                @if (message.isEdited) {
                  <span class="edited">edited</span>
                }
                <span class="time">{{ message.createdAt | date:'shortTime' }}</span>
                @if (message.senderId === currentUserId) {
                  <span class="read-status">
                    @if (message.readBy?.includes(contact.id)) {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="check-icon double">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    } @else {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="check-icon">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    }
                  </span>
                }
              </div>
            </div>
          </div>
        }

        <!-- Typing Indicator -->
        @if (typingUsers().length > 0) {
          <div class="typing-indicator">
            <span>{{ typingUsers().join(', ') }} is typing...</span>
          </div>
        }
      </div>

      <!-- Message Input -->
      <div class="message-input">
        <button class="icon-button" (click)="toggleEmojiPicker()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
            <line x1="9" y1="9" x2="9.01" y2="9"></line>
            <line x1="15" y1="9" x2="15.01" y2="9"></line>
          </svg>
        </button>
        <input
          type="text"
          [(ngModel)]="newMessage"
          (ngModelChange)="onTyping()"
          (keyup.enter)="sendMessage()"
          placeholder="Type a message..."
        />
        <button class="icon-button send-button" (click)="sendMessage()" [disabled]="!newMessage()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .chat-container { display: flex; flex-direction: column; height: 100%; }
    .chat-header {
      display: flex; align-items: center; gap: 12px; padding: 12px;
      border-bottom: 1px solid var(--border);
    }
    .contact-avatar { width: 40px; height: 40px; border-radius: 50%; }
    .contact-info { flex: 1; }
    .status {
      font-size: 12px; color: var(--muted);
      &.online { color: #4caf50; }
      &.away { color: #ff9800; }
      &.busy { color: #f44336; }
    }
    .messages-list {
      flex: 1; overflow-y: auto; padding: 16px;
    }
    .message {
      margin-bottom: 12px; max-width: 70%;
      &.sent { margin-left: auto; }
      &.received { margin-right: auto; }
    }
    .message-content {
      padding: 8px 12px; border-radius: 12px;
      .sent & { background: var(--primary); color: white; }
      .received & { background: var(--hover-bg); }
    }
    .reactions {
      display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;
    }
    .reaction-badge {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 2px 8px; font-size: 12px; cursor: pointer;
      &.active { border-color: var(--primary); background: var(--primary-alpha); }
    }
    .message-meta {
      display: flex; gap: 4px; align-items: center;
      font-size: 11px; color: var(--muted);
      .sent & { justify-content: flex-end; }
    }
    .check-icon {
      width: 14px; height: 14px;
      &.double { color: var(--primary); }
    }
    .typing-indicator { font-size: 12px; color: var(--muted); font-style: italic; padding: 8px; }
    .message-input {
      display: flex; align-items: center; gap: 8px; padding: 8px;
      border-top: 1px solid var(--border);
      input { flex: 1; border: none; background: var(--hover-bg); border-radius: 20px; padding: 8px 16px; }
    }
    .icon-button {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px;
      border: none; background: transparent;
      border-radius: 50%; cursor: pointer;
      transition: background 0.2s;
      &:hover { background: var(--hover-bg); }
      svg { width: 20px; height: 20px; }
      &.send-button { color: var(--primary); }
    }
    .emoji-picker {
      display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; padding: 8px;
      button { font-size: 20px; padding: 4px; border: none; background: transparent; cursor: pointer; }
    }
  `]
})
export class EnhancedChatComponent implements OnInit, OnDestroy {
  @Input() conversationId!: string;
  @Input() contact: { id: string; name: string; avatarUrl?: string };
  @Input() currentUserId!: string;
  @Output() sendMessageEvent = new EventEmitter<string>();

  private presenceService = inject(PresenceService);
  private wsService = inject(SocialWebSocketService);
  private messageService = inject(MessageService);
  private destroy$ = new Subject<void>();
  private typingSubject = new Subject<void>();

  messages = signal<EnhancedMessage[]>([]);
  newMessage = signal('');
  presence = signal<UserPresence | null>(null);
  typingUsers = signal<string[]>([]);

  commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];

  ngOnInit() {
    this.loadPresence();
    this.setupTypingIndicator();
  }

  private loadPresence() {
    this.presenceService.getPresence(this.contact.id).subscribe({
      next: (presence) => this.presence.set(presence)
    });
  }

  private setupTypingIndicator() {
    this.wsService.onTypingIndicator().pipe(
      takeUntil(this.destroy$)
    ).subscribe(({ conversationId, userId, isTyping }) => {
      if (conversationId === this.conversationId && userId !== this.currentUserId) {
        this.typingUsers.update(users =>
          isTyping
            ? [...users, userId]
            : users.filter(id => id !== userId)
        );
      }
    });
  }

  onTyping() {
    this.typingSubject.next();
    this.wsService.sendTypingIndicator(this.conversationId, true);
  }

  // Debounce stopping typing
  private stopTypingTimeout: any;
  private stopTyping() {
    clearTimeout(this.stopTypingTimeout);
    this.stopTypingTimeout = setTimeout(() => {
      this.wsService.sendTypingIndicator(this.conversationId, false);
    }, 2000);
  }

  sendMessage() {
    if (!this.newMessage()) return;
    this.sendMessageEvent.emit(this.newMessage());
    this.wsService.sendTypingIndicator(this.conversationId, false);
    this.newMessage.set('');
  }

  toggleReaction(message: EnhancedMessage, emoji: string) {
    const userId = this.currentUserId;
    const reaction = message.reactions.find(r => r.emoji === emoji);

    if (reaction) {
      if (reaction.users.includes(userId)) {
        // Remove reaction
        reaction.users = reaction.users.filter(id => id !== userId);
        if (reaction.users.length === 0) {
          message.reactions = message.reactions.filter(r => r.emoji !== emoji);
        }
      } else {
        // Add reaction
        reaction.users.push(userId);
      }
    } else {
      message.reactions.push({ emoji, users: [userId] });
    }

    // Call API to save reaction
  }

  addReaction(emoji: string) {
    // Add reaction to last message
  }

  getStatusText(): string {
    const p = this.presence();
    if (!p || p.status === 'offline') {
      return p?.lastSeen ? `Last seen ${p.lastSeen | date:'short'}` : 'Offline';
    }
    return p.status.charAt(0).toUpperCase() + p.status.slice(1);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

---

## 4. User Privacy & Safety

### Overview

Implement user safety features: block, mute, and content reporting functionality.

### Backend Requirements

#### 4.1 Privacy Entities

**File: `apps/social/src/entities/user-block.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity()
@Unique(['blockerId', 'blockedId'])
export class UserBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  blockerId: string;

  @Column()
  blockedId: string;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

**File: `apps/social/src/entities/user-mute.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity()
@Unique(['muterId', 'mutedId'])
export class UserMute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  muterId: string;

  @Column()
  mutedId: string;

  @Column({ nullable: true })
  duration: number; // in seconds, null for indefinite

  @CreateDateColumn()
  createdAt: Date;
}
```

**File: `apps/social/src/entities/content-report.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  HATE_SPEECH = 'hate_speech',
  VIOLENCE = 'violence',
  MISINFORMATION = 'misinformation',
  INAPPROPRIATE = 'inappropriate',
  OTHER = 'other',
}

@Entity()
export class ContentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reporterId: string;

  @Column()
  contentType: 'post' | 'comment' | 'profile' | 'community' | 'message';

  @Column()
  contentId: string;

  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';

  @Column({ nullable: true })
  adminNotes: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

#### 4.2 Privacy Service

**File: `apps/social/src/app/services/privacy.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BlockedUser {
  id: string;
  blockedId: string;
  blockedName: string;
  blockedAvatar?: string;
  createdAt: Date;
}

export interface MutedUser {
  id: string;
  mutedId: string;
  mutedName: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface ContentReport {
  id: string;
  contentType: string;
  contentId: string;
  reason: string;
  description?: string;
  status: string;
  createdAt: Date;
}

@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private baseUrl = '/api/privacy';

  // Block functionality
  blockUser(blockedId: string, reason?: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/block`, { blockedId, reason });
  }

  unblockUser(blockedId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/block/${blockedId}`);
  }

  getBlockedUsers(): Observable<BlockedUser[]> {
    return this.http.get<BlockedUser[]>(`${this.baseUrl}/blocked`);
  }

  isUserBlocked(userId: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.baseUrl}/blocked/${userId}`);
  }

  // Mute functionality
  muteUser(mutedId: string, duration?: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/mute`, { mutedId, duration });
  }

  unmuteUser(mutedId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/mute/${mutedId}`);
  }

  getMutedUsers(): Observable<MutedUser[]> {
    return this.http.get<MutedUser[]>(`${this.baseUrl}/muted`);
  }

  // Report functionality
  reportContent(data: { contentType: 'post' | 'comment' | 'profile' | 'community' | 'message'; contentId: string; reason: string; description?: string }): Observable<ContentReport> {
    return this.http.post<ContentReport>(`${this.baseUrl}/report`, data);
  }

  getMyReports(): Observable<ContentReport[]> {
    return this.http.get<ContentReport[]>(`${this.baseUrl}/reports`);
  }
}
```

### Frontend Components

#### 4.3 Privacy Settings Page

**File: `apps/client-interface/src/app/components/settings/privacy-settings.component.ts`**

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ListComponent, ButtonComponent, BadgeComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { PrivacyService, BlockedUser, MutedUser } from '../../privacy.service';
import { ProfileService } from '../../profile.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [CommonModule, ListComponent, ButtonComponent, BadgeComponent, CardComponent],
  template: `
    <div class="privacy-settings">
      <h2>Privacy & Safety</h2>

      <!-- Blocked Users -->
      <section class="settings-section">
        <h3>Blocked Users</h3>
        <p class="section-description">Blocked users cannot see your posts, follow you, or send you messages.</p>
        @if (blockedUsers().length > 0) {
        <div class="user-list">
          @for (user of blockedUsers(); track user.id) {
          <div class="list-item">
            <img class="item-avatar" [src]="user.blockedAvatar || '/assets/default-avatar.png'" />
            <div class="item-content">
              <span class="item-title">{{ user.blockedName }}</span>
              <span class="item-subtitle">Blocked {{ user.createdAt | date : 'mediumDate' }}</span>
            </div>
            <button class="icon-button" (click)="unblockUser(user.blockedId)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>
          </div>
          }
        </div>
        } @else {
        <div class="empty-state">No blocked users</div>
        }
      </section>

      <!-- Muted Users -->
      <section class="settings-section">
        <h3>Muted Users</h3>
        <p class="section-description">Muted users' posts will be hidden from your feed but you can still see their messages.</p>
        @if (mutedUsers().length > 0) {
        <div class="user-list">
          @for (user of mutedUsers(); track user.id) {
          <div class="list-item">
            <img class="item-avatar" [src]="'/assets/default-avatar.png'" />
            <div class="item-content">
              <span class="item-title">{{ user.mutedName }}</span>
              <span class="item-subtitle">
                @if (user.expiresAt) { Muted until {{ user.expiresAt | date : 'medium' }}
                } @else { Muted indefinitely }
              </span>
            </div>
            <button class="icon-button" (click)="unmuteUser(user.mutedId)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </button>
          </div>
          }
        </div>
        } @else {
        <div class="empty-state">No muted users</div>
        }
      </section>

      <!-- Reports -->
      <section class="settings-section">
        <h3>My Reports</h3>
        <p class="section-description">Track the status of content you've reported.</p>
        @if (reports().length > 0) {
        <div class="user-list">
          @for (report of reports(); track report.id) {
          <div class="list-item">
            <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
              <line x1="4" y1="22" x2="4" y2="15"></line>
            </svg>
            <div class="item-content">
              <span class="item-title">Report #{{ report.id | slice : 0 : 8 }}</span>
              <span class="item-subtitle">{{ report.contentType }} - {{ report.reason }}</span>
            </div>
            <otui-badge [content]="report.status" [variant]="getStatusVariant(report.status)"></otui-badge>
          </div>
          }
        </div>
        } @else {
        <div class="empty-state">No reports submitted</div>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .privacy-settings {
        max-width: 800px;
        margin: 0 auto;
        padding: 24px;
      }
      .settings-section {
        margin-bottom: 32px;
      }
      h3 {
        margin-bottom: 8px;
      }
      .section-description {
        color: var(--muted);
        margin-bottom: 16px;
      }
      .empty-state {
        padding: 24px;
        text-align: center;
        background: var(--hover-bg);
        border-radius: 8px;
        color: var(--muted);
      }
      .pending {
        background: #fff3e0;
        color: #e65100;
      }
      .reviewed {
        background: #e3f2fd;
        color: #1565c0;
      }
      .actioned {
        background: #e8f5e9;
        color: #2e7d32;
      }
      .dismissed {
        background: #f5f5f5;
        color: #616161;
      }
    `,
  ],
})
export class PrivacySettingsComponent implements OnInit {
  private privacyService = inject(PrivacyService);
  private profileService = inject(ProfileService);
  private messageService = inject(MessageService);

  blockedUsers = signal<BlockedUser[]>([]);
  mutedUsers = signal<MutedUser[]>([]);
  reports = signal<any[]>([]);

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.privacyService.getBlockedUsers().subscribe({
      next: (users) => this.blockedUsers.set(users),
    });

    this.privacyService.getMutedUsers().subscribe({
      next: (users) => this.mutedUsers.set(users),
    });

    this.privacyService.getMyReports().subscribe({
      next: (reports) => this.reports.set(reports),
    });
  }

  unblockUser(userId: string) {
    this.privacyService.unblockUser(userId).subscribe({
      next: () => {
        this.blockedUsers.update((users) => users.filter((u) => u.blockedId !== userId));
        this.messageService.addMessage({ content: 'User unblocked', type: 'success' });
      },
      error: () => this.messageService.addMessage({ content: 'Failed to unblock user', type: 'error' }),
    });
  }

  unmuteUser(userId: string) {
    this.privacyService.unmuteUser(userId).subscribe({
      next: () => {
        this.mutedUsers.update((users) => users.filter((u) => u.mutedId !== userId));
        this.messageService.addMessage({ content: 'User unmuted', type: 'success' });
      },
    });
  }
}
```

#### 4.4 Report Content Dialog

**File: `apps/client-interface/src/app/components/report/report-dialog.component.ts`**

```typescript
import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, ModalComponent, InputComponent } from '@optimistic-tanuki/common-ui';
import { PrivacyService } from '../../privacy.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

@Component({
  selector: 'app-report-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, ModalComponent, InputComponent],
  template: `
    <otui-modal [open]="true" (close)="cancel()">
      <div class="dialog-header">
        <h2>Report {{ contentType }}</h2>
        <button class="close-button" (click)="cancel()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="dialog-content">
        <p>Why are you reporting this {{ contentType }}?</p>

        <div class="reason-options">
          @for (option of reasonOptions; track option.value) {
          <label class="radio-option" [class.selected]="reason === option.value">
            <input type="radio" name="reason" [value]="option.value" [(ngModel)]="reason" />
            <span class="radio-label">{{ option.label }}</span>
          </label>
          }
        </div>

        <div class="form-field">
          <label class="field-label">Additional details (optional)</label>
          <textarea [(ngModel)]="description" rows="4" placeholder="Provide more context..." class="text-area"></textarea>
        </div>
      </div>

      <div class="dialog-actions">
        <otui-button variant="text" (click)="cancel()">Cancel</otui-button>
        <otui-button variant="primary" (click)="submit()" [disabled]="!reason">Submit Report</otui-button>
      </div>
    </otui-modal>
  `,
  styles: [
    `
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        h2 {
          margin: 0;
          font-size: 18px;
        }
      }
      .close-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.2s;
        &:hover {
          background: var(--hover-bg);
        }
        svg {
          width: 20px;
          height: 20px;
        }
      }
      .dialog-content {
        padding: 20px;
      }
      .reason-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 16px 0;
      }
      .radio-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border: 1px solid var(--border);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          border-color: var(--primary);
        }
        &.selected {
          border-color: var(--primary);
          background: var(--primary-alpha);
        }

        input {
          display: none;
        }
        .radio-label {
          flex: 1;
        }
      }
      .form-field {
        margin-top: 16px;
      }
      .field-label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 500;
      }
      .text-area {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        color: var(--foreground);
        font-size: 14px;
        font-family: inherit;
        resize: vertical;

        &:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-alpha);
        }
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 20px;
        border-top: 1px solid var(--border);
      }
    `,
  ],
})
export class ReportDialogComponent {
  @Input() contentType: 'post' | 'comment' | 'profile' | 'community' | 'message' = 'post';
  @Input() contentId!: string;
  @Output() closeDialog = new EventEmitter<void>();

  private privacyService = inject(PrivacyService);
  private messageService = inject(MessageService);

  reason = '';
  description = '';

  reasonOptions = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'hate_speech', label: 'Hate speech' },
    { value: 'violence', label: 'Violence' },
    { value: 'misinformation', label: 'Misinformation' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'other', label: 'Other' },
  ];

  submit() {
    this.privacyService
      .reportContent({
        contentType: this.contentType,
        contentId: this.contentId,
        reason: this.reason,
        description: this.description,
      })
      .subscribe({
        next: () => {
          this.messageService.addMessage({
            content: 'Report submitted. Thank you for helping keep our community safe.',
            type: 'success',
          });
          this.cancel();
        },
        error: () =>
          this.messageService.addMessage({
            content: 'Failed to submit report. Please try again.',
            type: 'error',
          }),
      });
  }

  cancel() {
    this.closeDialog.emit();
  }
}
```

### Route and Integration

**File: `apps/client-interface/src/app/app.routes.ts`**

```typescript
{
  path: 'settings/privacy',
  loadComponent: () =>
    import('./components/settings/privacy-settings.component').then(
      (m) => m.PrivacySettingsComponent
    ),
  canActivate: [AuthGuard],
},
```

Add report button to post/component menus:

```typescript
// In feed.component.ts or post component
openReportDialog(postId: string) {
  const dialogRef = this.dialog.open(ReportDialogComponent, {
    data: { contentType: 'post', contentId: postId }
  });
}
```

---

## 5. User Activity & History

### Overview

Add activity tracking and history features so users can see their past interactions and manage saved content.

### Backend Requirements

#### 5.1 Activity Service

**File: `apps/social/src/app/services/activity.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ActivityItem {
  id: string;
  type: 'post' | 'comment' | 'like' | 'share' | 'follow' | 'mention';
  description: string;
  resourceId: string;
  resourceType: string;
  createdAt: Date;
}

export interface SavedItem {
  id: string;
  itemType: 'post' | 'comment';
  itemId: string;
  itemTitle?: string;
  savedAt: Date;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private baseUrl = '/api/activity';

  getUserActivity(
    profileId: string,
    options?: {
      type?: string;
      limit?: number;
      offset?: number;
    }
  ): Observable<ActivityItem[]> {
    const params = new HttpParams()
      .set('type', options?.type || '')
      .set('limit', options?.limit?.toString() || '50')
      .set('offset', options?.offset?.toString() || '0');

    return this.http.get<ActivityItem[]>(`${this.baseUrl}/${profileId}`, { params });
  }

  getSavedItems(profileId: string): Observable<SavedItem[]> {
    return this.http.get<SavedItem[]>(`${this.baseUrl}/${profileId}/saved`);
  }

  saveItem(profileId: string, itemType: 'post' | 'comment', itemId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${profileId}/saved`, { itemType, itemId });
  }

  unsaveItem(profileId: string, itemId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${profileId}/saved/${itemId}`);
  }

  isSaved(profileId: string, itemId: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.baseUrl}/${profileId}/saved/${itemId}`);
  }
}
```

### Frontend Components

#### 5.2 Activity Page Component

**File: `apps/client-interface/src/app/components/activity/activity-page.component.ts`**

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TabsComponent, ListComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { ActivityService, ActivityItem, SavedItem } from '../../activity.service';
import { ProfileService } from '../../profile.service';

@Component({
  selector: 'app-activity-page',
  standalone: true,
  imports: [CommonModule, RouterModule, TabsComponent, ListComponent, ButtonComponent],
  template: `
    <div class="activity-page">
      <header class="page-header">
        <h1>Activity</h1>
        <p>Your posts, likes, comments, and more</p>
      </header>

      <otui-tabs [tabs]="tabOptions" [activeTab]="activeTab()" (tabChange)="onTabChange($event)">
        <div class="activity-list">
          @for (activity of filteredActivities(); track activity.id) {
          <div class="activity-item" (click)="navigateTo(activity)">
            <div class="activity-icon" [class]="activity.type">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" [attr.stroke-width]="2">
                @switch (activity.type) { @case ('post') {
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                } @case ('comment') {
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                } @case ('like') {
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                } @case ('follow') {
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
                } @case ('mention') {
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
                } }
              </svg>
            </div>
            <div class="activity-content">
              <span class="activity-description">{{ activity.description }}</span>
              <span class="activity-time">{{ activity.createdAt | date : 'medium' }}</span>
            </div>
            <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
          } @empty {
          <div class="empty-state">No activity yet</div>
          }
        </div>

        <div class="saved-list">
          @for (item of savedItems(); track item.id) {
          <div class="saved-item" (click)="navigateToSaved(item)">
            <svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
            <div class="item-content">
              <span class="item-title">{{ item.itemTitle || 'Saved ' + item.itemType }}</span>
              <span class="item-time">Saved {{ item.savedAt | date : 'mediumDate' }}</span>
            </div>
            <button class="icon-button" (click)="unsaveItem(item, $event)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
          </div>
          } @empty {
          <div class="empty-state">No saved items</div>
          }
        </div>
      </otui-tabs>
    </div>
  `,
  styles: [
    `
      .activity-page {
        max-width: 800px;
        margin: 0 auto;
        padding: 24px;
      }
      .page-header {
        margin-bottom: 24px;
        h1 {
          margin-bottom: 8px;
        }
        p {
          color: var(--muted);
        }
      }
      .activity-list {
        padding-top: 0;
      }
      .activity-item {
        border-bottom: 1px solid var(--border);
      }
      .activity-icon {
        &.post {
          color: #2196f3;
        }
        &.comment {
          color: #4caf50;
        }
        &.like {
          color: #f44336;
        }
        &.follow {
          color: #9c27b0;
        }
      }
      .empty-state {
        padding: 48px;
        text-align: center;
        color: var(--muted);
      }
    `,
  ],
})
export class ActivityPageComponent implements OnInit {
  private activityService = inject(ActivityService);
  private profileService = inject(ProfileService);

  activities = signal<ActivityItem[]>([]);
  savedItems = signal<SavedItem[]>([]);

  ngOnInit() {
    const profile = this.profileService.getCurrentUserProfile();
    if (profile) {
      this.loadActivity(profile.id);
      this.loadSavedItems(profile.id);
    }
  }

  private loadActivity(profileId: string) {
    this.activityService.getUserActivity(profileId).subscribe({
      next: (activities) => this.activities.set(activities),
    });
  }

  private loadSavedItems(profileId: string) {
    this.activityService.getSavedItems(profileId).subscribe({
      next: (items) => this.savedItems.set(items),
    });
  }

  getActivityIcon(type: string): string {
    const icons: Record<string, string> = {
      post: 'article',
      comment: 'comment',
      like: 'favorite',
      share: 'share',
      follow: 'person_add',
      mention: 'alternate_email',
    };
    return icons[type] || 'circle';
  }

  getActivityLink(activity: ActivityItem): string[] {
    if (activity.resourceType === 'post') {
      return ['/feed/post', activity.resourceId];
    }
    return ['/feed'];
  }

  unsaveItem(item: SavedItem, event: Event) {
    event.stopPropagation();
    const profile = this.profileService.getCurrentUserProfile();
    if (profile) {
      this.activityService.unsaveItem(profile.id, item.itemId).subscribe({
        next: () => this.savedItems.update((items) => items.filter((i) => i.id !== item.id)),
      });
    }
  }
}
```

#### 5.3 Add Save Button to Posts

In `feed.component.ts`, add a save/bookmark button to each post:

```typescript
// Add to feed.component.ts
isSavedPost(postId: string): boolean {
  return this.savedPostIds.has(postId);
}

toggleSavePost(post: PostDto) {
  const profile = this.profileService.getCurrentUserProfile();
  if (!profile) return;

  if (this.isSavedPost(post.id)) {
    this.activityService.unsaveItem(profile.id, post.id).subscribe({
      next: () => {
        this.savedPostIds.delete(post.id);
        this.messageService.addMessage({ content: 'Post unsaved', type: 'info' });
      }
    });
  } else {
    this.activityService.saveItem(profile.id, 'post', post.id).subscribe({
      next: () => {
        this.savedPostIds.add(post.id);
        this.messageService.addMessage({ content: 'Post saved', type: 'success' });
      }
    });
  }
}
```

### Route Addition

**File: `apps/client-interface/src/app/app.routes.ts`**

```typescript
{
  path: 'activity',
  loadComponent: () =>
    import('./components/activity/activity-page.component').then(
      (m) => m.ActivityPageComponent
    ),
  canActivate: [AuthGuard, ProfileGuard],
},
```

---

## 6. Profile Enhancements

### Overview

Add profile views analytics, enhanced profile editing, and verification badges.

### Backend Requirements

#### 6.1 Profile Views Tracking

**File: `apps/social/src/entities/profile-view.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity()
@Index(['profileId', 'viewedAt'])
export class ProfileView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  profileId: string;

  @Column()
  viewerId: string;

  @Column()
  source: string; // 'feed', 'search', 'profile', 'direct'

  @CreateDateColumn()
  viewedAt: Date;
}
```

**File: `apps/social/src/app/services/profile-analytics.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProfileViewStats {
  totalViews: number;
  viewsToday: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  topSources: { source: string; count: number }[];
  recentViews: { viewerId: string; viewerName: string; viewedAt: Date }[];
}

@Injectable({ providedIn: 'root' })
export class ProfileAnalyticsService {
  private baseUrl = '/api/profile-analytics';

  getViewStats(profileId: string): Observable<ProfileViewStats> {
    return this.http.get<ProfileViewStats>(`${this.baseUrl}/${profileId}/views`);
  }

  recordView(profileId: string, source: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/record-view`, { profileId, source });
  }

  getProfileViews(profileId: string, limit: number = 20): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${profileId}/views`, {
      params: { limit: limit.toString() },
    });
  }
}
```

### Frontend Components

#### 6.2 Enhanced Profile View with Analytics

**File: `apps/client-interface/src/app/components/profile/profile-view.component.ts`**

```typescript
import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CardComponent, ButtonComponent, TabsComponent } from '@optimistic-tanuki/common-ui';
import { ProfileService } from '../../profile.service';
import { ProfileAnalyticsService, ProfileViewStats } from '../../profile-analytics.service';
import { FollowService } from '../../follow.service';
import { BannerComponent } from '@optimistic-tanuki/profile-ui';

@Component({
  selector: 'app-profile-view',
  standalone: true,
  imports: [CommonModule, RouterModule, CardComponent, ButtonComponent, TabsComponent, BannerComponent],
  template: `
    <div class="profile-view">
      <lib-banner [profileName]="profile()?.profileName || ''" [profileImage]="profile()?.profilePic" [backgroundImage]="profile()?.coverPic"></lib-banner>

      <div class="profile-header">
        <div class="profile-info">
          <h1>
            {{ profile()?.profileName }}
            @if (profile()?.isVerified) {
            <svg class="verified-badge" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            }
          </h1>
          <p class="bio">{{ profile()?.bio }}</p>
          <div class="profile-meta">
            @if (profile()?.location) {
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {{ profile()?.location }}
            </span>
            } @if (profile()?.occupation) {
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
              {{ profile()?.occupation }}
            </span>
            }
          </div>
        </div>

        <div class="profile-actions">
          @if (!isOwnProfile()) {
          <otui-button variant="outlined" (click)="messageUser()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Message
          </otui-button>
          <otui-button [variant]="isFollowing() ? 'primary' : 'primary'" (click)="toggleFollow()">
            {{ isFollowing() ? 'Unfollow' : 'Follow' }}
          </otui-button>
          } @else {
          <otui-button variant="outlined" routerLink="/settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit Profile
          </otui-button>
          }
        </div>
      </div>

      <!-- Profile Stats -->
      <div class="profile-stats">
        <div class="stat">
          <span class="stat-value">{{ profileStats()?.totalViews || 0 }}</span>
          <span class="stat-label">Profile Views</span>
        </div>
        <div class="stat clickable" routerLink="/profile/{{ profileId }}/followers">
          <span class="stat-value">{{ followerCount() }}</span>
          <span class="stat-label">Followers</span>
        </div>
        <div class="stat clickable" routerLink="/profile/{{ profileId }}/following">
          <span class="stat-value">{{ followingCount() }}</span>
          <span class="stat-label">Following</span>
        </div>
      </div>

      @if (isOwnProfile() && viewStats()) {
      <otui-card class="analytics-card">
        <div class="card-header">
          <h3>Profile Analytics</h3>
        </div>
        <div class="card-content">
          <div class="analytics-grid">
            <div class="analytics-stat">
              <span class="value">{{ viewStats()?.viewsToday || 0 }}</span>
              <span class="label">Views Today</span>
            </div>
            <div class="analytics-stat">
              <span class="value">{{ viewStats()?.viewsThisWeek || 0 }}</span>
              <span class="label">This Week</span>
            </div>
            <div class="analytics-stat">
              <span class="value">{{ viewStats()?.viewsThisMonth || 0 }}</span>
              <span class="label">This Month</span>
            </div>
          </div>
        </div>
      </otui-card>
      }

      <otui-tabs [tabs]="profileTabs" [activeTab]="activeTab()" (tabChange)="onTabChange($event)">
        <div class="tab-content" *ngIf="activeTab() === 'posts'">
          <!-- User's posts grid -->
        </div>
        <div class="tab-content" *ngIf="activeTab() === 'media'">
          <!-- User's media gallery -->
        </div>
        <div class="tab-content" *ngIf="activeTab() === 'likes'">
          <!-- Posts user has liked -->
        </div>
      </otui-tabs>
    </div>
  `,
  styles: [
    `
    .profile-view { max-width: 900px; margin: 0 auto; }
    .profile-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 16px; margin-top: -40px;
    }
    .profile-info { flex: 1; h1 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; } }
    .verified-badge { color: #2196f3; width: 20px; height: 20px; }
    .bio { color: var(--muted); margin-bottom: 12px; }
    .profile-meta {
      display: flex; gap: 16px;
      span { display: flex; align-items: center; gap: 4px; font-size: 14px; color: var(--muted); }
      svg { width: 16px; height: 16px; }
    }
    .profile-actions { display: flex; gap: 8px; }
    .profile-stats {
      display: flex; gap: 32px; padding: 16px; border-bottom: 1px solid var(--border);
      .stat { text-align: center; &.clickable { cursor: pointer; &:hover { color: var(--primary); } } }
      .stat-value { display: block; font-size: 20px; font-weight: 600; }
        }
        .stat-label {
          font-size: 12px;
          color: var(--muted);
        }
      }
      .analytics-card {
        margin: 16px;
      }
      .analytics-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        text-align: center;
      }
      .analytics-stat {
        .value {
          display: block;
          font-size: 24px;
          font-weight: 600;
        }
        .label {
          font-size: 12px;
          color: var(--muted);
        }
      }
    `,
  ],
})
export class ProfileViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private profileService = inject(ProfileService);
  private analyticsService = inject(ProfileAnalyticsService);
  private followService = inject(FollowService);

  profileId!: string;
  profile = signal<any>(null);
  viewStats = signal<ProfileViewStats | null>(null);
  isFollowing = signal(false);
  followerCount = signal(0);
  followingCount = signal(0);

  isOwnProfile(): boolean {
    const current = this.profileService.getCurrentUserProfile();
    return current?.id === this.profileId;
  }

  ngOnInit() {
    this.profileId = this.route.snapshot.paramMap.get('id') || '';
    this.loadProfile();
    this.loadStats();
  }

  private loadProfile() {
    this.profileService.getProfileById(this.profileId).subscribe({
      next: (profile) => this.profile.set(profile),
    });
  }

  private loadStats() {
    this.analyticsService.getViewStats(this.profileId).subscribe({
      next: (stats) => this.viewStats.set(stats),
    });

    this.followService.getFollowers(this.profileId).subscribe({
      next: (followers) => this.followerCount.set(followers.length),
    });

    this.followService.getFollowing(this.profileId).subscribe({
      next: (following) => this.followingCount.set(following.length),
    });
  }

  toggleFollow() {
    // Implement follow/unfollow
  }

  messageUser() {
    // Open message conversation
  }
}
```

### Route Addition

**File: `apps/client-interface/src/app/app.routes.ts`**

```typescript
{
  path: 'profile/:id',
  loadComponent: () =>
    import('./components/profile/profile-view.component').then(
      (m) => m.ProfileViewComponent
    ),
  canActivate: [AuthGuard],
},
```

---

## 7. Content Features

### Overview

Add advanced content types: polls/surveys, events, post sharing, and scheduled posts.

### Backend Requirements

#### 7.1 Poll Entity

**File: `apps/social/src/entities/poll.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Post } from './post.entity';

@Entity()
export class Poll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  question: string;

  @Column('simple-array')
  options: string[];

  @Column('simple-array', { nullable: true })
  votes: string[]; // JSON: [{ optionIndex: number, userId: string }]

  @Column({ default: false })
  isMultipleChoice: boolean;

  @Column({ nullable: true })
  endsAt: Date;

  @Column({ default: true })
  showResultsBeforeVote: boolean;

  @Column({ default: false })
  isAnonymous: boolean;

  @OneToMany(() => Post, (post) => post.poll)
  posts: Post[];
}
```

#### 7.2 Post Share Entity

**File: `apps/social/src/entities/post-share.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Profile } from './profile.entity';
import { Post } from './post.entity';

@Entity()
export class PostShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalPostId: string;

  @ManyToOne(() => Post)
  originalPost: Post;

  @Column()
  sharedById: string;

  @ManyToOne(() => Profile)
  sharedBy: Profile;

  @Column({ nullable: true })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

### Frontend Components

#### 7.3 Poll Composer

**File: `apps/client-interface/src/app/components/compose/poll-composer.component.ts`**

```typescript
import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, InputComponent, CheckboxComponent } from '@optimistic-tanuki/common-ui';

export interface PollData {
  question: string;
  options: string[];
  isMultipleChoice: boolean;
  endsAt?: Date;
  showResultsBeforeVote: boolean;
  isAnonymous: boolean;
}

@Component({
  selector: 'app-poll-composer',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, InputComponent, CheckboxComponent],
  template: `
    <div class="poll-composer">
      <otui-input
        label="Question"
        [placeholder]="'Ask a question...'"
        [(value)]="question"
      ></otui-input>

      <div class="options">
        @for (option of options(); track $index; let i = $index) {
          <div class="option-row">
            <otui-input
              [label]="'Option ' + (i + 1)"
              [placeholder]="'Option ' + (i + 1)"
              [(value)]="options()[i]"
            ></otui-input>
            @if (options().length > 2) {
              <button class="icon-button remove-btn" (click)="removeOption(i)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6 6 18M6 6l12 12"></path>
                </svg>
              </button>
            }
          </div>
        } @if (options().length < 6) {
          <button class="text-button" (click)="addOption()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Option
          </button>
        }
      </div>

      <div class="poll-settings">
        <label class="checkbox-label">
          <input type="checkbox" [(ngModel)]="isMultipleChoice" />
          <span>Allow multiple choices</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" [(ngModel)]="showResultsBeforeVote" />
          <span>Show results before voting</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" [(ngModel)]="isAnonymous" />
          <span>Anonymous poll</span>
        </label>
      </div>

      <div class="actions">
        <otui-button variant="primary" (click)="createPoll()" [disabled]="!isValid()">Create Poll</otui-button>
      </div>
    </div>
  `,
  styles: [`
    .poll-composer { padding: 16px; }
    .full-width { width: 100%; }
    .options { margin-bottom: 16px; }
    .option-row { margin-bottom: 8px; display: flex; align-items: flex-end; gap: 8px; }
    .icon-button {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px;
      border: none; background: transparent;
      border-radius: 50%; cursor: pointer;
      transition: background 0.2s;
      &:hover { background: var(--hover-bg); }
      svg { width: 20px; height: 20px; }
    }
    .text-button {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px;
      border: none; background: transparent;
      color: var(--primary); cursor: pointer;
      font-size: 14px;
      svg { width: 16px; height: 16px; }
    }
    .poll-settings { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .checkbox-label {
      display: flex; align-items: center; gap: 8px;
      cursor: pointer;
      input { width: 16px; height: 16px; }
    }
  `]
})
export class PollComposerComponent {
      .poll-settings {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 16px;
      }
    `,
  ],
})
export class PollComposerComponent {
  @Output() pollCreated = new EventEmitter<PollData>();

  question = signal('');
  options = signal<string[]>(['', '']);
  isMultipleChoice = signal(false);
  endsAt: Date | null = null;
  showResultsBeforeVote = signal(true);
  isAnonymous = signal(false);

  addOption() {
    this.options.update((opts) => [...opts, '']);
  }

  removeOption(index: number) {
    this.options.update((opts) => opts.filter((_, i) => i !== index));
  }

  isValid(): boolean {
    return this.question().trim().length > 0 && this.options().filter((o) => o.trim()).length >= 2;
  }

  createPoll() {
    if (!this.isValid()) return;

    this.pollCreated.emit({
      question: this.question(),
      options: this.options().filter((o) => o.trim()),
      isMultipleChoice: this.isMultipleChoice(),
      endsAt: this.endsAt || undefined,
      showResultsBeforeVote: this.showResultsBeforeVote(),
      isAnonymous: this.isAnonymous(),
    });
  }
}
```

#### 7.4 Share Post Component

**File: `apps/client-interface/src/app/components/post/share-post.component.ts`**

```typescript
import { Component, inject, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent, ButtonComponent, InputComponent } from '@optimistic-tanuki/common-ui';
import { PostService } from '../../post.service';
import { ProfileService } from '../../profile.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

@Component({
  selector: 'app-share-post',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ButtonComponent, InputComponent],
  template: `
    <otui-modal [open]="true" (close)="cancel()">
      <div class="dialog-header">
        <h2>Share Post</h2>
        <button class="close-button" (click)="cancel()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="dialog-content">
        <div class="original-post-preview">
          <p class="original-author">{{ originalPost()?.profile?.profileName }}</p>
          <p class="original-content">{{ originalPost()?.content?.substring(0, 200) }}...</p>
        </div>

        <div class="form-field">
          <label>Add a comment (optional)</label>
          <textarea [(ngModel)]="comment" rows="3" placeholder="Add a comment..." class="text-area"></textarea>
        </div>

        <div class="visibility-options">
          <label>Share with:</label>
          <div class="radio-group">
            <label class="radio-option" [class.selected]="visibility() === 'public'">
              <input type="radio" name="visibility" value="public" [(ngModel)]="visibilityValue" />
              <span>Public</span>
            </label>
            <label class="radio-option" [class.selected]="visibility() === 'followers'">
              <input type="radio" name="visibility" value="followers" [(ngModel)]="visibilityValue" />
              <span>Followers</span>
            </label>
            <label class="radio-option" [class.selected]="visibility() === 'community'">
              <input type="radio" name="visibility" value="community" [(ngModel)]="visibilityValue" />
              <span>Community</span>
            </label>
          </div>
        </div>
      </div>

      <div class="dialog-actions">
        <otui-button variant="text" (click)="cancel()">Cancel</otui-button>
        <otui-button variant="primary" (click)="share()" [disabled]="isSharing()">
          {{ isSharing() ? 'Sharing...' : 'Share' }}
        </otui-button>
      </div>
    </otui-modal>
  `,
  styles: [
    `
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        h2 {
          margin: 0;
          font-size: 18px;
        }
      }
      .close-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.2s;
        &:hover {
          background: var(--hover-bg);
        }
        svg {
          width: 20px;
          height: 20px;
        }
      }
      .dialog-content {
        padding: 20px;
      }
      .original-post-preview {
        background: var(--hover-bg);
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 16px;
        .original-author {
          font-weight: 600;
          margin-bottom: 4px;
        }
        .original-content {
          font-size: 14px;
          color: var(--muted);
          margin: 0;
        }
      }
      .form-field {
        margin-bottom: 16px;
        label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
        }
      }
      .text-area {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        color: var(--foreground);
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        &:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--primary-alpha);
        }
      }
      .visibility-options {
        margin-top: 16px;
        label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
        }
      }
      .radio-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .radio-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border: 1px solid var(--border);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        &:hover {
          border-color: var(--primary);
        }
        &.selected {
          border-color: var(--primary);
          background: var(--primary-alpha);
        }
        input {
          display: none;
        }
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 20px;
        border-top: 1px solid var(--border);
      }
    `,
  ],
})
export class SharePostComponent {
  @Input() postId!: string;
  originalPost = signal<any>(null);

  private postService = inject(PostService);
  private profileService = inject(ProfileService);
  private messageService = inject(MessageService);
  private dialogRef = inject(MatDialogRef<SharePostComponent>);

  comment = signal('');
  visibility = signal('public');
  isSharing = signal(false);

  ngOnInit() {
    this.loadOriginalPost();
  }

  private loadOriginalPost() {
    this.postService.getPost(this.postId).subscribe({
      next: (post) => this.originalPost.set(post),
    });
  }

  share() {
    this.isSharing.set(true);
    const profile = this.profileService.getCurrentUserProfile();
    if (!profile) return;

    this.postService
      .sharePost({
        originalPostId: this.postId,
        sharedById: profile.id,
        comment: this.comment(),
        visibility: this.visibility(),
      })
      .subscribe({
        next: () => {
          this.messageService.addMessage({ content: 'Post shared!', type: 'success' });
          this.dialogRef.close(true);
        },
        error: () => {
          this.messageService.addMessage({ content: 'Failed to share post', type: 'error' });
          this.isSharing.set(false);
        },
      });
  }

  cancel() {
    this.dialogRef.close();
  }
}
```

---

## 8. UI/UX Polish

### Overview

Improve the overall user experience with better toolbar, navigation, loading states, and mobile responsiveness.

### 8.1 Enhanced Toolbar with Notification Bell

**File: `apps/client-interface/src/app/components/toolbar/toolbar.component.ts`**

```typescript
import { Component, inject, signal, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonComponent, BadgeComponent, DropdownComponent } from '@optimistic-tanuki/common-ui';
import { NotificationBellComponent } from '../notifications/notification-bell.component';
import { GlobalSearchComponent } from '../search/global-search.component';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonComponent, BadgeComponent, DropdownComponent, NotificationBellComponent, GlobalSearchComponent],
  template: `
    <header class="toolbar">
      <div class="toolbar-brand" routerLink="/feed">
        <svg class="logo" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
        <span class="brand-name">SocialApp</span>
      </div>

      <div class="toolbar-search">
        <app-global-search></app-global-search>
      </div>

      <div class="toolbar-actions">
        <app-notification-bell></app-notification-bell>

        <div class="icon-button-wrapper">
          <button class="icon-button" routerLink="/messages">
            @if (unreadMessages() > 0) {
            <otui-badge [content]="unreadMessages()" variant="error"></otui-badge>
            }
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
        </div>

        <otui-dropdown [triggerLabel]="''">
          <button class="user-avatar-btn" dropdown-trigger>
            <img [src]="currentProfile()?.profilePic || '/assets/default-avatar.png'" class="avatar" alt="Profile" />
          </button>
          <div class="dropdown-menu">
            <a class="dropdown-item" routerLink="/profile/{{ currentProfile()?.id }}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Profile
            </a>
            <a class="dropdown-item" routerLink="/activity">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              Activity
            </a>
            <a class="dropdown-item" routerLink="/settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              Settings
            </a>
            <a class="dropdown-item" routerLink="/settings/privacy">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              Privacy
            </a>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item logout" (click)="logout()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </button>
          </div>
        </otui-dropdown>
      </div>
    </header>
  `,
  styles: [
    `
      .toolbar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 16px;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 100;
      }
      .toolbar-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        .logo {
          font-size: 28px;
          width: 28px;
          height: 28px;
          color: var(--primary);
        }
        .brand-name {
          font-size: 20px;
          font-weight: 700;
        }
      }
      .toolbar-search {
        flex: 1;
        max-width: 500px;
      }
      .toolbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .user-avatar-btn {
        padding: 0;
        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }
      }
    `,
  ],
})
export class ToolbarComponent {
  @Input() currentProfile: () => ProfileDto | null = () => null;
  @Input() unreadMessages: () => number = () => 0;
  @Output() logoutEvent = new EventEmitter<void>();

  logout() {
    this.logoutEvent.emit();
  }
}
```

#### 8.2 Update App Component to Use New Toolbar

**File: `apps/client-interface/src/app/app.component.ts`** (updated)

```typescript
// Replace existing toolbar with new enhanced version
import { ToolbarComponent } from './components/toolbar/toolbar.component';

// Add to imports array
imports: [
  // ... other imports
  ToolbarComponent,
];

// Update template to use new toolbar
// In app.component.html or inline template:
// <app-toolbar
//   [currentProfile]="currentProfile"
//   [unreadMessages]="unreadMessagesCount"
//   (logoutEvent)="loginOutButton()"
// ></app-toolbar>
```

### 8.3 Loading States and Empty States

Add reusable components for consistent loading and empty states:

**File: `apps/client-interface/src/app/components/common/loading-empty.component.ts`**

```typescript
import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpinnerComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [CommonModule, SpinnerComponent],
  template: `
    <div class="loading-container" [class.overlay]="overlay()">
      <otui-spinner [diameter]="diameter()"></otui-spinner>
      @if (message()) {
      <p class="loading-message">{{ message() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        &.overlay {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.8);
        }
      }
      .loading-message {
        margin-top: 16px;
        color: var(--muted);
      }
    `,
  ],
})
export class LoadingStateComponent {
  @Input() diameter = signal(40);
  @Input() message = signal('');
  @Input() overlay = signal(false);
}

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, SpinnerComponent, ButtonComponent],
  template: `
    <div class="empty-container">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        @switch (icon()) { @case ('inbox') {
        <path d="M22 12h-6l-2 3h-4l-2-3H2"></path>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
        } @case ('search') {
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
        } @case ('notification') {
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        } @default {
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
        } }
      </svg>
      <h3>{{ title() }}</h3>
      @if (message()) {
      <p class="empty-message">{{ message() }}</p>
      } @if (actionLabel()) {
      <otui-button variant="primary" (click)="action()">{{ actionLabel() }}</otui-button>
      }
    </div>
  `,
  styles: [
    `
      .empty-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        text-align: center;
      }
      .empty-icon {
        opacity: 0.5;
      }
      h3 {
        margin: 16px 0 8px;
      }
      .empty-message {
        color: var(--muted);
        margin-bottom: 16px;
        max-width: 300px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() icon = signal('inbox');
  @Input() title = signal('Nothing here yet');
  @Input() message = signal('');
  @Input() actionLabel = signal('');
  @Input() action: () => void = () => {};
}
```

---

## 9. Performance Optimization

### Overview

Implement infinite scroll, virtual scrolling, and image optimization for better performance.

### 9.1 Infinite Scroll Directive

**File: `apps/client-interface/src/app/directives/infinite-scroll.directive.ts`**

```typescript
import { Directive, ElementRef, Output, EventEmitter, OnInit, OnDestroy, Input } from '@angular/core';

@Directive({
  selector: '[appInfiniteScroll]',
  standalone: true,
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  @Input() scrollThreshold = 200;
  @Input() disabled = false;
  @Output() scrolled = new EventEmitter<void>();

  private observer!: IntersectionObserver;

  constructor(private el: ElementRef) {}

  ngOnInit() {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.disabled) {
          this.scrolled.emit();
        }
      },
      { rootMargin: `${this.scrollThreshold}px` }
    );

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
```

### 9.2 Infinite Scroll Feed Implementation

**File: `apps/client-interface/src/app/components/social/infinite-feed.component.ts`**

```typescript
import { Component, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';
import { PostService } from '../../post.service';
import { PostDto } from '@optimistic-tanuki/social-ui';

@Component({
  selector: 'app-infinite-feed',
  standalone: true,
  imports: [CommonModule, InfiniteScrollDirective],
  template: `
    <div class="feed-container">
      @for (post of posts(); track post.id) {
      <ng-container *ngTemplateOutlet="postTemplate; context: { $implicit: post }"></ng-container>
      }

      <div appInfiniteScroll [disabled]="isLoading() || hasMore() === false" (scrolled)="loadMore()" class="scroll-trigger">
        @if (isLoading()) {
        <div class="loading-indicator">Loading more posts...</div>
        } @if (hasMore() === false && posts().length > 0) {
        <div class="end-message">You've reached the end</div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .privacy-settings { max-width: 800px; margin: 0 auto; padding: 24px; }
      .settings-section { margin-bottom: 32px; }
      h3 { margin-bottom: 8px; }
      .section-description { color: var(--muted); margin-bottom: 16px; }
      .user-list { display: flex; flex-direction: column; gap: 8px; }
      .list-item {
        display: flex; align-items: center; gap: 12px;
        padding: 12px 16px;
        background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
      }
      .item-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
      .item-icon { width: 24px; height: 24px; color: var(--muted); }
      .item-content { flex: 1; display: flex; flex-direction: column; }
      .item-title { font-weight: 500; }
      .item-subtitle { font-size: 12px; color: var(--muted); }
      .icon-button {
        display: flex; align-items: center; justify-content: center;
        width: 36px; height: 36px;
        border: none; background: transparent;
        border-radius: 50%; cursor: pointer;
        transition: background 0.2s;
        &:hover { background: var(--hover-bg); }
        svg { width: 20px; height: 20px; }
      }
      .empty-state {
        padding: 24px; text-align: center;
        background: var(--hover-bg); border-radius: 8px;
        color: var(--muted);
      }
    `,
  ]
})
export class PrivacySettingsComponent implements OnInit {
  private privacyService = inject(PrivacyService);
  private profileService = inject(ProfileService);
  private messageService = inject(MessageService);

  blockedUsers = signal<BlockedUser[]>([]);
  mutedUsers = signal<MutedUser[]>([]);
  reports = signal<any[]>([]);

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.privacyService.getBlockedUsers().subscribe({
      next: (users) => this.blockedUsers.set(users)
    });

    this.privacyService.getMutedUsers().subscribe({
      next: (users) => this.mutedUsers.set(users)
    });

    this.privacyService.getMyReports().subscribe({
      next: (reports) => this.reports.set(reports)
    });
  }

  getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'info' {
    const variants: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
      pending: 'warning',
      reviewed: 'info',
      actioned: 'success',
      dismissed: 'error'
    };
    return variants[status] || 'info';
  }

  unblockUser(userId: string) {
    this.privacyService.unblockUser(userId).subscribe({
      next: () => {
        this.blockedUsers.update(users => users.filter(u => u.blockedId !== userId));
        this.messageService.addMessage({ content: 'User unblocked', type: 'success' });
      },
      error: () => this.messageService.addMessage({ content: 'Failed to unblock user', type: 'error' })
    });
  }

  unmuteUser(userId: string) {
    this.privacyService.unmuteUser(userId).subscribe({
      next: () => {
        this.mutedUsers.update(users => users.filter(u => u.mutedId !== userId));
        this.messageService.addMessage({ content: 'User unmuted', type: 'success' });
      }
    });
  }
}
      .scroll-trigger {
        height: 1px;
      }
      .loading-indicator,
      .end-message {
        text-align: center;
        padding: 24px;
        color: var(--muted);
      }
    `,
  ],
})
export class InfiniteFeedComponent {
  @ViewChild(InfiniteScrollDirective) scrollDirective!: InfiniteScrollDirective;

  private postService = inject(PostService);

  posts = signal<PostDto[]>([]);
  isLoading = signal(false);
  hasMore = signal(true);
  private page = 0;
  private pageSize = 20;

  loadMore() {
    if (this.isLoading() || !this.hasMore()) return;

    this.isLoading.set(true);
    this.page++;

    this.postService
      .searchPosts(
        {},
        {
          orderBy: 'createdAt',
          orderDirection: 'desc',
          limit: this.pageSize,
          offset: this.page * this.pageSize,
        }
      )
      .subscribe({
        next: (newPosts) => {
          if (newPosts.length < this.pageSize) {
            this.hasMore.set(false);
          }
          this.posts.update((current) => [...current, ...newPosts]);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.page--;
        },
      });
  }

  // Use in parent component to set initial posts
  setInitialPosts(posts: PostDto[]) {
    this.posts.set(posts);
    this.hasMore.set(posts.length >= this.pageSize);
  }
}
```

### 9.3 Image Lazy Loading

Add lazy loading to all images in the app:

```html
<!-- Use loading="lazy" on all img tags -->
<img [src]="imageUrl" loading="lazy" alt="..." />

<!-- Or create a directive -->
<img appLazyLoad [src]="imageUrl" alt="..." />
```

**File: `apps/client-interface/src/app/directives/lazy-load.directive.ts`**

```typescript
import { Directive, ElementRef, Input, OnInit, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appLazyLoad]',
  standalone: true,
})
export class LazyLoadDirective implements OnInit {
  @Input('appLazyLoad') imageSrc!: string;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnInit() {
    this.renderer.setAttribute(this.el.nativeElement, 'loading', 'lazy');

    // Fallback for browsers that don't support loading="lazy"
    if ('loading' in HTMLImageElement.prototype) {
      this.renderer.setAttribute(this.el.nativeElement, 'src', this.imageSrc);
    } else {
      // Use IntersectionObserver fallback
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.renderer.setAttribute(this.el.nativeElement, 'src', this.imageSrc);
            observer.disconnect();
          }
        });
      });
      observer.observe(this.el.nativeElement);
    }
  }
}
```

---

## 10. Accessibility Improvements

### Overview

Improve ARIA support, keyboard navigation, and screen reader compatibility.

### 10.1 ARIA Labels and Live Regions

**File: `apps/client-interface/src/app/components/common/a11y-utils.ts`**

```typescript
// Add aria-live regions to notification components
// In notification-bell.component.ts template:
<div aria-live="polite" class="sr-only">
  {{ unreadCount() }} unread notifications
</div>

// Add role and aria-labels to interactive elements
<button
  role="button"
  aria-label="Like this post"
  [attr.aria-pressed]="isLiked()"
  (click)="like()"
>
  <svg viewBox="0 0 24 24" [attr.fill]="isLiked() ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
</button>

// Add proper form labels
<label for="search-input" class="sr-only">Search</label>
<input
  id="search-input"
  type="search"
  aria-describedby="search-hint"
  placeholder="Search..."
/>
<span id="search-hint" class="sr-only">
  Press Enter to search, use arrow keys to navigate results
</span>
```

### 10.2 Keyboard Navigation

**File: `apps/client-interface/src/app/directives/keyboard-navigation.directive.ts`**

```typescript
import { Directive, ElementRef, Output, EventEmitter, Input } from '@angular/core';

@Directive({
  selector: '[appKeyboardNav]',
  standalone: true,
})
export class KeyboardNavDirective {
  @Input() navigationAxis: 'horizontal' | 'vertical' = 'vertical';
  @Input() itemSelector = '[role="option"], [tabindex], .keyboard-navigable';
  @Output() selected = new EventEmitter<number>();

  private items: HTMLElement[] = [];
  private currentIndex = -1;

  constructor(private el: ElementRef) {}

  ngOnInit() {
    this.el.nativeElement.addEventListener('keydown', this.handleKeydown.bind(this));
  }

  private handleKeydown(event: KeyboardEvent) {
    this.items = Array.from(this.el.nativeElement.querySelectorAll(this.itemSelector));

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        this.navigate(1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        this.navigate(-1);
        break;
      case 'Home':
        event.preventDefault();
        this.navigateTo(0);
        break;
      case 'End':
        event.preventDefault();
        this.navigateTo(this.items.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.currentIndex >= 0) {
          this.selected.emit(this.currentIndex);
          this.items[this.currentIndex]?.click();
        }
        break;
    }
  }

  private navigate(direction: number) {
    if (this.items.length === 0) return;

    this.currentIndex = (this.currentIndex + direction + this.items.length) % this.items.length;
    this.focusCurrent();
  }

  private navigateTo(index: number) {
    if (index < 0 || index >= this.items.length) return;
    this.currentIndex = index;
    this.focusCurrent();
  }

  private focusCurrent() {
    this.items.forEach((item, i) => {
      item.setAttribute('tabindex', i === this.currentIndex ? '0' : '-1');
    });
    this.items[this.currentIndex]?.focus();
  }
}
```

### 10.3 Focus Management

**File: `apps/client-interface/src/app/directives/focus-trap.directive.ts`**

```typescript
import { Directive, ElementRef, OnInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appFocusTrap]',
  standalone: true,
})
export class FocusTrapDirective implements OnInit, OnDestroy {
  private focusableElements: string = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  private firstFocusable!: HTMLElement;
  private lastFocusable!: HTMLElement;

  constructor(private el: ElementRef) {}

  ngOnInit() {
    this.el.nativeElement.addEventListener('keydown', this.handleKeydown.bind(this));
    setTimeout(() => this.setInitialFocus(), 0);
  }

  private setInitialFocus() {
    const focusable = this.el.nativeElement.querySelectorAll(this.focusableElements);
    this.firstFocusable = focusable[0] as HTMLElement;
    this.lastFocusable = focusable[focusable.length - 1] as HTMLElement;
    this.firstFocusable?.focus();
  }

  private handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;

    if (event.shiftKey) {
      if (document.activeElement === this.firstFocusable) {
        event.preventDefault();
        this.lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === this.lastFocusable) {
        event.preventDefault();
        this.firstFocusable?.focus();
      }
    }
  }

  ngOnDestroy() {
    this.el.nativeElement.removeEventListener('keydown', this.handleKeydown.bind(this));
  }
}
```

### 10.4 Skip Links and Screen Reader Only Styles

**File: `apps/client-interface/src/styles.scss`**

```scss
// Skip link for keyboard users
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--primary);
  color: white;
  padding: 8px 16px;
  z-index: 10000;
  transition: top 0.2s;

  &:focus {
    top: 0;
  }
}

// Screen reader only - visible to screen readers but hidden visually
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

// Focus visible for keyboard navigation
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

// Remove focus outline for mouse users
:focus:not(:focus-visible) {
  outline: none;
}
```

---

## 11. Unified Error Handling with Message Pattern

### Overview

Implement a consistent error handling strategy across the entire application using the existing `MessageService` from `@optimistic-tanuki/message-ui` library.

### 11.1 Enhanced Error Interceptor

**File: `apps/client-interface/src/app/http.error-interceptor.ts`**

```typescript
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unexpected error occurred';
      let errorType: 'error' | 'warning' | 'info' = 'error';

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = error.error.message;
      } else {
        // Server-side error
        switch (error.status) {
          case 0:
            errorMessage = 'Unable to connect to server. Please check your internet connection.';
            errorType = 'warning';
            break;
          case 400:
            errorMessage = error.error?.message || 'Invalid request. Please check your input.';
            errorType = 'warning';
            break;
          case 401:
            errorMessage = 'Your session has expired. Please log in again.';
            errorType = 'warning';
            // Could trigger redirect to login
            break;
          case 403:
            errorMessage = 'You do not have permission to perform this action.';
            break;
          case 404:
            errorMessage = error.error?.message || 'The requested resource was not found.';
            errorType = 'info';
            break;
          case 409:
            errorMessage = error.error?.message || 'A conflict occurred. Please refresh and try again.';
            errorType = 'warning';
            break;
          case 422:
            errorMessage = error.error?.message || 'Validation error. Please check your input.';
            errorType = 'warning';
            break;
          case 429:
            errorMessage = 'Too many requests. Please wait a moment before trying again.';
            errorType = 'warning';
            break;
          case 500:
            errorMessage = 'Server error. Our team has been notified. Please try again later.';
            break;
          case 502:
          case 503:
          case 504:
            errorMessage = 'Service temporarily unavailable. Please try again later.';
            errorType = 'warning';
            break;
          default:
            errorMessage = error.error?.message || `Error: ${error.status}`;
        }
      }

      // Use MessageService to display error
      messageService.addMessage({
        content: errorMessage,
        type: errorType,
      });

      // Log error for debugging
      console.error('HTTP Error:', {
        status: error.status,
        message: errorMessage,
        url: req.url,
        error: error.error,
      });

      return throwError(() => error);
    })
  );
};
```

### 11.2 Global Error Handler

**File: `apps/client-interface/src/app/global-error-handler.ts`**

```typescript
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { MessageService } from '@optimistic-tanuki/message-ui';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private messageService = inject(MessageService);

  handleError(error: Error) {
    // Log to console
    console.error('Global error:', error);

    // Check if it's an Angular-specific error
    if (error.message?.includes('ExpressionChangedAfterItHasBeenCheckedError')) {
      // This is a development-only error, don't show to users in production
      if (typeof ngDevMode === 'undefined' || !ngDevMode) {
        this.showError('An error occurred. Please refresh the page.');
      }
      return;
    }

    // Show user-friendly message
    this.showError('An unexpected error occurred. Please try again.');
  }

  private showError(message: string) {
    this.messageService.addMessage({
      content: message,
      type: 'error',
    });
  }
}
```

### 11.3 Update App Config

**File: `apps/client-interface/src/app/app.config.ts`**

```typescript
import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { errorInterceptor } from './http.error-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideHttpClient(withInterceptors([errorInterceptor])), provideAnimationsAsync()],
};
```

### 11.4 Toast Component for Messages

Ensure the MessageComponent is displayed globally:

**File: `apps/client-interface/src/app/app.component.ts`**

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { MessageComponent, MessageService } from '@optimistic-tanuki/message-ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [, /* ... other imports */ MessageComponent],
  template: `
    <app-toolbar></app-toolbar>
    <main class="content">
      <router-outlet></router-outlet>
    </main>

    <!-- Global message toasts -->
    <lib-message></lib-message>
  `,
})
export class AppComponent implements OnInit {
  private messageService = inject(MessageService);

  ngOnInit() {
    // Optional: Auto-dismiss messages after 5 seconds
    this.messageService.messages().subscribe((messages) => {
      // Implement auto-dismiss logic if needed
    });
  }
}
```

### 11.5 Service-Level Error Handling Utilities

Create helper methods for consistent error handling in services:

**File: `apps/client-interface/src/app/utils/error-handler.utils.ts`**

```typescript
import { inject } from '@angular/core';
import { MessageService } from '@optimistic-tanuki/message-ui';

export function createErrorHandler() {
  const messageService = inject(MessageService);

  return {
    handleError(error: any, customMessage?: string) {
      const message = customMessage || 'An error occurred';
      console.error(message, error);

      messageService.addMessage({
        content: message,
        type: 'error',
      });

      throw error;
    },

    handleWarning(message: string) {
      messageService.addMessage({
        content: message,
        type: 'warning',
      });
    },

    handleSuccess(message: string) {
      messageService.addMessage({
        content: message,
        type: 'success',
      });
    },

    handleInfo(message: string) {
      messageService.addMessage({
        content: message,
        type: 'info',
      });
    },
  };
}

// Usage in services:
// const errors = createErrorHandler();
//
// this.http.get('/api/data').subscribe({
//   next: (data) => this.processData(data),
//   error: (err) => errors.handleError(err, 'Failed to load data')
// });
```

---

## 12. Chat UI Migration to @libs/chat-ui

### Overview

Migrate the existing custom chat implementation in client-interface to use the centralized `@libs/chat-ui` library components.

### 12.1 Audit Current Implementation

The current implementation has:

- `apps/client-interface/src/app/chat.service.ts` - Custom ChatService
- `apps/client-interface/src/app/components/messages.component.ts` - Custom messages page
- Chat integration in `app.component.ts` - Floating chat bubble

### 12.2 Migrate Messages Page

**File: `apps/client-interface/src/app/components/messages/messages-page.component.ts`**

```typescript
import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChatUiComponent, ChatContact, ChatConversation, SocketChatService, ChatMessage } from '@optimistic-tanuki/chat-ui';
import { ProfileService } from '../../profile.service';
import { ChatService, ChatConversation as AppChatConversation } from '../../chat.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-messages-page',
  standalone: true,
  imports: [CommonModule, ChatUiComponent],
  template: `
    <div class="messages-page">
      <div class="page-header">
        <h1>Messages</h1>
      </div>

      @if (loading()) {
      <div class="loading">Loading conversations...</div>
      } @else {
      <lib-chat-ui [contacts]="chatContacts()" [conversations]="chatConversations()" (contactSelected)="onContactSelected($event)" (messageSent)="onMessageSent($event)"></lib-chat-ui>
      }
    </div>
  `,
  styles: [
    `
      .messages-page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
      }
      .page-header {
        margin-bottom: 2rem;
        h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 0;
        }
      }
      .loading {
        text-align: center;
        padding: 2rem;
        color: var(--muted);
      }
    `,
  ],
})
export class MessagesPageComponent implements OnInit {
  private profileService = inject(ProfileService);
  private chatService = inject(ChatService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private socketChatService = inject(SocketChatService);

  chatContacts = signal<ChatContact[]>([]);
  chatConversations = signal<ChatConversation[]>([]);
  loading = signal(true);

  async ngOnInit() {
    await this.loadConversations();
    this.initializeSocketChat();
  }

  private async loadConversations() {
    const profile = this.profileService.getCurrentUserProfile();
    if (!profile) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      // Use existing ChatService for API calls
      const conversations: AppChatConversation[] = await this.chatService.getConversations(profile.id);

      const allParticipantIds = new Set<string>();
      conversations.forEach((c) => {
        c.participants.forEach((p) => allParticipantIds.add(p));
      });

      const participantIds = Array.from(allParticipantIds);
      let profiles: ProfileDto[] = [];

      if (participantIds.length > 0) {
        profiles = await firstValueFrom(
          this.http.post<ProfileDto[]>('/api/profile/by-ids', {
            ids: participantIds,
          })
        );
      }

      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      // Transform to chat-ui library format
      this.chatContacts.set(
        conversations.map((conv) => {
          const otherParticipantId = conv.participants.find((p) => p !== profile.id);
          const otherProfile = otherParticipantId ? profileMap.get(otherParticipantId) : null;

          return {
            id: conv.id,
            name: otherProfile?.profileName || conv.title || 'Unknown',
            avatarUrl: otherProfile?.profilePic,
            lastMessage: '',
            lastMessageTime: conv.updatedAt.toString(),
          };
        })
      );

      // Transform conversations with messages
      this.chatConversations.set(
        await Promise.all(
          conversations.map(async (conv) => {
            let messages: ChatMessage[] = [];

            // If conversation has messages loaded
            if (conv.id) {
              try {
                const chatMessages = await firstValueFrom(this.http.get<any[]>(`/api/chat/messages/${conv.id}`));
                messages = chatMessages.map((m) => ({
                  id: m.id,
                  conversationId: m.conversationId,
                  senderId: m.senderId,
                  recipientId: m.recipients || [],
                  content: m.content,
                  timestamp: new Date(m.createdAt),
                  type: m.type as 'chat' | 'info' | 'warning' | 'system',
                }));
              } catch (e) {
                // Messages might not be available
              }
            }

            return {
              id: conv.id,
              participants: conv.participants,
              messages,
              createdAt: new Date(conv.createdAt),
              updatedAt: new Date(conv.updatedAt),
            };
          })
        )
      );

      this.loading.set(false);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      this.loading.set(false);
    }
  }

  private initializeSocketChat() {
    const profile = this.profileService.getCurrentUserProfile();
    if (!profile) return;

    // Configure SocketChatService with auth
    // The service should be provided with the auth token at app level
    this.socketChatService.getConversations(profile.id);

    this.socketChatService.onConversations((conversations) => {
      // Handle real-time conversation updates
    });

    this.socketChatService.onMessage((message) => {
      // Handle incoming messages in real-time
      this.handleIncomingMessage(message);
    });
  }

  private handleIncomingMessage(message: ChatMessage) {
    this.chatConversations.update((conversations) => {
      const conv = conversations.find((c) => c.id === message.conversationId);
      if (conv) {
        conv.messages = [...conv.messages, message];
      }
      return [...conversations];
    });
  }

  onContactSelected(contactId: string) {
    console.log('Contact selected:', contactId);
    // Could open a specific chat window or navigate to conversation
  }

  onMessageSent(message: { conversationId: string; content: string }) {
    const profile = this.profileService.getCurrentUserProfile();
    if (!profile) return;

    // Send via existing ChatService
    this.chatService
      .sendMessage({
        conversationId: message.conversationId,
        content: message.content,
        senderId: profile.id,
        recipientIds: [],
      })
      .subscribe({
        next: () => {
          // Message sent successfully, socket will handle real-time update
        },
        error: (err) => console.error('Failed to send message:', err),
      });
  }
}
```

### 12.3 Update Route

**File: `apps/client-interface/src/app/app.routes.ts`**

```typescript
{
  path: 'messages',
  loadComponent: () =>
    import('./components/messages/messages-page.component').then(
      (m) => m.MessagesPageComponent
    ),
  canActivate: [AuthGuard, ProfileGuard],
},
```

### 12.4 Update App Component Chat Integration

The floating chat bubble in app.component.ts should be updated or removed depending on requirements. If keeping it:

**File: `apps/client-interface/src/app/app.component.ts`** (excerpt)

```typescript
// Remove the old chat implementation
// The chat-ui library can provide a floating chat component
// or implement a custom one that uses SocketChatService

// If keeping floating chat, ensure it uses chat-ui types:
import { SocketChatService, ChatMessage } from '@optimistic-tanuki/chat-ui';
```

### 12.5 Configure SocketChatService

**File: `apps/client-interface/src/app/app.config.ts`**

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { SocketChatService, SOCKET_HOST, SOCKET_NAMESPACE, SOCKET_IO_INSTANCE, SOCKET_AUTH_TOKEN_PROVIDER, SOCKET_AUTH_ERROR_HANDLER } from '@optimistic-tanuki/chat-ui';
import { io } from 'socket.io-client';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([errorInterceptor])),
    provideAnimationsAsync(),
    {
      provide: SOCKET_HOST,
      useValue: 'http://localhost:3000',
    },
    {
      provide: SOCKET_NAMESPACE,
      useValue: 'chat',
    },
    {
      provide: SOCKET_IO_INSTANCE,
      useValue: io,
    },
    {
      provide: SOCKET_AUTH_TOKEN_PROVIDER,
      useFactory: () => {
        // Get token from localStorage or auth service
        return () => localStorage.getItem('auth_token');
      },
    },
    {
      provide: SOCKET_AUTH_ERROR_HANDLER,
      useFactory: (router: Router) => {
        return () => {
          // Handle auth errors - redirect to login
          localStorage.removeItem('auth_token');
          router.navigate(['/login']);
        };
      },
      deps: [Router],
    },
    SocketChatService,
  ],
};
```

### 12.6 Test the Migration

After migration, verify:

1. Messages page loads correctly
2. Conversations are displayed
3. Real-time messages work via WebSocket
4. Sending messages works
5. Error handling displays properly

---

## Summary

This comprehensive plan covers 12 major areas of development for the client-interface social network:

1. **Notifications System** - Real-time notifications for likes, comments, follows, mentions
2. **Search & Discovery** - Global search and Explore page
3. **Direct Messaging Enhancements** - Typing indicators, read receipts, online status, reactions
4. **User Privacy & Safety** - Block, mute, and content reporting
5. **User Activity & History** - Activity feed and saved posts
6. **Profile Enhancements** - Analytics, verification, profile views
7. **Content Features** - Polls, sharing, events
8. **UI/UX Polish** - Better toolbar, loading states, mobile responsive
9. **Performance** - Infinite scroll, lazy loading
10. **Accessibility** - ARIA, keyboard navigation, screen reader support
11. **Unified Error Handling** - Message pattern for all errors
12. **Chat UI Migration** - Use centralized chat-ui library

Each section provides:

- Backend database entities
- API services
- Frontend components
- Integration points
- Route additions

The implementation can be done incrementally, prioritizing based on user impact and development effort.
