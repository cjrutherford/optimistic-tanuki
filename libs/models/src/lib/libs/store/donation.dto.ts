export class CreateDonationDto {
  userId?: string;
  amount: number;
  currency?: string;
  message?: string;
  anonymous?: boolean;
}
