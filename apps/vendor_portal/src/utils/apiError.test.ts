import { describe, expect, it } from 'vitest';
import { extractApiError } from './apiError';

describe('extractApiError', () => {
  it('returns plain string errors verbatim', () => {
    expect(extractApiError('Direct message')).toBe('Direct message');
  });

  it('extracts the axios response message', () => {
    const error = { response: { data: { message: 'Outlet is closed' } } };
    expect(extractApiError(error)).toBe('Outlet is closed');
  });

  it('joins class-validator array messages into one line', () => {
    const error = { response: { data: { message: ['name must be a string'] } } };
    expect(extractApiError(error)).toBe('name must be a string');
  });

  it('falls back to Error.message when there is no response payload', () => {
    expect(extractApiError(new Error('Socket disconnected'))).toBe('Socket disconnected');
  });

  it('falls back to the default message for unshaped objects', () => {
    expect(extractApiError({})).toBe('Something went wrong. Please try again.');
    expect(extractApiError(undefined, 'Custom fallback')).toBe('Custom fallback');
  });
});
