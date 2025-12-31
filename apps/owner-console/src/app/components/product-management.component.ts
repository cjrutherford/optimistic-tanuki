import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService, Product } from '../services/store.service';
import { CreateProductDto, UpdateProductDto } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-management.component.html',
  styleUrls: ['./product-management.component.scss'],
})
export class ProductManagementComponent implements OnInit {
  products: Product[] = [];
  selectedProduct: Product | null = null;
  isEditing = false;
  isCreating = false;
  loading = false;
  error: string | null = null;

  productForm: CreateProductDto & { id?: string } = this.getEmptyForm();

  constructor(private storeService: StoreService) {}

  ngOnInit(): void {
    this.loadProducts();
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

  getEmptyForm(): CreateProductDto & { id?: string } {
    return {
      name: '',
      description: '',
      price: 0,
      type: 'physical',
      imageUrl: '',
      stock: 0,
      active: true,
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
    this.productForm = { ...product };
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
      price: this.productForm.price,
      type: this.productForm.type,
      imageUrl: this.productForm.imageUrl,
      stock: this.productForm.stock,
      active: this.productForm.active,
    };
    this.storeService.createProduct(dto).subscribe({
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
      price: this.productForm.price,
      type: this.productForm.type,
      imageUrl: this.productForm.imageUrl,
      stock: this.productForm.stock,
      active: this.productForm.active,
    };
    this.storeService.updateProduct(this.selectedProduct.id, dto).subscribe({
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
