export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  VENDOR_ADMIN = 'VENDOR_ADMIN',
  RIDER = 'RIDER',
  CUSTOMER = 'CUSTOMER',
}

export enum PermissionScope {
  PARTICULAR_OUTLET = 'PARTICULAR_OUTLET',
  ALL_OUTLETS_MASTER = 'ALL_OUTLETS_MASTER',
}

export interface User {
  id: string;
  phone: string;
  email?: string | null;
  fullName: string;
  role: UserRole;
  vendorId?: string | null;
  vendorName?: string | null;
  brandName?: string | null;
  outletScope?: PermissionScope | null;
  managedVendorIds?: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
