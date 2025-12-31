export class CreateSubscriptionDto {
  userId!: string;
  productId!: string;
  interval!: string;
  startDate?: Date;
}

export class UpdateSubscriptionDto {
  status?: string;
  endDate?: Date;
  nextBillingDate?: Date;
}
