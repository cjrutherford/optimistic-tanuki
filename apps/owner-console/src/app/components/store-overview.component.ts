import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Appointment } from '@optimistic-tanuki/ui-models';
import { BusinessSiteAdminService } from '../services/business-site-admin.service';
import {
  Donation,
  Order,
  Product,
  StoreService,
  Subscription,
} from '../services/store.service';
import { OperatorQueuePanelComponent } from './operator-queue-panel.component';
import { CommerceWorkspaceNavComponent } from './commerce-workspace-nav.component';
import {
  OperatorQueueItem,
  OperatorQueueService,
} from '../services/operator-queue.service';

type CommerceLane =
  | 'all'
  | 'appointments'
  | 'orders'
  | 'subscriptions'
  | 'catalog';
type AppointmentBulkAction = 'approve' | 'cancel';
type CommerceViewPreset = 'all' | 'approval' | 'fulfillment' | 'catalog';

interface CommerceBacklogItem {
  id: string;
  lane: Exclude<CommerceLane, 'all'>;
  title: string;
  detail: string;
  status: string;
  severity: 'high' | 'medium' | 'low';
  route: string;
}

interface CommerceExceptionItem {
  kind: 'appointment-approval' | 'fulfillment-exception' | 'catalog-readiness';
  title: string;
  detail: string;
  route: string;
  severity: 'high' | 'medium';
}

const COMMERCE_WORKSPACE_VIEW_KEY = 'owner-console.commerce-workspace.view';

@Component({
  selector: 'app-store-overview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    OperatorQueuePanelComponent,
    CommerceWorkspaceNavComponent,
  ],
  templateUrl: './store-overview.component.html',
  styleUrls: ['./store-overview.component.scss'],
})
export class StoreOverviewComponent implements OnInit {
  queueItems: OperatorQueueItem[] = [];
  appointments: Appointment[] = [];
  donations: Donation[] = [];
  orders: Order[] = [];
  products: Product[] = [];
  subscriptions: Subscription[] = [];
  catalogSource: 'manual' | 'store' = 'manual';
  storefrontEnabled = false;
  backlogFilter: CommerceLane = 'all';
  activeViewPreset: CommerceViewPreset = 'all';
  bulkOrderStatus: 'pending' | 'processing' | 'completed' | 'cancelled' =
    'processing';
  bulkAppointmentAction: AppointmentBulkAction = 'approve';
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  private readonly selectedAppointmentIds = new Set<string>();
  private readonly selectedOrderIds = new Set<string>();

  constructor(
    private readonly storeService: StoreService,
    private readonly operatorQueueService: OperatorQueueService,
    private readonly businessSiteAdminService: BusinessSiteAdminService
  ) {}

  ngOnInit(): void {
    this.restoreViewPreset();
    this.loadData();
    this.loadQueue();
  }

  loadQueue(): void {
    this.operatorQueueService.getQueueByDomain('Commerce').subscribe({
      next: (items) => {
        this.queueItems = items;
      },
      error: () => {
        this.queueItems = [];
      },
    });
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    this.successMessage = null;

    this.businessSiteAdminService.getSiteConfig().subscribe({
      next: (siteConfigResponse) => {
        this.catalogSource =
          siteConfigResponse.config?.serviceCatalog?.source ?? 'manual';
        this.storefrontEnabled =
          siteConfigResponse.config?.features?.store?.enabled ?? false;

        this.storeService.getDonations().subscribe({
          next: (donations) => {
            this.donations = donations;
          },
          error: (err) => {
            this.handleLoadError(err);
          },
        });

        this.storeService.getSubscriptions().subscribe({
          next: (subscriptions) => {
            this.subscriptions = subscriptions;
          },
          error: (err) => {
            this.handleLoadError(err);
          },
        });

        this.storeService.getAppointments().subscribe({
          next: (appointments) => {
            this.appointments = appointments;
          },
          error: (err) => {
            this.handleLoadError(err);
          },
        });

        this.storeService.getOrders().subscribe({
          next: (orders) => {
            this.orders = orders;
          },
          error: (err) => {
            this.handleLoadError(err);
          },
        });

        this.storeService.getProducts().subscribe({
          next: (products) => {
            this.products = products;
            this.loading = false;
          },
          error: (err) => {
            this.handleLoadError(err);
          },
        });
      },
      error: (err) => {
        this.handleLoadError(err);
      },
    });
  }

  get totalDonationsCents(): number {
    return this.donations.reduce(
      (sum, donation) => sum + Number(donation.amountCents),
      0
    );
  }

  get activeSubscriptions(): number {
    return this.subscriptions.filter(
      (subscription) => subscription.status === 'active'
    ).length;
  }

  get pendingAppointments(): Appointment[] {
    return this.appointments.filter(
      (appointment) => appointment.status === 'pending'
    );
  }

  get confirmedAppointments(): Appointment[] {
    return this.appointments.filter(
      (appointment) => appointment.status === 'approved'
    );
  }

  get fulfillmentBacklog(): Order[] {
    return this.orders.filter(
      (order) => order.status === 'pending' || order.status === 'processing'
    );
  }

  get serviceProducts(): Product[] {
    return this.products.filter(
      (product) => product.type === 'service' && product.active
    );
  }

  get publishReadyServiceProducts(): Product[] {
    return this.serviceProducts.filter(
      (product) =>
        !!product.description?.trim() && Number(product.priceCents) > 0
    );
  }

  get catalogReadinessIssues(): string[] {
    const issues: string[] = [];

    if (this.catalogSource !== 'store') {
      return issues;
    }

    if (!this.serviceProducts.length) {
      issues.push('Store mode requires at least one active service product.');
    }

    if (this.serviceProducts.some((product) => !product.description?.trim())) {
      issues.push('Service products need public-facing descriptions.');
    }

    if (
      this.serviceProducts.some((product) => Number(product.priceCents) <= 0)
    ) {
      issues.push('Service products need pricing greater than zero.');
    }

    return issues;
  }

  get catalogReadinessLabel(): string {
    if (this.catalogSource !== 'store') {
      return 'Manual mode';
    }

    return this.catalogReadinessIssues.length ? 'Attention needed' : 'Ready';
  }

  get exceptionBoard(): CommerceExceptionItem[] {
    const items: CommerceExceptionItem[] = [];

    if (this.pendingAppointments.length > 0) {
      items.push({
        kind: 'appointment-approval',
        title: 'Appointment approvals waiting',
        detail: `${this.pendingAppointments.length} appointment${
          this.pendingAppointments.length === 1 ? '' : 's'
        } still need an operator decision.`,
        route: '/dashboard/store/appointments',
        severity: 'high',
      });
    }

    if (this.fulfillmentBacklog.length > 0) {
      items.push({
        kind: 'fulfillment-exception',
        title: 'Fulfillment backlog is active',
        detail: `${this.fulfillmentBacklog.length} order${
          this.fulfillmentBacklog.length === 1 ? '' : 's'
        } are still pending or processing.`,
        route: '/dashboard/store/orders',
        severity: 'high',
      });
    }

    if (this.catalogReadinessIssues.length > 0) {
      items.push({
        kind: 'catalog-readiness',
        title: 'Catalog is blocked',
        detail: `Catalog is blocked by ${
          this.catalogReadinessIssues.length
        } readiness issue${
          this.catalogReadinessIssues.length === 1 ? '' : 's'
        }.`,
        route: '/dashboard/store/business-site',
        severity: 'medium',
      });
    }

    return items;
  }

  get backlogItems(): CommerceBacklogItem[] {
    const appointmentItems = this.appointments
      .filter(
        (appointment) =>
          appointment.status === 'pending' || appointment.status === 'approved'
      )
      .map<CommerceBacklogItem>((appointment) => ({
        id: `appointment-${appointment.id}`,
        lane: 'appointments',
        title: appointment.title,
        detail:
          appointment.status === 'pending'
            ? 'Awaiting approval decision.'
            : 'Approved service appointment is scheduled.',
        status: appointment.status,
        severity: appointment.status === 'pending' ? 'high' : 'medium',
        route: '/dashboard/store/appointments',
      }));

    const orderItems = this.fulfillmentBacklog.map<CommerceBacklogItem>(
      (order) => ({
        id: `order-${order.id}`,
        lane: 'orders',
        title: order.id,
        detail: `${this.getTotalItems(order)} item(s) waiting in ${
          order.status
        }.`,
        status: order.status,
        severity: order.status === 'pending' ? 'high' : 'medium',
        route: '/dashboard/store/orders',
      })
    );

    const catalogItems: CommerceBacklogItem[] =
      this.catalogSource === 'store' && this.catalogReadinessIssues.length > 0
        ? this.catalogReadinessIssues.map((issue, index) => ({
            id: `catalog-${index}`,
            lane: 'catalog',
            title: 'Catalog readiness',
            detail: issue,
            status: 'attention',
            severity: 'medium',
            route: '/dashboard/store/business-site',
          }))
        : [];

    return [...appointmentItems, ...orderItems, ...catalogItems];
  }

  get filteredBacklogItems(): CommerceBacklogItem[] {
    if (this.backlogFilter === 'all') {
      return this.backlogItems;
    }

    return this.backlogItems.filter((item) => item.lane === this.backlogFilter);
  }

  setBacklogFilter(filter: CommerceLane): void {
    this.backlogFilter = filter;
  }

  applyViewPreset(preset: CommerceViewPreset): void {
    this.activeViewPreset = preset;
    switch (preset) {
      case 'approval':
        this.backlogFilter = 'appointments';
        break;
      case 'fulfillment':
        this.backlogFilter = 'orders';
        break;
      case 'catalog':
        this.backlogFilter = 'catalog';
        break;
      default:
        this.backlogFilter = 'all';
        break;
    }
    localStorage.setItem(COMMERCE_WORKSPACE_VIEW_KEY, preset);
  }

  isAppointmentSelected(appointmentId: string): boolean {
    return this.selectedAppointmentIds.has(appointmentId);
  }

  toggleAppointmentSelection(appointmentId: string, checked: boolean): void {
    if (checked) {
      this.selectedAppointmentIds.add(appointmentId);
      return;
    }

    this.selectedAppointmentIds.delete(appointmentId);
  }

  selectedPendingAppointmentCount(): number {
    return this.pendingAppointments.filter((appointment) =>
      this.selectedAppointmentIds.has(appointment.id)
    ).length;
  }

  applyBulkAppointmentAction(): void {
    const selectedAppointments = this.pendingAppointments.filter(
      (appointment) => this.selectedAppointmentIds.has(appointment.id)
    );

    if (!selectedAppointments.length) {
      this.error =
        'Select at least one pending appointment before applying a bulk action.';
      return;
    }

    this.loading = true;
    this.error = null;
    this.successMessage = null;

    let completed = 0;
    selectedAppointments.forEach((appointment) => {
      const request =
        this.bulkAppointmentAction === 'approve'
          ? this.storeService.approveAppointment(appointment.id, {
              hourlyRate: appointment.hourlyRate,
              notes: 'Approved from commerce workspace',
            })
          : this.storeService.cancelAppointment(appointment.id);

      request.subscribe({
        next: (updatedAppointment) => {
          this.appointments = this.appointments.map((currentAppointment) =>
            currentAppointment.id === updatedAppointment.id
              ? updatedAppointment
              : currentAppointment
          );
          completed += 1;
          if (completed === selectedAppointments.length) {
            this.loading = false;
            this.successMessage = `${
              this.bulkAppointmentAction === 'approve'
                ? 'Approved'
                : 'Cancelled'
            } ${selectedAppointments.length} appointment${
              selectedAppointments.length === 1 ? '' : 's'
            } from the commerce workspace.`;
            this.selectedAppointmentIds.clear();
          }
        },
        error: (err) => {
          this.loading = false;
          this.error = 'Failed to apply bulk appointment action';
          console.error(err);
        },
      });
    });
  }

  isOrderSelected(orderId: string): boolean {
    return this.selectedOrderIds.has(orderId);
  }

  toggleOrderSelection(orderId: string, checked: boolean): void {
    if (checked) {
      this.selectedOrderIds.add(orderId);
      return;
    }

    this.selectedOrderIds.delete(orderId);
  }

  selectedFulfillmentCount(): number {
    return this.fulfillmentBacklog.filter((order) =>
      this.selectedOrderIds.has(order.id)
    ).length;
  }

  applyBulkOrderStatus(): void {
    const selectedOrders = this.fulfillmentBacklog.filter((order) =>
      this.selectedOrderIds.has(order.id)
    );

    if (!selectedOrders.length) {
      this.error =
        'Select at least one fulfillment order before applying a bulk action.';
      return;
    }

    this.loading = true;
    this.error = null;
    this.successMessage = null;

    let completed = 0;
    selectedOrders.forEach((order) => {
      this.storeService
        .updateOrder(order.id, { status: this.bulkOrderStatus })
        .subscribe({
          next: (updatedOrder) => {
            this.orders = this.orders.map((currentOrder) =>
              currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder
            );
            completed += 1;
            if (completed === selectedOrders.length) {
              this.loading = false;
              this.successMessage = `Updated ${
                selectedOrders.length
              } fulfillment order${selectedOrders.length === 1 ? '' : 's'} to ${
                this.bulkOrderStatus
              }.`;
              this.selectedOrderIds.clear();
            }
          },
          error: (err) => {
            this.loading = false;
            this.error = 'Failed to apply bulk order status update';
            console.error(err);
          },
        });
    });
  }

  cancelSubscription(subscription: Subscription): void {
    if (!confirm('Are you sure you want to cancel this subscription?')) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.successMessage = null;
    this.storeService.cancelSubscription(subscription.id).subscribe({
      next: () => {
        this.loadData();
      },
      error: (err) => {
        this.error = 'Failed to cancel subscription';
        this.loading = false;
        console.error(err);
      },
    });
  }

  laneLabel(filter: CommerceLane): string {
    switch (filter) {
      case 'appointments':
        return 'Appointments';
      case 'orders':
        return 'Orders';
      case 'subscriptions':
        return 'Subscriptions';
      case 'catalog':
        return 'Catalog';
      default:
        return 'All backlog';
    }
  }

  backlogClass(item: CommerceBacklogItem): string {
    return `severity-${item.severity}`;
  }

  exceptionClass(item: CommerceExceptionItem): string {
    return `severity-${item.severity}`;
  }

  appointmentBacklogId(item: CommerceBacklogItem): string {
    return item.id.replace('appointment-', '');
  }

  orderBacklogId(item: CommerceBacklogItem): string {
    return item.title;
  }

  orderValueTotalCents(): number {
    return this.fulfillmentBacklog.reduce(
      (sum, order) => sum + Number(order.totalCents),
      0
    );
  }

  getTotalItems(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      active: 'status-active',
      approved: 'status-approved',
      attention: 'status-attention',
      cancelled: 'status-cancelled',
      completed: 'status-completed',
      expired: 'status-expired',
      failed: 'status-failed',
      pending: 'status-pending',
      processing: 'status-processing',
    };
    return statusMap[status] || '';
  }

  private handleLoadError(error: unknown): void {
    this.error = 'Failed to load commerce workspace data';
    this.loading = false;
    console.error(error);
  }

  private restoreViewPreset(): void {
    const preset = localStorage.getItem(COMMERCE_WORKSPACE_VIEW_KEY);
    if (
      preset === 'all' ||
      preset === 'approval' ||
      preset === 'fulfillment' ||
      preset === 'catalog'
    ) {
      this.applyViewPreset(preset);
    }
  }
}
