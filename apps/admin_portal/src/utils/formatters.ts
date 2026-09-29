/**
 * Standard formatters for Admin Portal
 */

export function formatCurrency(
  amount: number | string | null | undefined,
  options?: { decimals?: boolean }
): string {
  const num = Number(amount) || 0;
  if (options?.decimals) {
    return `৳ ${num.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `৳ ${num.toLocaleString('en-BD')}`;
}

export function formatDateTime(
  dateStr: string | Date | null | undefined,
  mode: 'full' | 'date' | 'time' = 'full'
): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '';

  if (mode === 'date') {
    return d.toLocaleDateString('en-BD', { dateStyle: 'medium' });
  }
  if (mode === 'time') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return d.toLocaleString('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  // Clean representation
  return phone.trim();
}
