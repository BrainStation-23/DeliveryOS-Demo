export function extractApiError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (typeof error === 'string') return error;
  const response = (error as { response?: { data?: { message?: unknown } } })?.response?.data;
  const message = response?.message;
  if (typeof message === 'string' && message) return message;
  if (Array.isArray(message) && message.length > 0) return message.join(', ');
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
