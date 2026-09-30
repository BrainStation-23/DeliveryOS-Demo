import { describe, expect, it } from 'vitest';
import { extractApiError } from './apiError';

describe('extractApiError', () => {
  it('returns plain string errors verbatim', () => {
    expect(extractApiError('Direct message')).toBe('Direct message');
  });

  it('extracts the axios response message', () => {
    const error = { response: { data: { message: 'Order not found' } } };
    expect(extractApiError(error)).toBe('Order not found');
  });

  it('joins class-validator array messages into one line', () => {
    const error = { response: { data: { message: ['phone must be a valid phone', 'otp must be 6 digits'] } } };
    expect(extractApiError(error)).toBe('phone must be a valid phone, otp must be 6 digits');
  });

  it('falls back to Error.message when there is no response payload', () => {
    expect(extractApiError(new Error('Network Error'))).toBe('Network Error');
  });

  it('falls back to the default message for unshaped objects', () => {
    expect(extractApiError({})).toBe('Something went wrong. Please try again.');
    expect(extractApiError(null, 'Custom fallback')).toBe('Custom fallback');
  });
});
