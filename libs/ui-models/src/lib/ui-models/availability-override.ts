export type AvailabilityOverrideMode = 'available' | 'blocked';

export interface AvailabilityOverride {
  id: string;
  ownerId?: string;
  startTime: string;
  endTime: string;
  mode: AvailabilityOverrideMode;
  serviceType?: string;
  hourlyRate?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAvailabilityOverrideDto {
  ownerId?: string;
  startTime: string;
  endTime: string;
  mode: AvailabilityOverrideMode;
  serviceType?: string;
  hourlyRate?: number;
  isActive?: boolean;
}

export interface UpdateAvailabilityOverrideDto {
  startTime?: string;
  endTime?: string;
  mode?: AvailabilityOverrideMode;
  serviceType?: string;
  hourlyRate?: number;
  isActive?: boolean;
}
