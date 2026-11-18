export type MerchantOrder = {
  id: string;
  code: string;
  status: string;
  deliveryMode: string;
  fulfillment: string;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  tip: number;
  total: number;
  paymentStatus: string;
  paymentProvider: string | null;
  addressLine: string;
  comuna: string;
  instructions: string | null;
  pickupPin: string;
  createdAt: string;
  acceptedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  store: { id: string; name: string; emoji: string; comuna: string };
  customer: { name: string; phone: string | null };
  courier: {
    id: string;
    name: string;
    phone: string | null;
    vehicle: string;
  } | null;
  items: {
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    modifiersJson: string | null;
    notes: string | null;
  }[];
};
