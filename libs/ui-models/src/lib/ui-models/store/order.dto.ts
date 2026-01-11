/* eslint-disable @typescript-eslint/no-inferrable-types */
export class CreateOrderDto {
  userId?: string;
  items: CreateOrderItemDto[] = [];
}

export class CreateOrderItemDto {
  productId: string = '';
  quantity: number = 0;
}

export class UpdateOrderDto {
  status?: string;
}
