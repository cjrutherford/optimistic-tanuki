import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService, Order } from '../services/store.service';
import { UpdateOrderDto } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-order-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-management.component.html',
  styleUrls: ['./order-management.component.scss'],
})
export class OrderManagementComponent implements OnInit {
  orders: Order[] = [];
  selectedOrder: Order | null = null;
  loading = false;
  error: string | null = null;
  filterStatus: string = 'all';

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
    return this.orders.filter(order => order.status === this.filterStatus);
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
      'pending': 'status-pending',
      'processing': 'status-processing',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled',
    };
    return statusMap[status] || '';
  }

  getTotalItems(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }
}
