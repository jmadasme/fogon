export type AvailableCourierOrder = {
  id: string;
  code: string;
  status: string;
  courierPayout: number;
  distanceKm: number;
  distanceToStore: number;
  comuna: string;
  createdAt: string;
  itemCount: number;
  store: {
    name: string;
    emoji: string;
    comuna: string;
    address: string;
    lat: number;
    lng: number;
  };
};

export type CourierOrder = {
  id: string;
  code: string;
  status: string;
  total: number;
  courierPayout: number;
  distanceKm: number;
  distanceToStore: number;
  addressLine: string;
  comuna: string;
  lat: number;
  lng: number;
  instructions: string | null;
  createdAt: string;
  store: {
    name: string;
    emoji: string;
    comuna: string;
    address: string;
    lat: number;
    lng: number;
  };
  customer: { name: string; phone: string | null };
  items: {
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    notes: string | null;
  }[];
};

export type CourierDashboard = {
  courier: {
    id: string;
    status: string;
    verificationStatus: string;
    vehicle: string;
    zone: string | null;
    rating: number;
    ratingCount: number;
    currentLat: number | null;
    currentLng: number | null;
    name: string;
    phone: string | null;
  };
  available: AvailableCourierOrder[];
  active: CourierOrder | null;
  earnings: {
    today: number;
    week: number;
    deliveriesToday: number;
    deliveriesWeek: number;
  };
};
