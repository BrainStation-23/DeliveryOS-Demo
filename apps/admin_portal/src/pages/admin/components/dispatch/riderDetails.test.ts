import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatPaymentMethod,
  getInitials,
  getRiderGovernanceState,
  STATUS_BADGE_VARIANT,
} from './RiderDetailsDrawer';

describe('RiderDetailsDrawer helpers', () => {
  describe('formatDate', () => {
    it('returns dash for null or undefined dates', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate(undefined)).toBe('—');
      expect(formatDate('')).toBe('—');
    });

    it('formats ISO dates correctly into readable day month year', () => {
      const formatted = formatDate('2026-10-03T12:00:00Z');
      expect(formatted).toMatch(/3 Oct 2026/);
    });
  });

  describe('formatDateTime', () => {
    it('returns dash for null or undefined timestamps', () => {
      expect(formatDateTime(null)).toBe('—');
      expect(formatDateTime(undefined)).toBe('—');
    });

    it('formats ISO timestamps with date and time', () => {
      const formatted = formatDateTime('2026-10-03T14:30:00Z');
      expect(formatted).toContain('2026');
    });
  });

  describe('formatPaymentMethod', () => {
    it('maps standard payment methods to clear user labels', () => {
      expect(formatPaymentMethod('CASH_ON_DELIVERY')).toBe('Cash on Delivery (COD)');
      expect(formatPaymentMethod('BKASH')).toBe('bKash');
      expect(formatPaymentMethod('NAGAD')).toBe('Nagad');
      expect(formatPaymentMethod('ROCKET')).toBe('Rocket');
      expect(formatPaymentMethod('CARD')).toBe('Card Payment');
      expect(formatPaymentMethod('CREDIT_CARD')).toBe('Card Payment');
      expect(formatPaymentMethod('DIGITAL_WALLET')).toBe('Digital Wallet');
    });

    it('handles unexpected or fallback payment methods', () => {
      expect(formatPaymentMethod('CUSTOM_GATEWAY')).toBe('CUSTOM GATEWAY');
      expect(formatPaymentMethod(null)).toBe('Unknown');
      expect(formatPaymentMethod(undefined)).toBe('Unknown');
    });
  });

  describe('getInitials', () => {
    it('extracts initials for multi-word full names', () => {
      expect(getInitials('Md Imam Hossain')).toBe('MH');
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Rahim')).toBe('RA');
    });

    it('falls back to default initials for empty or undefined names', () => {
      expect(getInitials('')).toBe('RD');
      expect(getInitials(undefined)).toBe('RD');
    });
  });

  describe('STATUS_BADGE_VARIANT', () => {
    it('correctly maps duty statuses', () => {
      expect(STATUS_BADGE_VARIANT['ONLINE']).toBe('success');
      expect(STATUS_BADGE_VARIANT['ON_TRIP']).toBe('info');
      expect(STATUS_BADGE_VARIANT['OFFLINE']).toBe('default');
    });
  });

  describe('getRiderGovernanceState', () => {
    it('returns ACTIVATE action and Suspended danger badge when courier userStatus is SUSPENDED', () => {
      const stateFromApproved = getRiderGovernanceState({ isApproved: true, userStatus: 'SUSPENDED' });
      expect(stateFromApproved).toEqual({
        action: 'ACTIVATE',
        badgeLabel: 'Suspended',
        badgeVariant: 'danger',
      });

      const stateFromUnapproved = getRiderGovernanceState({ isApproved: false, userStatus: 'SUSPENDED' });
      expect(stateFromUnapproved).toEqual({
        action: 'ACTIVATE',
        badgeLabel: 'Suspended',
        badgeVariant: 'danger',
      });
    });

    it('returns APPROVE action and Pending Approval warning badge when courier is unapproved', () => {
      const stateUnapproved = getRiderGovernanceState({ isApproved: false, userStatus: 'ACTIVE' });
      expect(stateUnapproved).toEqual({
        action: 'APPROVE',
        badgeLabel: 'Pending Approval',
        badgeVariant: 'warning',
      });

      const statePendingUser = getRiderGovernanceState({ isApproved: true, userStatus: 'PENDING_APPROVAL' });
      expect(statePendingUser).toEqual({
        action: 'APPROVE',
        badgeLabel: 'Pending Approval',
        badgeVariant: 'warning',
      });
    });

    it('returns SUSPEND action and Active success badge when courier is approved and active', () => {
      const state = getRiderGovernanceState({ isApproved: true, userStatus: 'ACTIVE' });
      expect(state).toEqual({
        action: 'SUSPEND',
        badgeLabel: 'Active',
        badgeVariant: 'success',
      });
    });
  });
});
