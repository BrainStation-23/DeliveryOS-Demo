export type KDSOrderStatus =
  | 'PLACED'
  | 'RIDER_ASSIGNED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface KDSOrderItemVariant {
  id: string;
  name: string;
  priceDelta: number;
}

export interface KDSOrderItem {
  id: string;
  productId: string;
  productName: string;
  productNameSnapshot?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  totalPrice?: number;
  instructions?: string | null;
  specialInstructions?: string | null;
  variant?: KDSOrderItemVariant | null;
  variantSnapshot?: { id: string; name: string; price?: number; priceModifier?: number } | null;
}

export interface KDSCustomer {
  id: string;
  fullName: string;
  phone: string;
}

export interface KDSRider {
  id: string;
  fullName: string;
  phone: string;
  latitude?: number | null;
  longitude?: number | null;
  user?: {
    fullName?: string;
    phone?: string;
  } | null;
}

export interface KDSOrder {
  id: string;
  orderNumber: string;
  vendorId: string;
  status: KDSOrderStatus;
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: 'CASH_ON_DELIVERY' | 'ONLINE_GATEWAY';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  deliveryAddress?: {
    addressLine: string;
    label?: string;
  } | null;
  customerNotes?: string | null;
  prepTimeMinutes?: number | null;
  createdAt: string;
  placedAt?: string;
  updatedAt: string;
  acceptedAt?: string | null;
  readyAt?: string | null;
  customer: KDSCustomer;
  customerPhoneSnapshot?: string;
  rider?: KDSRider | null;
  items: KDSOrderItem[];
  orderItems?: KDSOrderItem[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  price: number;
  isInStock: boolean;
}

export interface Product {
  id: string;
  vendorId: string;
  categoryId: string;
  name: string;
  description?: string | null;
  basePrice: number;
  unitType: string;
  imageUrl?: string | null;
  isInStock: boolean;
  variants: ProductVariant[];
}

export interface Category {
  id: string;
  vendorId: string;
  name: string;
  displayOrder: number;
  products: Product[];
}

export interface OutletCatalog {
  vendorId: string;
  vendorName: string;
  defaultPrepTimeMinutes: number;
  categories: Category[];
}
