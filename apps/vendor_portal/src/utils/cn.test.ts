import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn (class merge)', () => {
  it('joins conditional class names and drops falsy entries', () => {
    const isToggled = true;
    const isHidden = false;
    expect(cn('px-4', isToggled && 'py-2', isHidden && 'hidden', undefined, null)).toBe('px-4 py-2');
  });

  it('resolves Tailwind conflicts with the last utility winning', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('bg-red-500', 'bg-green-500')).toBe('bg-green-500');
  });

  it('returns an empty string for no inputs', () => {
    expect(cn()).toBe('');
  });
});
