import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { StoreCatalog, StoreService, Product } from '../services/store.service';
import {
  CreateProductDto,
  UpdateProductDto,
} from '@optimistic-tanuki/ui-models';
import { CommerceWorkspaceNavComponent } from './commerce-workspace-nav.component';

// The form binds to a dollar-denominated `price` field for a friendlier
// input UX; it is converted to `priceCents` when building the DTO.
interface ProductFormModel {
  id?: string;
  name: string;
  description?: string;
  price: number;
  type: string;
  imageUrl?: string;
  stock?: number;
  active?: boolean;
  catalogId?: string | null;
}

@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [CommonModule, FormsModule, CommerceWorkspaceNavComponent],
  templateUrl: './product-management.component.html',
  styleUrls: ['./product-management.component.scss'],
})
export class ProductManagementComponent implements OnInit {
  readonly filters = ['all', 'service', 'active-service', 'inactive'] as const;
  filter: (typeof this.filters)[number] = 'all';
  products: Product[] = [];
  selectedProduct: Product | null = null;
  isEditing = false;
  isCreating = false;
  loading = false;
  error: string | null = null;
  storeCatalogs: StoreCatalog[] = [];
  readonly workspaceSlug: string | null;

  productForm: ProductFormModel = this.getEmptyForm();

  constructor(private storeService: StoreService, route: ActivatedRoute) {
    this.workspaceSlug =
      route.snapshot.queryParamMap.get('slug')?.trim() || null;
  }

  ngOnInit(): void {
    this.loadProducts();
    if (this.workspaceSlug) {
      this.storeService.getMyCatalogs(this.workspaceSlug).subscribe({
        next: (catalogs) => (this.storeCatalogs = catalogs),
        error: () => (this.storeCatalogs = []),
      });
    }
  }

  loadProducts(): void {
    this.loading = true;
    this.error = null;
    this.storeService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load products';
        this.loading = false;
        console.error(err);
      },
    });
  }

  get filteredProducts(): Product[] {
    switch (this.filter) {
      case 'service':
        return this.products.filter((product) => product.type === 'service');
      case 'active-service':
        return this.products.filter(
          (product) => product.type === 'service' && product.active
        );
      case 'inactive':
        return this.products.filter((product) => !product.active);
      default:
        return this.products;
    }
  }

  get serviceProductCount(): number {
    return this.products.filter((product) => product.type === 'service').length;
  }

  get activeServiceProductCount(): number {
    return this.products.filter(
      (product) => product.type === 'service' && product.active
    ).length;
  }

  setFilter(filter: (typeof this.filters)[number]): void {
    this.filter = filter;
  }

  formatPrice(priceCents: number | string): string {
    const centsNumber =
      typeof priceCents === 'string' ? parseFloat(priceCents) : priceCents;
    return (centsNumber / 100).toFixed(2);
  }

  getEmptyForm(): ProductFormModel {
    return {
      name: '',
      description: '',
      price: 0,
      type: 'physical',
      imageUrl: '',
      stock: 0,
      active: true,
      catalogId: null,
    };
  }

  startCreate(): void {
    this.isCreating = true;
    this.isEditing = false;
    this.selectedProduct = null;
    this.productForm = this.getEmptyForm();
  }

  startEdit(product: Product): void {
    this.isEditing = true;
    this.isCreating = false;
    this.selectedProduct = product;
    this.productForm = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.priceCents / 100,
      type: product.type,
      imageUrl: product.imageUrl,
      stock: product.stock,
      active: product.active,
      catalogId: product.catalogId ?? null,
    };
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.isCreating = false;
    this.selectedProduct = null;
    this.productForm = this.getEmptyForm();
  }

  saveProduct(): void {
    if (this.isCreating) {
      this.createProduct();
    } else if (this.isEditing && this.selectedProduct) {
      this.updateProduct();
    }
  }

  createProduct(): void {
    this.loading = true;
    this.error = null;
    const dto: CreateProductDto = {
      name: this.productForm.name,
      description: this.productForm.description,
      priceCents: Math.round(this.productForm.price * 100),
      type: this.productForm.type,
      imageUrl: this.productForm.imageUrl,
      stock: this.productForm.stock,
      active: this.productForm.active,
      catalogId: this.productForm.catalogId || null,
    };
    this.storeService.createProduct(dto, this.workspaceSlug).subscribe({
      next: () => {
        this.loadProducts();
        this.cancelEdit();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to create product';
        this.loading = false;
        console.error(err);
      },
    });
  }

  updateProduct(): void {
    if (!this.selectedProduct) return;

    this.loading = true;
    this.error = null;
    const dto: UpdateProductDto = {
      name: this.productForm.name,
      description: this.productForm.description,
      priceCents: Math.round(this.productForm.price * 100),
      type: this.productForm.type,
      imageUrl: this.productForm.imageUrl,
      stock: this.productForm.stock,
      active: this.productForm.active,
      catalogId: this.productForm.catalogId || null,
    };
    this.storeService
      .updateProduct(this.selectedProduct.id, dto, this.workspaceSlug)
      .subscribe({
        next: () => {
          this.loadProducts();
          this.cancelEdit();
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to update product';
          this.loading = false;
          console.error(err);
        },
      });
  }

  deleteProduct(product: Product): void {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.storeService.deleteProduct(product.id).subscribe({
      next: () => {
        this.loadProducts();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to delete product';
        this.loading = false;
        console.error(err);
      },
    });
  }
}
