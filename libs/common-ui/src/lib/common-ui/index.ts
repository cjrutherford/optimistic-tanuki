export { ButtonComponent, type ButtonVariant } from './button/button.component';
export { SpinnerComponent } from './spinner/spinner.component';
export { GridComponent } from './grid/grid.component';
export {
  TableComponent,
  type TableColumn,
  type TableRow,
  type TableAction,
  type TableCell,
  type TableRowAction,
  type TableSort,
} from './table/table.component';
export { CardComponent } from './card/card.component';
export { TileComponent } from './tile/tile.component';
export { PaginationComponent } from './pagination.component';
export {
  AccordionComponent,
  type AccordionVariant,
  type AccordionSurface,
  type AccordionEmphasis,
} from './accordion/accordion.component';
export { ListComponent } from './list/list.component';
export { HeadingComponent } from './heading/heading.component';
export {
  ModalComponent,
  type ModalSize,
  type ModalPosition,
} from './modal/modal.component';
export {
  NotificationComponent,
  type NotificationType,
  type NotificationPosition,
  type NotificationAction,
  type Notification,
} from './notification/notification.component';
export { GlassContainerComponent } from './glass-container.component';
export { HeroSectionComponent } from './hero-section/hero-section.component';
export { ContentSectionComponent } from './content-section/content-section.component';
export { IconComponent, type IconName } from './icon/icon.component';
export { TabsComponent, type Tab } from './tabs/tabs.component';
export { DropdownComponent } from './dropdown/dropdown.component';
export { ChipComponent, type ChipVariant } from './chip/chip.component';
export { TooltipDirective } from './tooltip/tooltip.directive';
export { DevInfoComponent } from './dev-info/dev-info.component';
export {
  BadgeComponent,
  type BadgeVariant,
  type BadgeSize,
} from './badge.component';
export { SectionHeadingComponent } from './section-heading/section-heading.component';
export {
  createPerformanceReporter,
  normalizePerformanceRoute,
  startPerformanceMonitoring,
  type PerformanceMetric,
  type PerformanceMetricName,
  type PerformanceMonitorOptions,
  type PerformanceRumPayload,
} from './performance-monitor';
export {
  MetricTileComponent,
  type MetricDeltaDirection,
  type MetricTone,
} from './metric-tile/metric-tile.component';
export {
  StateMessageComponent,
  type StateMessageKind,
  type StateMessageTone,
} from './states/state-message.component';
export {
  EmptyStateComponent,
  LoadingStateComponent,
  ErrorStateComponent,
} from './states';

// Export interfaces
export type { ListItem } from './interfaces/component.interface';

// Canonical variant contract
export type {
  Tone,
  Emphasis,
  VariantSize,
  VariantContract,
  VariantBinding,
} from './interfaces/variant.contract';
export {
  BUTTON_VARIANT_BRIDGE,
  CHIP_TONE_BRIDGE,
  SURFACE_EMPHASIS_BRIDGE,
} from './interfaces/variant.contract';

// Export themeable base classes
export {
  Variantable,
  type VariantOptions,
  type VariantType,
} from './interfaces/variantable.interface';
export { getDefaultVariantOptions } from './interfaces/defaultVariantOptions';
