export interface Invoice {
  id: string;
  appointmentId: string;
  userId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string; // 'unpaid', 'paid', 'cancelled'
  paidAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
