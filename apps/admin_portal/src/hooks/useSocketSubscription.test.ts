import { describe, expect, it } from 'vitest';
import { buildSubscriptionKey } from './useSocketSubscription';

describe('buildSubscriptionKey', () => {
  it('returns the same key for equal-but-not-identical inline arrays', () => {
    const a = buildSubscriptionKey(['order:new', 'order:status:changed'], [['admin-analytics'], ['admin-overview']]);
    const b = buildSubscriptionKey(['order:new', 'order:status:changed'], [['admin-analytics'], ['admin-overview']]);

    expect(a).toBe(b);
  });

  it('changes when the event list changes', () => {
    const a = buildSubscriptionKey(['order:new'], [['admin-orders']]);
    const b = buildSubscriptionKey(['order:new', 'order:status:changed'], [['admin-orders']]);

    expect(a).not.toBe(b);
  });

  it('changes when a query key changes, including primitive entries', () => {
    const a = buildSubscriptionKey(['order:new'], [['admin-outlet-detail', 'outlet-1'], ['admin-vendors']]);
    const b = buildSubscriptionKey(['order:new'], [['admin-outlet-detail', 'outlet-2'], ['admin-vendors']]);

    expect(a).not.toBe(b);
  });

  it('is sensitive to query key order', () => {
    const a = buildSubscriptionKey(['order:new'], [['admin-orders'], ['admin-vendors']]);
    const b = buildSubscriptionKey(['order:new'], [['admin-vendors'], ['admin-orders']]);

    expect(a).not.toBe(b);
  });

  it('treats a bare string key as equivalent to its single-element array form', () => {
    const stringKey = buildSubscriptionKey(['order:new'], ['admin-orders']);
    const arrayKey = buildSubscriptionKey(['order:new'], [['admin-orders']]);

    expect(stringKey).toBe(arrayKey);
  });

  it('produces a primitive string usable directly as an effect dependency', () => {
    const key = buildSubscriptionKey(['order:new'], [['admin-orders']]);

    expect(typeof key).toBe('string');
  });
});
