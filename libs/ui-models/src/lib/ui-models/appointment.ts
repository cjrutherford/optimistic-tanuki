export interface Appointment {
  id: string;
  userId: string;
  productId?: string;
  product?: any;
  resourceId?: string;
  resource?: any;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  status: string; // 'pending', 'approved', 'denied', 'cancelled', 'completed'
  isFreeConsultation: boolean;
  hourlyRate?: number;
  totalCost?: number;
  notes?: string;
  denialReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppointmentDto {
  userId: string;
  productId?: string;
  resourceId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isFreeConsultation?: boolean;
  notes?: string;
}

export interface UpdateAppointmentDto {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  status?: string;
  notes?: string;
}

export interface ApproveAppointmentDto {
  hourlyRate?: number;
  notes?: string;
}

export interface DenyAppointmentDto {
  denialReason: string;
}
