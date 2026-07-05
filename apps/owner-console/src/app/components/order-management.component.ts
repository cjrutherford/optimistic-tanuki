import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService, Order } from '../services/store.service';
import { UpdateOrderDto } from '@optimistic-tanuki/ui-models';
import { AgGridUiComponent, ColDef } from '@optimistic-tanuki/ag-grid-ui';
import { CommerceWorkspaceNavComponent } from './commerce-workspace-nav.component';

@Component({
  selector: 'app-order-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridUiComponent,
    CommerceWorkspaceNavComponent,
  ],
  templateUrl: './order-management.component.html',
  styleUrls: ['./order-management.component.scss'],
})
export class OrderManagementComponent implements OnInit {
  orders: Order[] = [];
  selectedOrder: Order | null = null;
  loading = false;
  error: string | null = null;
  filterStatus = 'all';
  gridHeight = '520px';

  columnDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'Order ID',
      minWidth: 160,
      valueFormatter: (params) =>
        typeof params.value === 'string'
          ? `${params.value.substring(0, 8)}...`
          : '',
    },
    {
      field: 'createdAt',
      headerName: 'Date',
      minWidth: 180,
      valueFormatter: (params) =>
        params.value ? new Date(params.value).toLocaleString() : '',
    },
    {
      field: 'userId',
      headerName: 'User ID',
      minWidth: 160,
      valueFormatter: (params) =>
        typeof params.value === 'string'
          ? `${params.value.substring(0, 8)}...`
          : '',
    },
    {
      headerName: 'Items',
      minWidth: 110,
      valueGetter: (params) => this.getTotalItems(params.data),
    },
    {
      field: 'total',
      headerName: 'Total',
      minWidth: 130,
      valueFormatter: (params) =>
        `${params.data?.currency ?? 'USD'} $${Number(params.value ?? 0).toFixed(
          2
        )}`,
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 140,
    },
    {
      headerName: 'Actions',
      minWidth: 220,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = '8px';

        const viewButton = document.createElement('button');
        viewButton.textContent = 'View';
        viewButton.className = 'ag-grid-action-button';
        viewButton.addEventListener('click', () => this.viewOrder(params.data));
        container.appendChild(viewButton);

        const statusSelect = document.createElement('select');
        statusSelect.className = 'ag-grid-inline-select';
        ['pending', 'processing', 'completed', 'cancelled'].forEach(
          (status) => {
            const option = document.createElement('option');
            option.value = status;
            option.text = status;
            option.selected = params.data?.status === status;
            statusSelect.appendChild(option);
          }
        );
        statusSelect.addEventListener('change', (event) => {
          this.updateOrderStatus(
            params.data,
            (event.target as HTMLSelectElement).value
          );
        });
        container.appendChild(statusSelect);

        return container;
      },
    },
  ];

  constructor(private storeService: StoreService) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.error = null;
    this.storeService.getOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load orders';
        this.loading = false;
        console.error(err);
      },
    });
  }

  get filteredOrders(): Order[] {
    if (this.filterStatus === 'all') {
      return this.orders;
    }
    return this.orders.filter((order) => order.status === this.filterStatus);
  }

  get gridOrders(): Order[] {
    return this.filteredOrders;
  }

  viewOrder(order: Order): void {
    this.selectedOrder = order;
  }

  closeOrderDetails(): void {
    this.selectedOrder = null;
  }

  updateOrderStatus(order: Order, newStatus: string): void {
    this.loading = true;
    this.error = null;
    const dto: UpdateOrderDto = { status: newStatus };

    this.storeService.updateOrder(order.id, dto).subscribe({
      next: () => {
        this.loadOrders();
        if (this.selectedOrder?.id === order.id) {
          this.selectedOrder.status = newStatus;
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to update order status';
        this.loading = false;
        console.error(err);
      },
    });
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      pending: 'status-pending',
      processing: 'status-processing',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
    };
    return statusMap[status] || '';
  }

  getTotalItems(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }
}
