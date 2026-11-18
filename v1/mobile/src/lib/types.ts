export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "CUSTOMER" | "COURIER";
};

export type Store = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  cuisine: string;
  emoji: string;
  comuna: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  ratingCount: number;
  prepTimeMin: number;
  minOrder: number;
  coverUrl?: string | null;
  deliveryFeeFrom: number;
};

export type ModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
};

export type Modifier = {
  id: string;
  name: string;
  type: "SINGLE" | "MULTIPLE" | string;
  required: boolean;
  min: number;
  max: number;
  options: ModifierOption[];
};

export type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  emoji?: string | null;
  imageUrl?: string | null;
  available: boolean;
  modifiers: Modifier[];
};

export type Category = {
  id: string;
  name: string;
  items: MenuItem[];
};

export type StoreDetail = Store & {
  deliveryMode: string;
  categories: Category[];
};

export type Comuna = {
  name: string;
  lat: number;
  lng: number;
  zone: string;
};

export type OrderSummary = {
  id: string;
  code: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  deliveryMode: string;
  itemCount: number;
  store: {
    name: string;
    emoji: string;
    slug: string;
    comuna: string;
  };
};

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifiersJson?: string | null;
  notes?: string | null;
};

export type OrderEvent = {
  id: string;
  type: string;
  payload?: string | null;
  createdAt: string;
};

export type Order = {
  id: string;
  code: string;
  status: string;
  deliveryMode: string;
  fulfillment: string;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  tip: number;
  discount: number;
  total: number;
  distanceKm: number;
  paymentStatus: string;
  paymentProvider: string | null;
  addressLine: string;
  comuna: string;
  lat: number;
  lng: number;
  instructions?: string | null;
  deliveryPin?: string;
  pickupPin?: string;
  createdAt: string;
  acceptedAt?: string | null;
  readyAt?: string | null;
  courierAssignedAt?: string | null;
  pickedUpAt?: string | null;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  cancellationReason?: string | null;
  store: Store & { merchantDeliveryMode: string };
  courier: {
    id: string;
    name: string;
    phone?: string | null;
    vehicle: string;
    rating: number;
    currentLat?: number | null;
    currentLng?: number | null;
  } | null;
  items: OrderItem[];
  events: OrderEvent[];
  payment: { provider: string; status: string; amount: number } | null;
  reviewed: boolean;
  canCancel: boolean;
  canReview: boolean;
  viewerRole: string;
  isAdminView: boolean;
};

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
  instructions?: string | null;
  createdAt: string;
  store: {
    name: string;
    emoji: string;
    comuna: string;
    address: string;
    lat: number;
    lng: number;
  };
  customer: { name: string; phone?: string | null };
  items: {
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    notes?: string | null;
  }[];
};

export type CourierDashboard = {
  courier: {
    id: string;
    status: string;
    verificationStatus: string;
    vehicle: string;
    zone?: string | null;
    rating: number;
    ratingCount: number;
    currentLat?: number | null;
    currentLng?: number | null;
    name: string;
    phone?: string | null;
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
