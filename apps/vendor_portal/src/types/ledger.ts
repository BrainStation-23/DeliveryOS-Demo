export interface LedgerItem {
  id: string;
  orderId: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  customerName: string;
  customerPhone?: string;
  customerNotes?: string | null;
  deliveryAddress?: { addressLine: string; label?: string } | null;
  items?: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    instructions?: string | null;
    variant?: { name: string; priceDelta: number } | null;
    addons?: Array<{ name: string; price: number }>;
  }>;
  paymentMethod: string;
  orderStatus: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netVendorPayable: number;
  settlementStatus: string;
  settledAt?: string | null;
  createdAt: string;
}
