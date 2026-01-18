export interface Availability {
  id: string;
  ownerId?: string;
  resourceId?: string;
  resource?: any;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:MM:SS format
  endTime: string; // HH:MM:SS format
  hourlyRate: number;
  isActive: boolean;
  serviceType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAvailabilityDto {
  ownerId?: string;
  resourceId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  serviceType?: string;
  isActive?: boolean;
}

export interface UpdateAvailabilityDto {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  hourlyRate?: number;
  serviceType?: string;
  isActive?: boolean;
}
