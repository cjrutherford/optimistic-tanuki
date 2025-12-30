export class CreateProductDto {
  name: string;
  description?: string;
  price: number;
  type: string;
  imageUrl?: string;
  stock?: number;
  active?: boolean;
}

export class UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  type?: string;
  imageUrl?: string;
  stock?: number;
  active?: boolean;
}
