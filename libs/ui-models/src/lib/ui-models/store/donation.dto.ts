/* eslint-disable @typescript-eslint/no-inferrable-types */
export class CreateDonationDto {
  userId?: string;
  amountCents: number = 0;
  currency?: string;
  message?: string;
  anonymous?: boolean;
}
