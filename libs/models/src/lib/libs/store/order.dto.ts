export class CreateOrderDto {
  userId: string;
  items: CreateOrderItemDto[];
}

export class CreateOrderItemDto {
  productId: string;
  quantity: number;
}

export class UpdateOrderDto {
  status?: string;
}
