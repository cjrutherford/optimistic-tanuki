export interface Resource {
  id: string;
  name: string;
  type: string; // 'room', 'equipment', 'vehicle', 'other'
  description?: string;
  location?: string;
  capacity?: number;
  amenities?: string[];
  hourlyRate?: number;
  isActive: boolean;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateResourceDto {
  name: string;
  type: string;
  description?: string;
  location?: string;
  capacity?: number;
  amenities?: string[];
  hourlyRate?: number;
  isActive?: boolean;
  imageUrl?: string;
}

export interface UpdateResourceDto {
  name?: string;
  type?: string;
  description?: string;
  location?: string;
  capacity?: number;
  amenities?: string[];
  hourlyRate?: number;
  isActive?: boolean;
  imageUrl?: string;
}
