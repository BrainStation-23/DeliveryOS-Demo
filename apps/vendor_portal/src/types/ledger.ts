export interface LedgerOrderItem {
  id?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  instructions?: string | null;
  variant?: { name: string; price?: number; priceDelta?: number; priceModifier?: number } | null;
  addons?: Array<{ name: string; price: number }>;
}

export interface LedgerRiderInfo {
  id: string;
  fullName: string;
  phone?: string;
  vehicleType?: string;
}

export interface LedgerItem {
  id: string;
  orderId: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  vendorAddress?: string | null;
  customerName: string;
  customerPhone?: string;
  customerNotes?: string | null;
  rejectionReason?: string | null;
  prepTimeMinutes?: number | null;
  deliveryAddress?: { addressLine: string; label?: string } | null;
  items?: LedgerOrderItem[];
  paymentMethod: string;
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED' | string;
  orderStatus: string;
  subtotal?: number;
  couponDiscount?: number;
  deliveryFee?: number;
  taxAmount?: number;
  totalAmount?: number;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netVendorPayable: number;
  settlementStatus: string;
  settledAt?: string | null;
  createdAt: string;
  placedAt?: string;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  rider?: LedgerRiderInfo | null;
}
