/* eslint-disable @typescript-eslint/no-inferrable-types */
export class CreateDonationDto {
  userId?: string;
  amount: number = 0;
  currency?: string;
  message?: string;
  anonymous?: boolean;
}
