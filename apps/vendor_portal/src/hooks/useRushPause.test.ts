import { describe, expect, it } from 'vitest';
import { resolveTargetOutletState } from './useRushPause';

describe('T11: useRushPause - Designated Target Outlet Scope', () => {
  const outlets = [
    { id: 'outlet-1', isBusy: false, name: 'Gulshan Branch' },
    { id: 'outlet-2', isBusy: true, name: 'Dhanmondi Branch' },
    { id: 'outlet-3', isBusy: false, name: 'Banani Branch' },
  ];

  it('targets designated outlet rather than global context activeOutlet', () => {
    const activeOutlet = outlets[0]; // outlet-1 is NOT busy

    // When targeting outlet-2 (which IS busy)
    const state = resolveTargetOutletState('outlet-2', activeOutlet, outlets);

    expect(state.effectiveOutletId).toBe('outlet-2');
    expect(state.targetOutlet?.id).toBe('outlet-2');
    expect(state.isBusy).toBe(true); // Reflects outlet-2's busy status, NOT outlet-1's!
    expect(state.canToggle).toBe(true);
  });

  it('falls back to activeOutlet when no targetOutletId is provided and active is specific outlet', () => {
    const activeOutlet = outlets[1]; // outlet-2

    const state = resolveTargetOutletState(undefined, activeOutlet, outlets);

    expect(state.effectiveOutletId).toBe('outlet-2');
    expect(state.targetOutlet?.id).toBe('outlet-2');
    expect(state.isBusy).toBe(true);
    expect(state.canToggle).toBe(true);
  });

  it('disallows toggle (canToggle: false) when activeOutlet is ALL and no targetOutletId is specified', () => {
    const activeOutlet = { id: 'ALL', isBusy: false, name: 'All Outlets' };

    const state = resolveTargetOutletState(undefined, activeOutlet, outlets);

    expect(state.effectiveOutletId).toBeUndefined();
    expect(state.targetOutlet).toBeNull();
    expect(state.isBusy).toBe(false);
    expect(state.canToggle).toBe(false);
  });

  it('handles null activeOutlet without crashing', () => {
    const state = resolveTargetOutletState('outlet-3', null, outlets);

    expect(state.effectiveOutletId).toBe('outlet-3');
    expect(state.targetOutlet?.id).toBe('outlet-3');
    expect(state.isBusy).toBe(false);
    expect(state.canToggle).toBe(true);
  });
});
