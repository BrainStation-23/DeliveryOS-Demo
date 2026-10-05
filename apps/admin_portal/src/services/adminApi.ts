/**
 * Aggregated admin API surface. Domain modules live under `./admin/`; this
 * barrel keeps every page importing a single `adminApi` object and re-exports
 * the response types so existing import paths stay stable.
 */
import { analyticsApi } from './admin/analytics.api';
import { customersApi } from './admin/customers.api';
import { financeApi } from './admin/finance.api';
import { fleetApi } from './admin/fleet.api';
import { mediaApi } from './admin/media.api';
import { ordersApi } from './admin/orders.api';
import { promotionsApi } from './admin/promotions.api';
import { outletTypesApi } from './admin/outletTypes.api';
import { settingsApi } from './admin/settings.api';
import { vendorsApi } from './admin/vendors.api';

export const adminApi = {
  ...analyticsApi,
  ...ordersApi,
  ...fleetApi,
  ...promotionsApi,
  ...vendorsApi,
  ...customersApi,
  ...financeApi,
  ...settingsApi,
  ...outletTypesApi,
  ...mediaApi,
};

export * from './admin/shared';
export * from './admin/analytics.api';
export * from './admin/customers.api';
export * from './admin/finance.api';
export * from './admin/fleet.api';
export * from './admin/media.api';
export * from './admin/orders.api';
export * from './admin/promotions.api';
export * from './admin/outletTypes.api';
export * from './admin/settings.api';
export * from './admin/vendors.api';

export default adminApi;
