export interface Landmark {
  id: string;
  name: string;
  description: string;
  image: string;
  location: {
    latitude: number;
    longitude: number;
  };
  status: 'pending' | 'approved' | 'rejected';
  userId: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  isPreset?: boolean;
} 